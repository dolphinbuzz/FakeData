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

function pressShortcut(key, target = document.body) {
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true
  }));
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

  it("persiste a preferência e sincroniza a visibilidade dos botões flutuantes", async () => {
    await loadApp();
    const toggle = document.querySelector("#floating-controls-toggle");
    expect(toggle.checked).toBe(true);

    sentMessages = [];
    toggle.click();
    await nextTick();

    expect(toggle.checked).toBe(false);
    expect(storageData["fakedata-floating-controls"]).toBe(false);
    const updateMessage = sentMessages.find((item) => item.message.action === ACTIONS.UPDATE_PAGE_FIELD_CONTROLS);
    expect(updateMessage.message.visible).toBe(false);
  });

  it("executa as ações de mapeamento pelos atalhos de teclado", async () => {
    await loadApp();
    sentMessages = [];

    pressShortcut("s");
    pressShortcut("p");
    pressShortcut("l");
    pressShortcut("m");
    pressShortcut("f");
    await nextTick();

    expect(sentMessages.some((item) => item.message.action === ACTIONS.SCAN_FIELDS)).toBe(true);
    expect(sentMessages.some((item) => item.message.action === ACTIONS.FILL_ALL)).toBe(true);
    expect(sentMessages.some((item) => item.message.action === ACTIONS.MARK_ALL_FIELDS)).toBe(true);
    expect(sentMessages.some((item) => item.message.action === ACTIONS.UPDATE_PAGE_FIELD_CONTROLS &&
      item.message.visible === false)).toBe(true);
    expect(storageData["fakedata-floating-controls"]).toBe(false);
    expect(document.querySelector("#mapping-name-input").hidden).toBe(false);
  });

  it("não executa atalhos enquanto o foco está em campo editável", async () => {
    await loadApp();
    sentMessages = [];
    const input = document.querySelector("#mapping-name-input");
    input.focus();

    pressShortcut("s", input);
    pressShortcut("p", input);
    await nextTick();

    expect(sentMessages).toHaveLength(0);
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

  it("alterna tema, abas e copia um resultado gerado", async () => {
    await loadApp();

    expect(document.documentElement.dataset.theme).toBe("dark");
    click("#theme-toggle");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("fakedata-theme")).toBe("light");

    click("#mapping-tab");
    expect(document.querySelector("#mapping-panel").hidden).toBe(false);
    click("#generator-tab");
    expect(document.querySelector("#generator-panel").hidden).toBe(false);

    click(".copy-field-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(document.querySelector(".copy-field-button").textContent).toBe("✓");
  });

  it("adiciona, edita e remove itens do catálogo de veículos", async () => {
    await loadApp();
    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");

    document.querySelector("#vehicle-brand-input").value = "Toyota";
    document.querySelector("#vehicle-model-input").value = "Corolla";
    click("#vehicle-add-button");
    await nextTick();
    expect(storageData["fakedata-vehicle-catalog"]).toEqual([{ marca: "Toyota", modelos: ["Corolla"] }]);
    expect(document.querySelector("#vehicle-catalog-status").textContent).toBe("Veículo cadastrado.");

    vi.spyOn(window, "prompt").mockReturnValue("Lexus");
    click("[data-edit-brand='Toyota']");
    await nextTick();
    expect(storageData["fakedata-vehicle-catalog"][0].marca).toBe("Lexus");

    click("[data-edit-model][data-model='Corolla']");
    await nextTick();
    expect(document.querySelector("#vehicle-brand-input").value).toBe("Lexus");
    expect(document.querySelector("#vehicle-model-input").value).toBe("Corolla");
    click("#vehicle-add-button");
    await nextTick();
    expect(storageData["fakedata-vehicle-catalog"][0].modelos).toEqual(["Corolla"]);

    click("[data-remove-brand='Lexus']");
    await nextTick();
    expect(storageData["fakedata-vehicle-catalog"]).toEqual([]);
  });

  it("valida nome do mapeamento e permite cancelar o modal", async () => {
    await loadApp();
    click("#save-mappings-button");
    click("#mapping-modal-confirm");
    expect(document.querySelector("#mapping-modal-error").textContent).toBe("Informe um nome para continuar.");
    expect(document.querySelector("#mapping-modal").hidden).toBe(false);
    click("#mapping-modal-cancel");
    expect(document.querySelector("#mapping-modal").hidden).toBe(true);
    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"]).toBeUndefined();
  });

  it("verifica, marca e captura seletores no playground", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sentMessages.push({ tabId, message: clone(message) });
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: clone(scannedFields) });
      else if (message.action === ACTIONS.COUNT_SELECTOR_MATCHES) callback({ count: 2 });
      else if (message.action === ACTIONS.MARK_SELECTOR_MATCHES) callback({ count: 2 });
      else if (message.action === ACTIONS.UNMARK_SELECTOR_MATCHES) callback({ count: 0 });
      else if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: true, field: { selector: ".captured" } });
      else callback({});
    });
    click("#playground-mapping-tab");
    const input = document.querySelector("#selector-playground-input");
    input.value = ".field";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#selector-playground-count").textContent).toBe("2 encontrado(s)");
    expect(document.querySelector("#selector-playground-mark").disabled).toBe(false);
    click("#selector-playground-mark");
    expect(document.querySelector("#page-fields-status").textContent).toBe("2 elemento(s) encontrado(s) marcado(s).");
    click("#selector-playground-mark");
    expect(document.querySelector("#page-fields-status").textContent).toBe("Marcações do seletor removidas.");
    click("#selector-playground-target");
    expect(input.value).toBe(".captured");
  });

  it("marca todos os campos, desmarca e atualiza um seletor capturado", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sentMessages.push({ tabId, message: clone(message) });
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: clone(scannedFields) });
      else if (message.action === ACTIONS.MARK_ALL_FIELDS) callback({ selectors: message.selectors, marked: 2, total: 2 });
      else if (message.action === ACTIONS.UNMARK_ALL_FIELDS) callback({ selectors: [], marked: 0, total: 2 });
      else if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: true, field: { selector: "#novo", label: "Novo", inferredType: "text" } });
      else callback({});
    });
    click("#mark-all-button");
    expect(document.querySelector("#page-fields-status").textContent).toBe("Todos os campos foram marcados.");
    click("#mark-all-button");
    expect(document.querySelector("#page-fields-status").textContent).toBe("Todos os campos foram desmarcados.");
    click(".page-field [data-action='target']");
    expect(document.querySelector(".page-field-selector").value).toBe("#novo");
    expect(document.querySelector("#page-fields-status").textContent).toContain("Seletor capturado");
  });

  it("renomeia e exclui um perfil salvo", async () => {
    setupChromeMock({
      profiles: [{
        id: "profile-1",
        name: "Antigo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email" }]
      }]
    });
    await loadApp();
    vi.spyOn(window, "prompt").mockReturnValue("Novo nome");
    click("#rename-mapping-button");
    expect(document.querySelector("#mapping-modal").hidden).toBe(false);
    document.querySelector("#mapping-name-input").value = "Novo nome";
    click("#mapping-modal-confirm");
    await nextTick();
    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].name).toBe("Novo nome");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    click("#delete-mapping-button");
    await nextTick();
    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages).toEqual([]);
    expect(document.querySelector("#page-fields-status").textContent).toBe("Mapeamento excluído.");
  });

  it("migra perfis legados para a estrutura por origem", async () => {
    storageData["fakedata-field-mappings"] = {
      "https://sistema.example.test/cadastro": [{ ...scannedFields[0] }]
    };
    await loadApp();
    const migrated = storageData["fakedata-field-mappings"]["https://sistema.example.test"];
    expect(migrated.pages[0]).toMatchObject({
      id: "https://sistema.example.test/cadastro::legacy",
      name: "Mapeamento salvo"
    });
    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test/cadastro"]).toBeUndefined();
  });

  it("informa quando não há uma página web acessível", async () => {
    setupChromeMock({ openTabs: [{ id: 1, url: "chrome://settings/", active: true }] });
    await loadApp();
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("A página ativa não permite acesso a formulários.");
  })

  it("trata falhas de comunicação e de injeção durante o escaneamento", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chrome.runtime.lastError = { message: "Receiver unavailable" };
      callback();
      chrome.runtime.lastError = null;
    });
    chrome.scripting.executeScript.mockImplementation((details, callback) => {
      chrome.runtime.lastError = { message: "Cannot access contents" };
      callback();
      chrome.runtime.lastError = null;
    });
    click("#scan-fields-button");
    await nextTick();
    expect(document.querySelector("#page-fields-status").textContent)
      .toContain("Não foi possível ler esta página");
  });

  it("mostra estados de erro para marcação, localização e preenchimento", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sentMessages.push({ tabId, message: clone(message) });
      callback(null);
    });
    click(".page-field [data-action='highlight']");
    expect(document.querySelector("#page-fields-status").textContent)
      .toContain("Não foi possível marcar");
    click(".page-field [data-action='locate']");
    expect(document.querySelector("#page-fields-status").textContent)
      .toContain("Não foi possível localizar");
    click(".page-field [data-action='fill']");
    expect(document.querySelector("#page-fields-status").textContent)
      .toContain("Não foi possível preencher");
  });

  it("não duplica seletor capturado e reporta captura inválida", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sentMessages.push({ tabId, message: clone(message) });
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: true, field: { selector: "#email" } });
      else callback({});
    });
    click("#add-selector-button");
    await nextTick();
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("Esse seletor já está mapeado.");

    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: false });
      else callback({});
    });
    click("#add-selector-button");
    await nextTick();
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("Não foi possível adicionar o seletor.");
  });

  it("valida ações sem campos ou sem perfil selecionado", async () => {
    setupChromeMock({ scanFields: [] });
    await loadApp();
    click("#rename-mapping-button");
    click("#delete-mapping-button");
    click("#save-mappings-button");
    click("#fill-all-button");
    expect(document.querySelector("#page-fields-status").textContent).toBe("Nenhum campo mapeado.");
  });

  it("trata seletor vazio, inválido e sem correspondências no playground", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.COUNT_SELECTOR_MATCHES) callback({ invalid: true, count: 0 });
      else callback({});
    });
    click("#playground-mapping-tab");
    const input = document.querySelector("#selector-playground-input");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#selector-playground-count").textContent).toBe("—");
    input.value = "[";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#selector-playground-count").textContent).toBe("Inválido");
    click("#selector-playground-mark");
    expect(document.querySelector("#selector-playground-mark").disabled).toBe(true);
  });

  it("atualiza o perfil selecionado sem criar um novo registro", async () => {
    setupChromeMock({
      profiles: [{
        id: "profile-1",
        name: "Perfil existente",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email" }]
      }]
    });
    await loadApp();
    const selector = document.querySelector(".page-field-selector");
    selector.value = "#email-atualizado";
    selector.dispatchEvent(new Event("input", { bubbles: true }));
    click("#save-mappings-button");
    await nextTick();
    const profiles = storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages;
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: "profile-1", name: "Perfil existente" });
    expect(profiles[0].fields.find((field) => field.key === "#email::0")).toMatchObject({ selector: "#email-atualizado" });
  });

  it("persiste alterações de tipo e valor fixo do campo", async () => {
    await loadApp();
    const type = document.querySelector(".page-field-type");
    type.value = "phone";
    type.dispatchEvent(new Event("change", { bubbles: true }));
    const fixed = document.querySelector(".page-field-fixed-toggle");
    fixed.click();
    const value = document.querySelector(".page-field-fixed-value");
    value.value = "11999999999";
    value.dispatchEvent(new Event("input", { bubbles: true }));
    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Tipos e valores";
    click("#mapping-modal-confirm");
    await nextTick();
    expect(storageData["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields[0])
      .toMatchObject({ dataType: "phone", fixed: true, fixedValue: "11999999999" });
  });

  it("copia o JSON de locators e responde a falha ao abrir o painel", async () => {
    await loadApp();
    click("#copy-audit-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("\"cadastro-e-mail-email\""));

    chrome.sidePanel.open.mockRejectedValueOnce(new Error("painel indisponível"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    click("#open-sidepanel-button");
    await nextTick();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("informa falhas parciais ao marcar todos os campos", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.MARK_ALL_FIELDS) {
        callback({ marked: 1, total: 2, selectors: ["#email"], failed: ["#cpf"] });
      } else {
        callback({});
      }
    });
    click("#mark-all-button");
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("1 de 2 campo(s) marcado(s); 1 não foi(ram) localizado(s).");
  });

  it("informa erro quando o preenchimento em lote falha", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => callback(null));
    click("#fill-all-button");
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("Não foi possível preencher os campos desta página.");
  });

  it("preserva o nome original ao cancelar edição do campo", async () => {
    await loadApp();
    click(".page-field-edit-label");
    const editor = document.querySelector(".page-field-label-editor");
    editor.value = "Nome temporário";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".page-field-label").textContent).toBe("E-mail");
  });

  it("gera dados de empresa e trata falha ao copiar", async () => {
    await loadApp();
    click("#generator-tab");
    click("[data-type='company']");
    expect(document.querySelector("#result-title").textContent).toBe("Empresa gerada");

    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("clipboard indisponível"));
    click(".copy-field-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("conclui a captura de campo e restaura o botão após copiar", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sentMessages.push({ tabId, message: clone(message) });
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) {
        callback({ captured: true, field: { selector: "#capturado", label: "Campo capturado", inferredType: "text" } });
        return;
      }
      callback({});
    });
    click(".page-field [data-action='target']");
    await nextTick();
    expect(document.querySelector(".page-field-selector").value).toBe("#capturado");

    vi.useFakeTimers();
    const copyButton = document.querySelector(".copy-field-button");
    const originalText = copyButton.textContent;
    copyButton.click();
    await Promise.resolve();
    expect(copyButton.textContent).toBe("✓");
    vi.advanceTimersByTime(1200);
    expect(copyButton.textContent).toBe(originalText);
    vi.useRealTimers();
  });

  it("informa erro quando a captura de um campo mapeado falha", async () => {
    await loadApp();
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: false });
      else callback({});
    });
    click(".page-field [data-action='target']");
    await nextTick();
    expect(document.querySelector("#page-fields-status").textContent)
      .toBe("Não foi possível capturar um campo.");
  });
});
