import { vi } from "vitest";
import { ACTIONS } from "../../src/scripts/messages.js";

/**
 * Cria um mock do chrome configurável para testes.
 * O mock registra chamadas e permite configurar respostas para tabs.sendMessage
 * (necessário para simular comunicação com content script).
 */
export function createChromeMock(overrides = {}) {
  const {
    scanFields = [],
    profiles = [],
    vehicleCatalog = [],
    activeTab = { id: 10, url: "https://sistema.example.test/cadastro?etapa=1#dados" },
    openTabs = [activeTab],
    windowType = "tab",
    runtimeId = "test-extension-id",
    sidePanelOpen = true,
    scriptingExecuteScript = true,
    // Respostas configuráveis para tabs.sendMessage
    sendMessageResponses = {
      [ACTIONS.SCAN_FIELDS]: { fields: scanFields },
      [ACTIONS.FILL_ALL]: (message) => ({ filled: message.fields?.length || 0, total: message.fields?.length || 0, failed: [] }),
      [ACTIONS.FILL_FIELD]: { filled: true },
      [ACTIONS.MARK_FIELD]: { marked: true },
      [ACTIONS.UNMARK_FIELD]: { unmarked: true },
      [ACTIONS.HIGHLIGHT_FIELD]: { highlighted: true },
      [ACTIONS.MARK_ALL_FIELDS]: { marked: scanFields.length, total: scanFields.length, failed: [] },
      [ACTIONS.UNMARK_ALL_FIELDS]: { unmarked: scanFields.length, total: scanFields.length },
      [ACTIONS.COUNT_SELECTOR_MATCHES]: { count: 0 },
      [ACTIONS.MARK_SELECTOR_MATCHES]: { count: 0 },
      [ACTIONS.UNMARK_SELECTOR_MATCHES]: { count: 0 },
      [ACTIONS.CAPTURE_NEXT_CLICK]: { captured: false },
      [ACTIONS.UPDATE_PAGE_FIELD_CONTROLS]: { updated: true, count: 0 },
      [ACTIONS.SET_PAGE_FIELD_CONTROLS_VISIBILITY]: { updated: true, count: 0 },
    },
  } = overrides;

  const sentMessages = [];
  let appMessageListener = null;

  const storageData = {
    "fakedata-field-mappings": profiles.length
      ? { "https://sistema.example.test": { pages: profiles } }
      : {},
    "fakedata-vehicle-catalog": vehicleCatalog,
    "fakedata-floating-controls": true,
  };

  const chrome = {
    runtime: {
      lastError: null,
      id: runtimeId,
      getURL: vi.fn((filePath) => `chrome-extension://test/${filePath}`),
      onMessage: {
        addListener: vi.fn((listener) => { appMessageListener = listener; }),
        removeListener: vi.fn((listener) => {
          if (appMessageListener === listener) appMessageListener = null;
        }),
      },
      sendMessage: vi.fn((message, callback) => {
        sentMessages.push({ message: clone(message) });
        if (typeof callback === "function") callback({});
      }),
    },
    windows: {
      WINDOW_ID_CURRENT: 1,
      getCurrent: vi.fn((callback) => callback({ id: 1, type: windowType })),
    },
    tabs: {
      onActivated: { addListener: vi.fn() },
      query: vi.fn((queryInfo, callback) => callback(openTabs)),
      sendMessage: vi.fn((tabId, message, callback) => {
        sentMessages.push({ tabId, message: clone(message) });
        const action = message?.action;
        const responseFactory = sendMessageResponses[action];
        let response = {};
        if (typeof responseFactory === "function") {
          response = responseFactory(message);
        } else if (responseFactory !== undefined) {
          response = clone(responseFactory);
        }
        if (typeof callback === "function") callback(response);
      }),
      create: vi.fn((createProperties, callback) => {
        if (typeof callback === "function") callback({ id: 2, url: createProperties.url });
      }),
    },
    storage: {
      local: {
        get: vi.fn((defaults, callback) => {
          const result = { ...clone(defaults), ...clone(storageData) };
          if (typeof callback === "function") callback(result);
        }),
        set: vi.fn((items, callback = () => {}) => {
          Object.assign(storageData, clone(items));
          callback();
        }),
      },
    },
    sidePanel: {
      open: vi.fn(() => Promise.resolve(sidePanelOpen ? undefined : Promise.reject(new Error("unavailable")))),
      close: vi.fn(() => Promise.resolve()),
    },
    scripting: {
      executeScript: vi.fn((details, callback) => {
        if (scriptingExecuteScript && typeof callback === "function") callback();
        else if (!scriptingExecuteScript && typeof callback === "function") {
          chrome.runtime.lastError = { message: "Cannot access contents" };
          callback();
          chrome.runtime.lastError = null;
        }
      }),
    },
  };

  // Expor utilitários para testes
  chrome.__testUtils = {
    getSentMessages: () => clone(sentMessages),
    clearSentMessages: () => { sentMessages.length = 0; },
    getAppMessageListener: () => appMessageListener,
    getStorageData: () => clone(storageData),
    setStorageData: (data) => { Object.assign(storageData, data); },
    simulatePageChange: (changeType, url = activeTab.url) => {
      if (appMessageListener) {
        appMessageListener(
          { action: ACTIONS.PAGE_CONTENT_CHANGED, changeType, url },
          { tab: { id: activeTab.id, url: activeTab.url } }
        );
      }
    },
  };

  return chrome;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}