import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click } from "./helpers/interaction.js";

let dom;
let chromeMock;
let appUtils;
let closeSpy;

beforeEach(async () => {
  dom = createPopupDOM();
  chromeMock = createChromeMock({ scanFields: scannedFields });
  appUtils = await loadApp(chromeMock);
  closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});
});

afterEach(() => {
  appUtils.cleanup();
});

describe("popup app - maximizar e fechar painel", () => {
  it("fecha o painel usando o ID real da janela ao abrir em uma aba", async () => {
    click("#maximize-button");
    await nextTick();

    expect(chromeMock.sidePanel.close).toHaveBeenCalledWith({ windowId: 1 });
    expect(closeSpy).toHaveBeenCalled();
  });

  it("registra erro ao falhar a abertura da extensão em uma nova aba", () => {
    chromeMock.tabs.create.mockImplementation((options, callback) => {
      chromeMock.runtime.lastError = { message: "sem permissão" };
      callback();
      chromeMock.runtime.lastError = null;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    click("#maximize-button");

    expect(errorSpy).toHaveBeenCalledWith(
      "Não foi possível abrir a extensão em uma nova aba.",
      expect.objectContaining({ message: "sem permissão" })
    );
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("fecha a janela quando sidePanel não está disponível", () => {
    delete chromeMock.sidePanel;

    click("#maximize-button");

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("fecha a janela quando getCurrent não devolve uma janela válida", () => {
    chromeMock.windows.getCurrent.mockImplementation((callback) => {
      chromeMock.runtime.lastError = { message: "sem janela" };
      callback(null);
      chromeMock.runtime.lastError = null;
    });

    click("#maximize-button");

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(chromeMock.sidePanel.close).not.toHaveBeenCalled();
  });

  it("registra erro inesperado ao fechar o painel lateral e ainda fecha a janela", async () => {
    chromeMock.sidePanel.close.mockImplementation(() => Promise.reject(new Error("falha inesperada")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    click("#maximize-button");
    await nextTick();
    await nextTick();

    expect(errorSpy).toHaveBeenCalledWith(
      "Não foi possível fechar o painel lateral.",
      expect.objectContaining({ message: "falha inesperada" })
    );
    expect(closeSpy).toHaveBeenCalled();
  });
});
