import { getBaseUrl } from "../domain/url-utils.js";

// Injeções em andamento por aba (tabId -> callbacks aguardando o fim da injeção).
// Serializa a injeção sob demanda: chamadas concorrentes na mesma aba compartilham
// uma única execução de content.js e são notificadas juntas ao terminar.
const pendingInjections = new Map();

export function injectContentScript(tabId, callback) {
  const waiters = pendingInjections.get(tabId);
  if (waiters) {
    waiters.push(callback);
    return;
  }
  pendingInjections.set(tabId, [callback]);

  // Remove a entrada do Map ANTES de notificar: libera a aba para uma nova injeção e evita
  // que um waiter com exceção impeça a notificação dos demais.
  const notifyWaiters = (injectionError) => {
    const pendingWaiters = pendingInjections.get(tabId) || [];
    pendingInjections.delete(tabId);
    pendingWaiters.forEach((waiter) => {
      try {
        waiter(injectionError);
      } catch (_error) {
        // Waiter já invalidado (ex.: popup fechado); segue notificando os restantes.
      }
    });
  };

  try {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/scripts/content.js"]
    }, () => {
      // lastError só está disponível de forma síncrona dentro deste callback.
      notifyWaiters(chrome.runtime.lastError || null);
    });
  } catch (error) {
    // executeScript pode lançar de forma síncrona (ex.: contexto da extensão invalidado);
    // sem este catch a entrada do Map ficaria órfã e a aba nunca mais seria injetada.
    notifyWaiters(error);
  }
}

export function sendMessageToTab(tabId, message, callback, allowInjection) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const error = chrome.runtime.lastError;
    if (!error) {
      callback(response, null);
      return;
    }

    if (!allowInjection || !chrome.scripting || !chrome.scripting.executeScript) {
      callback(null, error);
      return;
    }
    injectContentScript(tabId, (injectionError) => {
      if (injectionError) {
        callback(null, injectionError);
        return;
      }
      sendMessageToTab(tabId, message, callback, false);
    });
  });
}

export function findActiveTab(selectedBaseUrl, callback) {
  if (!chrome.tabs || !chrome.tabs.query) {
    callback(null);
    return;
  }
  chrome.tabs.query({}, (tabs) => {
    const webTabs = (tabs || []).filter((tab) => tab && /^https?:/i.test(tab.url || ""));
    const selectedTabs = selectedBaseUrl
      ? webTabs.filter((tab) => getBaseUrl(tab.url) === selectedBaseUrl)
      : webTabs;
    callback(selectedTabs.find((tab) => tab.active) || selectedTabs[0] || null);
  });
}
