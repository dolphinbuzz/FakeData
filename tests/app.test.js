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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function click(selector) {
  document.querySelector(selector).click();
}

function setupChromeMock({ scanFields = scannedFields } = {}) {
  sentMessages = [];
  storageData = { "fakedata-field-mappings": {} };

  globalThis.chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener: vi.fn() }
    },
    tabs: {
      onActivated: { addListener: vi.fn() },
      query: vi.fn((queryInfo, callback) => callback([activeTab])),
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
      open: vi.fn(() => Promise.resolve())
    },
    windows: {
      WINDOW_ID_CURRENT: 1
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
});
