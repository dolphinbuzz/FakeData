import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click } from "./helpers/interaction.js";

let appUtils;
let chromeMock;

async function setup(overrides = {}) {
  createPopupDOM();
  chromeMock = createChromeMock(overrides);
  appUtils = await loadApp(chromeMock);
  return chromeMock;
}

// Substitui a resposta padrão do content script por uma resposta pontual.
function answerWith(handler) {
  chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
    const response = handler(message);
    callback(response === undefined ? {} : response);
  });
}

function getEmptyState() {
  return document.querySelector("#empty-state");
}

afterEach(() => {
  if (appUtils) appUtils.cleanup();
  appUtils = null;
  chromeMock = null;
});

describe("popup app - empty state do painel de campos", () => {
  it("oculta o bloco depois que um novo escaneamento encontra campos", async () => {
    await setup({ scanFields: [] });
    expect(getEmptyState().hidden).toBe(false);

    answerWith((message) => (
      message.action === ACTIONS.SCAN_FIELDS ? { fields: scannedFields } : undefined
    ));
    click("#scan-fields-button");
    await nextTick();

    expect(getEmptyState().hidden).toBe(true);
  });

  it("exibe o bloco com a mensagem de página sem campos", async () => {
    await setup({ scanFields: [] });

    expect(getEmptyState().hidden).toBe(false);
    expect(document.querySelector("#empty-state-title").textContent).toBe(
      "Nenhum campo encontrado nesta página"
    );
    expect(document.querySelector("#empty-state-subtitle").textContent).toContain(
      "não possui inputs, selects ou textareas detectáveis"
    );
  });

  it("exibe o bloco com a mensagem de página inacessível quando não há aba HTTP disponível", async () => {
    await setup({ scanFields: [], activeTab: { id: 11, url: "chrome://extensions/" } });

    expect(getEmptyState().hidden).toBe(false);
    expect(document.querySelector("#empty-state-title").textContent).toBe(
      "Nenhuma página acessível"
    );
    expect(document.querySelector("#empty-state-subtitle").textContent).toContain(
      "Páginas internas do navegador"
    );
  });

  it("oculta o bloco assim que um seletor é adicionado à página", async () => {
    await setup({ scanFields: [] });
    answerWith((message) => (
      message.action === ACTIONS.CAPTURE_NEXT_CLICK
        ? { captured: true, field: { ...scannedFields[0] } }
        : undefined
    ));

    expect(getEmptyState().hidden).toBe(false);
    click("#add-selector-button");
    await nextTick();

    expect(getEmptyState().hidden).toBe(true);
  });

  // jsdom não aplica o popup.css externo, então a regra que reafirma o atributo
  // `hidden` (vencendo o `display: flex` do bloco) precisa de uma guarda estática.
  it("mantém a regra CSS que faz o atributo hidden valer no bloco", () => {
    const css = readFileSync(resolve("src/styles/popup.css"), "utf8");

    expect(css).toMatch(/\.empty-state\[hidden\][^{]*\{[^}]*display\s*:\s*none\b/);
  });
});
