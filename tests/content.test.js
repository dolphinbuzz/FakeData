import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";

let dom;
let messageListener;

function setupPage() {
  dom = new JSDOM(`<!doctype html><body>
    <form>
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="email">
      <label for="cpf">CPF</label>
      <input id="cpf" name="cpf">
      <label for="uf">Estado</label>
      <select id="uf"><option value="">Selecione</option><option value="CE">CE</option><option value="SP">SP</option></select>
    </form>
  </body>`, {
    url: "https://sistema.example.test/cadastro",
    pretendToBeVisual: true
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.history = dom.window.history;
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
}

function setupChromeMock() {
  messageListener = null;
  globalThis.chrome = {
    runtime: {
      getURL: vi.fn((filePath) => pathToFileURL(resolve(filePath)).href),
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn((listener) => {
          messageListener = listener;
        })
      }
    }
  };
}

async function loadContentScript() {
  vi.resetModules();
  await import("../src/scripts/content.js");
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
}

function sendContentMessage(message) {
  return new Promise((resolveMessage) => {
    messageListener(message, {}, resolveMessage);
  });
}

beforeEach(async () => {
  setupPage();
  setupChromeMock();
  await loadContentScript();
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.window.close();
  delete globalThis.chrome;
});

describe("content script", () => {
  it("responde ao escaneamento com campos editáveis da página", async () => {
    const response = await sendContentMessage({ action: ACTIONS.SCAN_FIELDS });

    expect(response.fields.map((field) => field.selector)).toEqual(["#email", "#cpf", "#uf"]);
    expect(response.fields.map((field) => field.inferredType)).toEqual(["email", "cpf", "state"]);
  });

  it("preenche todos os campos mapeados e dispara eventos de formulário", async () => {
    const email = document.querySelector("#email");
    const cpf = document.querySelector("#cpf");
    const uf = document.querySelector("#uf");
    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    [email, cpf, uf].forEach((element) => {
      element.addEventListener("input", inputEvents);
      element.addEventListener("change", changeEvents);
    });

    const response = await sendContentMessage({
      action: ACTIONS.FILL_ALL,
      fields: [
        { selector: "#email", value: "qa@example.test" },
        { selector: "#cpf", value: "123.456.789-09" },
        { selector: "#uf", value: "CE" }
      ]
    });

    expect(response).toEqual({ filled: 3, total: 3 });
    expect(email.value).toBe("qa@example.test");
    expect(cpf.value).toBe("123.456.789-09");
    expect(uf.value).toBe("CE");
    expect(inputEvents).toHaveBeenCalledTimes(3);
    expect(changeEvents).toHaveBeenCalledTimes(3);
  });

  it("exibe um botão de preenchimento junto aos campos sincronizados", async () => {
    const response = await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });

    expect(response).toEqual({ updated: true, count: 1 });
    const button = document.querySelector(".fakedata-page-fill");
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Preencher E-mail");
  });
});
