import { describe, expect, it, vi } from "vitest";
import {
  findActiveTab,
  injectContentScript,
  sendMessageToTab,
} from "../src/scripts/services/tabs-service.js";

const contentScriptTarget = { target: { tabId: 7 }, files: ["src/scripts/content.js"] };

describe("tabs-service", () => {
  describe("injectContentScript", () => {
    it("compartilha uma única injeção entre chamadas concorrentes na mesma aba", () => {
      let finishInjection = null;
      chrome.scripting.executeScript.mockImplementation((details, callback) => {
        finishInjection = callback;
      });
      const first = vi.fn();
      const second = vi.fn();

      injectContentScript(7, first);
      injectContentScript(7, second);

      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith(contentScriptTarget, expect.any(Function));
      expect(first).not.toHaveBeenCalled();
      expect(second).not.toHaveBeenCalled();

      finishInjection();

      expect(first).toHaveBeenCalledWith(null);
      expect(second).toHaveBeenCalledWith(null);
    });

    it("libera a aba quando executeScript lança de forma síncrona", () => {
      const boom = new Error("contexto da extensão invalidado");
      chrome.scripting.executeScript.mockImplementation(() => {
        throw boom;
      });
      const callback = vi.fn();

      injectContentScript(8, callback);

      expect(callback).toHaveBeenCalledWith(boom);

      chrome.scripting.executeScript.mockImplementation((details, done) => done());
      const retry = vi.fn();

      injectContentScript(8, retry);

      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
      expect(retry).toHaveBeenCalledWith(null);
    });

    it("notifica os demais waiters quando um callback lança", () => {
      let finishInjection = null;
      chrome.scripting.executeScript.mockImplementation((details, callback) => {
        finishInjection = callback;
      });
      const failing = vi.fn(() => {
        throw new Error("popup fechado");
      });
      const other = vi.fn();

      injectContentScript(9, failing);
      injectContentScript(9, other);

      expect(() => finishInjection()).not.toThrow();
      expect(other).toHaveBeenCalledWith(null);
    });
  });

  describe("sendMessageToTab", () => {
    it("não injeta quando allowInjection é false", () => {
      const error = { message: "Receiving end does not exist" };
      chrome.runtime.lastError = error;
      const callback = vi.fn();

      sendMessageToTab(3, { action: "TEST" }, callback, false);

      expect(callback).toHaveBeenCalledWith(null, error);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("devolve a resposta sem injetar quando a mensagem funciona", () => {
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => callback({ filled: true }));
      const callback = vi.fn();

      sendMessageToTab(3, { action: "TEST" }, callback, true);

      expect(callback).toHaveBeenCalledWith({ filled: true }, null);
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("injeta o content script e reenvia quando a primeira mensagem falha", () => {
      let attempts = 0;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        attempts += 1;
        if (attempts === 1) {
          chrome.runtime.lastError = { message: "Receiving end does not exist" };
          callback(undefined);
          chrome.runtime.lastError = null;
          return;
        }
        callback({ filled: true });
      });
      chrome.scripting.executeScript.mockImplementation((details, done) => {
        chrome.runtime.lastError = null;
        done();
      });
      const callback = vi.fn();

      sendMessageToTab(3, { action: "TEST" }, callback, true);

      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith({ filled: true }, null);
    });

    it("devolve o erro de injeção sem reenviar", () => {
      chrome.runtime.lastError = { message: "Receiving end does not exist" };
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => callback(undefined));
      chrome.scripting.executeScript.mockImplementation((details, done) => {
        chrome.runtime.lastError = { message: "Cannot access contents of the page" };
        done();
      });
      const callback = vi.fn();

      sendMessageToTab(3, { action: "TEST" }, callback, true);

      expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({ message: "Cannot access contents of the page" }));
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("findActiveTab", () => {
    it("prioriza a aba ativa dentro da base selecionada", () => {
      chrome.tabs.query.mockImplementation((queryInfo, callback) => callback([
        { id: 1, url: "https://outro.test/x", active: true },
        { id: 2, url: "https://app.test/a" },
        { id: 3, url: "https://app.test/b", active: true },
        { id: 4, url: "chrome://extensions" },
      ]));
      const callback = vi.fn();

      findActiveTab("https://app.test", callback);

      expect(callback).toHaveBeenCalledWith({ id: 3, url: "https://app.test/b", active: true });
    });

    it("usa a primeira aba web quando nenhuma está ativa", () => {
      chrome.tabs.query.mockImplementation((queryInfo, callback) => callback([
        { id: 1, url: "https://primeira.test/a" },
        { id: 2, url: "https://segunda.test/b" },
      ]));
      const callback = vi.fn();

      findActiveTab("", callback);

      expect(callback).toHaveBeenCalledWith({ id: 1, url: "https://primeira.test/a" });
    });

    it("devolve null quando não há aba HTTP(S)", () => {
      chrome.tabs.query.mockImplementation((queryInfo, callback) => callback([
        { id: 1, url: "chrome://extensions" },
        { id: 2, url: "about:blank" },
        null,
      ]));
      const callback = vi.fn();

      findActiveTab("", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("devolve null quando chrome.tabs.query não devolve abas", () => {
      chrome.tabs.query.mockImplementation((queryInfo, callback) => callback(null));
      const callback = vi.fn();

      findActiveTab("https://app.test", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("devolve null sem chrome.tabs.query", () => {
      const tabs = chrome.tabs;
      chrome.tabs = undefined;
      const callback = vi.fn();

      try {
        findActiveTab("https://app.test", callback);
      } finally {
        chrome.tabs = tabs;
      }

      expect(callback).toHaveBeenCalledWith(null);
    });
  });
});
