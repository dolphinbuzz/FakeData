import { vi } from "vitest";

/**
 * Carrega o app.js no DOM atual e retorna utilitários de cleanup.
 * Deve ser chamado dentro de beforeEach/afterEach.
 */
export async function loadApp(chromeMock) {
  vi.resetModules();
  globalThis.chrome = chromeMock;
  await import("../../src/scripts/app.js");
  await nextTick();

  return {
    cleanup: () => {
      vi.restoreAllMocks();
      if (globalThis.window?.close) globalThis.window.close();
      delete globalThis.chrome;
    },
    getSentMessages: () => chromeMock.__testUtils.getSentMessages(),
    clearSentMessages: () => chromeMock.__testUtils.clearSentMessages(),
    getStorageData: () => chromeMock.__testUtils.getStorageData(),
    getAppMessageListener: () => chromeMock.__testUtils.getAppMessageListener(),
    simulatePageChange: (changeType, url) => chromeMock.__testUtils.simulatePageChange(changeType, url),
  };
}

export function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function advanceTimers(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}