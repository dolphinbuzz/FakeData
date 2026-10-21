import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, pressShortcut, expectSentAction, getPageFieldsStatus, getLastSentMessage } from "./helpers/interaction.js";

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

describe("popup app - tema, abas e clipboard", () => {
  it("altera tema, abas e copia um resultado gerado", async () => {
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

  it("copia o JSON de locators e responde a falha ao abrir o painel", async () => {
    click("#copy-audit-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("cadastro-e-mail-email"));

    chromeMock.sidePanel.open.mockRejectedValueOnce(new Error("painel indisponível"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    click("#open-sidepanel-button");
    await nextTick();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("popup app - modo popup vs aba dedicada", () => {
  it("abre o pop-up compacto diretamente em Mapear campos", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: scannedFields, windowType: "popup" });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

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
    expect(document.documentElement.dataset.extensionMode).toBeUndefined();
    expect(getComputedStyle(document.querySelector("#generator-tab")).display).not.toBe("none");
    expect(getComputedStyle(document.querySelector("#playground-mapping-tab")).display).not.toBe("none");
    expect(getComputedStyle(document.querySelector("#save-mappings-button")).display).not.toBe("none");
  });

  it("trata ausência de chrome.windows na detecção de popup", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: scannedFields });
    delete chromeMock.windows.getCurrent;
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    expect(document.documentElement.dataset.extensionMode).toBeUndefined();
    expect(document.querySelector("#generator-tab").hidden).toBe(false);
    expect(document.querySelector("#playground-mapping-tab").hidden).toBe(false);
  });
});

describe("popup app - mudança de base URL e abas", () => {
  it("lista bases registráveis sem duplicar subdomínios", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      openTabs: [
        { id: 10, url: "https://www.exemplo.com.br/cadastro", active: true },
        { id: 11, url: "https://app.exemplo.com.br/outra" },
        { id: 12, url: "https://www.outro.com/login" },
        { id: 13, url: "chrome://settings/" },
      ],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    expect([...document.querySelectorAll("#base-url-select option")].map((o) => o.value))
      .toEqual(["https://exemplo.com.br", "https://outro.com"]);
  });

  it("troca a página monitorada ao selecionar outra base", async () => {
    appUtils.cleanup();
    const tabs = [
      { id: 10, url: "https://www.exemplo.com.br/cadastro", active: true },
      { id: 11, url: "https://app.outro.com/login" },
    ];
    chromeMock = createChromeMock({ scanFields: scannedFields, openTabs: tabs });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    appUtils.clearSentMessages();
    const select = document.querySelector("#base-url-select");
    select.value = "https://outro.com";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(chromeMock.tabs.query).toHaveBeenCalled();
    expect(expectSentAction(chromeMock, ACTIONS.SCAN_FIELDS)).toBe(true);
    const scanMsg = getLastSentMessage(chromeMock, ACTIONS.SCAN_FIELDS);
    expect(scanMsg).toBeTruthy();
  });

  it("ignora alterações de outra aba ou de outra base", async () => {
    const listener = appUtils.getAppMessageListener();
    appUtils.clearSentMessages();

    listener(
      { action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "dom", url: "https://outro.com/pagina" },
      { tab: { id: 99, url: "https://outro.com/pagina" } }
    );

    expect(appUtils.getSentMessages().filter((m) => m.message.action === ACTIONS.SCAN_FIELDS)).toHaveLength(0);
  });
});