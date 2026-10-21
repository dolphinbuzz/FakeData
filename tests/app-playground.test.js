import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, expectSentAction, getLastSentMessage, getPageFieldsStatus } from "./helpers/interaction.js";

let dom;
let chromeMock;
let appUtils;

beforeEach(async () => {
  dom = createPopupDOM();
  chromeMock = createChromeMock({ scanFields: scannedFields });
  appUtils = await loadApp(chromeMock);
});

afterEach(() => {
  appUtils.cleanup();
});

describe("popup app - playground de seletores", () => {
  it("verifica, marca e captura seletores no playground", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      appUtils.getSentMessages().push({ tabId, message: message });
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: scannedFields });
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
    expect(getPageFieldsStatus()).toBe("2 elemento(s) encontrado(s) marcado(s).");

    click("#selector-playground-mark");
    expect(getPageFieldsStatus()).toBe("Marcações do seletor removidas.");

    click("#selector-playground-target");
    expect(input.value).toBe(".captured");
  });

  it("marca todos os campos, desmarca e atualiza um seletor capturado", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      appUtils.getSentMessages().push({ tabId, message: message });
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: scannedFields });
      else if (message.action === ACTIONS.MARK_ALL_FIELDS) callback({ selectors: message.selectors, marked: 2, total: 2 });
      else if (message.action === ACTIONS.UNMARK_ALL_FIELDS) callback({ selectors: [], marked: 0, total: 2 });
      else if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: true, field: { selector: "#novo", label: "Novo", inferredType: "text" } });
      else callback({});
    });

    click("#mark-all-button");
    expect(getPageFieldsStatus()).toBe("Todos os campos foram marcados.");

    click("#mark-all-button");
    expect(getPageFieldsStatus()).toBe("Todos os campos foram desmarcados.");

    click(".page-field [data-action='target']");
    expect(document.querySelector(".page-field-selector").value).toBe("#novo");
    expect(getPageFieldsStatus()).toContain("Seletor capturado");
  });

  it("trata seletor vazio, inválido e sem correspondências no playground", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
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

  it("reporta inválido quando não há página ativa no playground", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      openTabs: [{ id: 1, url: "chrome://settings/", active: true }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("#playground-mapping-tab");
    const input = document.querySelector("#selector-playground-input");
    input.value = ".campo";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelector("#selector-playground-count").textContent).toBe("Inválido");
    expect(document.querySelector("#selector-playground-mark").disabled).toBe(true);
  });

  it("desmarca o seletor anterior ao trocar o valor do playground", async () => {
    const sent = [];
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      sent.push({ tabId, message });
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: scannedFields });
      else if (message.action === ACTIONS.COUNT_SELECTOR_MATCHES) callback({ count: 2 });
      else if (message.action === ACTIONS.MARK_SELECTOR_MATCHES) callback({ count: 2 });
      else if (message.action === ACTIONS.UNMARK_SELECTOR_MATCHES) callback({ count: 0 });
      else callback({});
    });

    click("#playground-mapping-tab");
    const input = document.querySelector("#selector-playground-input");
    input.value = ".field";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    click("#selector-playground-mark");
    expect(getPageFieldsStatus()).toBe("2 elemento(s) encontrado(s) marcado(s).");

    input.value = ".outro";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const unmark = sent.find((item) => item.message.action === ACTIONS.UNMARK_SELECTOR_MATCHES);
    expect(unmark.message.selector).toBe(".field");
    expect(document.querySelector("#selector-playground-count").textContent).toBe("2 encontrado(s)");
  });

  it("reporta falha ao alternar marcações do playground", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.COUNT_SELECTOR_MATCHES) callback({ count: 2 });
      else if (message.action === ACTIONS.MARK_SELECTOR_MATCHES) callback(null);
      else callback({});
    });

    click("#playground-mapping-tab");
    const input = document.querySelector("#selector-playground-input");
    input.value = ".field";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#selector-playground-mark").disabled).toBe(false);

    click("#selector-playground-mark");

    expect(getPageFieldsStatus()).toBe("Não foi possível atualizar as marcações do seletor.");
  });

  it("reporta falha ao capturar seletor no playground", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback(null);
      else callback({});
    });

    click("#playground-mapping-tab");
    click("#selector-playground-target");

    expect(document.querySelector("#selector-playground-count").textContent).toBe("Não capturado");
  });
});