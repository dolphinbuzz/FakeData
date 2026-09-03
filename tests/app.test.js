import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";

const popupHtml = readFileSync(resolve("src/popup.html"), "utf8")
  .replace(/<script type="module" src="scripts\/app\.js"><\/script>/, "");

const activeTab = {
  id: 10,
  url: "https://sistema.example.test/cadastro?etapa=1#dados"
};

const scannedFields = [
  {
    key: "#email::0",
    selector: "#email",
    label: "E-mail",
    inferredType: "email",
    tagName: "input",
    inputType: "email",
    selectorRule: "id",
    selectorStatus: "stable",
    selectorSuggestion: "",
    locatorName: "cadastro-e-mail-email"
  },
  {
    key: "#cpf::1",
    selector: "#cpf",
    label: "CPF",
    inferredType: "cpf",
    tagName: "input",
    inputType: "text",
    selectorRule: "id",
    selectorStatus: "stable",
    selectorSuggestion: "",
    locatorName: "cadastro-cpf-text"
  }
];

let dom;
let sentMessages;
let storageData;
let appMessageListener;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function click(selector) {
  document.querySelector(selector).click();
}

function setupChromeMock({ scanFields = scannedFields, profiles = [], openTabs = [activeTab], windowType = "tab", vehicleCatalog = [] } = {}) {
  sentMessages = [];
  appMessageListener = null;
  storageData = {
    "fakedata-field-mappings": profiles.length
      ? { "https://sistema.example.test": { pages: profiles } }
      : {},
    "fakedata-vehicle-catalog": vehicleCatalog
  };

  globalThis.chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener: vi.fn((listener) => { appMessageListener = listener; }) }
    },
    windows: {
      WINDOW_ID_CURRENT: 1,
      getCurrent: vi.fn((callback) => callback({ id: 1, type: windowType }))
    },
    tabs: {
      onActivated: { addListener: vi.fn() },
      query: vi.fn((queryInfo, callback) => callback(openTabs)),
      sendMessage: vi.fn((tabId, message, callback) => {
        sentMessages.push({ tabId, message: clone(message) });
        if (message.action === ACTIONS.SCAN_FIELDS) {
          callback({ fields: clone(scanFields) });
          return;
        }
        if (message.action === ACTIONS.FILL_ALL) {
          callback({ filled: message.fields.length, total: message.fields.length });
          return;
        }
        if (message.action === ACTIONS.FILL_FIELD) {
          callback({ filled: true });
          return;
        }
        if (message.action === ACTIONS.HIGHLIGHT_FIELD) {
          callback({ highlighted: true });
          return;
        }
        callback({});
      })
    },
    storage: {
      local: {
        get: vi.fn((defaults, callback) => {
          callback({ ...clone(defaults), ...clone(storageData) });
        }),
        set: vi.fn((items, callback = () => {}) => {
          storageData = { ...storageData, ...clone(items) };
          callback();
        })
      }
    },
    sidePanel: {
      open: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve())
    },
    scripting: {
      executeScript: vi.fn()
    }
  };
}

async function loadApp() {
  vi.resetModules();
  await import("../src/scripts/app.js");
}

async function nextTick() {
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
}

beforeEach(() => {
  dom = new JSDOM(popupHtml, {
    url: "https://extension.test/src/popup.html",
    pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator
  });
  globalThis.localStorage = dom.window.localStorage;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) }
  });
  setupChromeMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.window.close();
  delete globalThis.chrome;
});

describe("popup app", () => {
  it("escaneia campos da aba ativa e renderiza os mapeamentos encontrados", async () => {
    await loadApp();

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      activeTab.id,
      { action: ACTIONS.SCAN_FIELDS },
      expect.any(Function)
    );
    expect(document.querySelector("#page-fields-status").textContent).toBe(
      "2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário."
    );
    expect([...document.querySelectorAll(".page-field-label")].map((item) => item.textContent)).toEqual(["E-mail", "CPF"]);
    expect([...document.querySelectorAll(".page-field-selector")].map((item) => item.value)).toEqual(["#email", "#cpf"]);
    expect([...document.querySelectorAll(".page-field-type")].map((item) => item.value)).toEqual(["email", "cpf"]);
  });

  it("carrega o catálogo salvo e gera marca e modelo vinculados", async () => {
    setupChromeMock({
      vehicleCatalog: [{ marca: "Ford", modelos: ["Ka", "Ranger"] }]
    });
    await loadApp();

    click("[data-type='vehicle']");

    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ford");
    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ka");
    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ranger");
    const values = [...document.querySelectorAll("#result-fields .field-value")].map((item) => item.textContent);
    expect(values).toContain("Ford");
    expect(["Ka", "Ranger"]).toContain(values[1]);
  });

  it("exibe o cadastro de veículos em modal somente no tipo Veículo", async () => {
    await loadApp();

    const trigger = document.querySelector("#open-vehicle-catalog-button");
    expect(trigger.hidden).toBe(true);
    click("[data-type='vehicle']");
    expect(trigger.hidden).toBe(false);

    click("#open-vehicle-catalog-button");
    expect(document.querySelector("#vehicle-catalog-modal").hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector("#vehicle-catalog-modal").hidden).toBe(true);

    click("[data-type='person']");
    expect(trigger.hidden).toBe(true);
  });

  it("fecha o painel usando o ID real da janela ao abrir em uma aba", async () => {
    await loadApp();
    chrome.runtime.getURL = vi.fn((path) => `chrome-extension://test/${path}`);
    chrome.tabs.create = vi.fn((options, callback) => callback());
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    click("#maximize-button");
    await nextTick();

    expect(chrome.sidePanel.close).toHaveBeenCalledWith({ windowId: 1 });
    expect(closeSpy).toHaveBeenCalled();
  });

  it("envia todos os campos mapeados para preenchimento", async () => {
    await loadApp();
    sentMessages = [];

    click("#fill-all-button");

    const fillAllMessage = sentMessages.find((item) => item.message.action === ACTIONS.FILL_ALL);
    expect(fillAllMessage).toBeTruthy();
    expect(fillAllMessage.message.fields).toHaveLength(2);
    expect(fillAllMessage.message.fields.map((field) => field.selector)).toEqual(["#email", "#cpf"]);
    expect(fillAllMessage.message.fields.every((field) => typeof field.value === "string" && field.value.length > 0)).toBe(true);
    expect(document.querySelector("#page-fields-status").textContent).toBe("2 de 2 campo(s) preenchido(s).");
  });

  it("preenche um campo individual pelo ícone de colar", async () => {
    await loadApp();
    sentMessages = [];

    click(".page-field [data-action='fill']");

    const fillMessage = sentMessages.find((item) => item.message.action === ACTIONS.FILL_FIELD);
    expect(fillMessage).toBeTruthy();
    expect(fillMessage.message.selector).toBe("#email");
    expect(fillMessage.message.value).toEqual(expect.any(String));
    expect(document.querySelector(".page-field-fixed-value").value).toBe(fillMessage.message.value);
  });

  it("salva um novo mapeamento no storage por origem e URL normalizada", async () => {
    await loadApp();

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Cadastro principal";
    click("#mapping-modal-confirm");
    await nextTick();

    const stored = storageData["fakedata-field-mappings"];
    const application = stored["https://sistema.example.test"];
    expect(application.pages).toHaveLength(1);
    expect(application.pages[0]).toMatchObject({
      name: "Cadastro principal",
      pageUrl: "https://sistema.example.test/cadastro",
      fields: [
        {
          key: "#email::0",
          selector: "#email",
          dataType: "email",
          fixed: false,
          fixedValue: "",
          locatorName: "cadastro-e-mail-email"
        },
        {
          key: "#cpf::1",
          selector: "#cpf",
          dataType: "cpf",
          fixed: false,
          fixedValue: "",
          locatorName: "cadastro-cpf-text"
        }
      ]
    });
    expect(application.pages[0].audit).toEqual([
      expect.objectContaining({ elemento: "E-mail", seletorGerado: "#email", status: "estável" }),
      expect.objectContaining({ elemento: "CPF", seletorGerado: "#cpf", status: "estável" })
    ]);
    expect(document.querySelector("#page-fields-status").textContent).toBe('Mapeamento "Cadastro principal" salvo.');
  });

  it("carrega automaticamente o único perfil da URL e preserva valor fixo", async () => {
    setupChromeMock({
      profiles: [{
        id: "profile-1",
        name: "Cadastro salvo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email", fixed: true, fixedValue: "fixo@example.test" }]
      }]
    });
    await loadApp();

    expect(document.querySelector("#saved-mappings-select").value).toBe("profile-1");
    expect(document.querySelector(".page-field-fixed-toggle").checked).toBe(true);
    expect(document.querySelector(".page-field-fixed-value").value).toBe("fixo@example.test");
  });

  it("preserva o nome editado ao salvar e selecionar novamente o perfil", async () => {
    setupChromeMock({
      scanFields: [{ ...scannedFields[0], label: "First Name" }]
    });
    await loadApp();

    click(".page-field-edit-label");
    const editor = document.querySelector(".page-field-label-editor");
    editor.value = "Nome principal";
    editor.dispatchEvent(new Event("blur", { bubbles: true }));

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Cadastro com nome editado";
    click("#mapping-modal-confirm");
    await nextTick();

    const storedProfile = storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages[0];
    expect(storedProfile.fields[0].label).toBe("Nome principal");

    const profileSelect = document.querySelector("#saved-mappings-select");
    profileSelect.value = "";
    profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelectorAll(".page-field").length).toBe(1);

    profileSelect.value = storedProfile.id;
    profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector(".page-field-label").textContent).toBe("Nome principal");
  });

  it("envia valor fixo no preenchimento individual", async () => {
    setupChromeMock({
      profiles: [{
        id: "profile-1",
        name: "Cadastro salvo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email", fixed: true, fixedValue: "fixo@example.test" }]
      }]
    });
    await loadApp();
    sentMessages = [];
    click(".page-field [data-action='fill']");

    const fillMessage = sentMessages.find((item) => item.message.action === ACTIONS.FILL_FIELD);
    expect(fillMessage.message).toMatchObject({
      selector: "#email",
      value: "fixo@example.test"
    });
  });

  it("exibe e salva os valores do preenchimento em lote", async () => {
    await loadApp();
    sentMessages = [];
    click("#fill-all-button");

    const fillAllMessage = sentMessages.find((item) => item.message.action === ACTIONS.FILL_ALL);
    expect([...document.querySelectorAll(".page-field-fixed-value")].map((input) => input.value))
      .toEqual(fillAllMessage.message.fields.map((field) => field.value));

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Com valores";
    click("#mapping-modal-confirm");
    await nextTick();

    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields)
      .toEqual(expect.arrayContaining(fillAllMessage.message.fields.map((field) =>
        expect.objectContaining({ selector: field.selector, fixedValue: field.value, fixed: false })
      )));
  });

  it("fixa o valor atual do campo e salva a configuração", async () => {
    await loadApp();
    click(".page-field [data-action='fill']");
    const valueInput = document.querySelector(".page-field-fixed-value");
    const generatedValue = valueInput.value;
    expect(valueInput.disabled).toBe(true);

    click(".page-field-fixed-toggle");
    expect(valueInput.disabled).toBe(false);
    expect(valueInput.value).toBe(generatedValue);

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Valor fixo";
    click("#mapping-modal-confirm");
    await nextTick();

    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields[0])
      .toMatchObject({ fixed: true, fixedValue: generatedValue });
  });

  it("localiza o campo pelo seletor e atualiza o status", async () => {
    await loadApp();
    sentMessages = [];
    click(".page-field [data-action='locate']");

    expect(sentMessages.some((item) => item.message.action === ACTIONS.HIGHLIGHT_FIELD && item.message.selector === "#email")).toBe(true);
    expect(document.querySelector("#page-fields-status").textContent).toBe("E-mail localizado na página.");
  });

  it("atualiza o scan em mudança de DOM e limpa em mudança de rota", async () => {
    await loadApp();
    expect(appMessageListener).toEqual(expect.any(Function));
    appMessageListener({ action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "dom", url: activeTab.url }, { tab: { id: activeTab.id, url: activeTab.url } });
    await nextTick();
    appMessageListener({ action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "route", url: "https://sistema.example.test/outro" }, { tab: { id: activeTab.id, url: activeTab.url } });
    await nextTick();

    const scans = sentMessages.filter((item) => item.message.action === ACTIONS.SCAN_FIELDS);
    expect(scans.length).toBeGreaterThanOrEqual(3);
  });

  it("lista bases registráveis sem duplicar subdomínios", async () => {
    setupChromeMock({
      openTabs: [
        { id: 10, url: "https://www.exemplo.com.br/cadastro", active: true },
        { id: 11, url: "https://app.exemplo.com.br/outra" },
        { id: 12, url: "https://www.outro.com/login" },
        { id: 13, url: "chrome://settings/" }
      ]
    });
    await loadApp();

    expect([...document.querySelectorAll("#base-url-select option")].map((option) => option.value))
      .toEqual(["https://exemplo.com.br", "https://outro.com"]);
  });

  it("troca a página monitorada ao selecionar outra base", async () => {
    const tabs = [
      { id: 10, url: "https://www.exemplo.com.br/cadastro", active: true },
      { id: 11, url: "https://app.outro.com/login" }
    ];
    setupChromeMock({ openTabs: tabs });
    await loadApp();
    sentMessages = [];

    const select = document.querySelector("#base-url-select");
    select.value = "https://outro.com";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(sentMessages.some((item) => item.tabId === 11 && item.message.action === ACTIONS.SCAN_FIELDS)).toBe(true);
  });

  it("ignora alterações de outra aba ou de outra base", async () => {
    await loadApp();
    sentMessages = [];

    appMessageListener(
      { action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "dom", url: "https://outro.com/pagina" },
      { tab: { id: 99, url: "https://outro.com/pagina" } }
    );

    expect(sentMessages.filter((item) => item.message.action === ACTIONS.SCAN_FIELDS)).toHaveLength(0);
  });

  it("abre o pop-up compacto diretamente em Mapear campos", async () => {
    setupChromeMock({ windowType: "popup" });
    await loadApp();

    expect(document.querySelector("#mapping-tab").classList.contains("active")).toBe(true);
    expect(document.querySelector("#generator-panel").hidden).toBe(true);
    expect(document.querySelector("#generator-tab").hidden).toBe(true);
    expect(document.documentElement.dataset.extensionMode).toBe("popup");
    expect(document.querySelector("#playground-mapping-tab").hidden).toBe(true);
    expect(document.querySelector("#scan-fields-button").hidden).toBe(false);
    expect(document.querySelector("#fill-all-button").hidden).toBe(false);
    expect(document.querySelector("#save-mappings-button").hidden).toBe(true);
  });

  it("preserva a interface completa na aba dedicada", async () => {
    await loadApp();

    expect(document.documentElement.dataset.extensionMode).toBeUndefined();
    expect(getComputedStyle(document.querySelector("#generator-tab")).display).not.toBe("none");
    expect(getComputedStyle(document.querySelector("#playground-mapping-tab")).display).not.toBe("none");
    expect(getComputedStyle(document.querySelector("#save-mappings-button")).display).not.toBe("none");
  });
});
