import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { vi } from "vitest";

const popupHtml = readFileSync(resolve("src/popup.html"), "utf8")
  .replace(/<script type="module" src="scripts\/app\.js"><\/script>/, "");

export function createPopupDOM(overrides = {}) {
  const html = overrides.html || popupHtml;
  const dom = new JSDOM(html, {
    url: overrides.url || "https://extension.test/src/popup.html",
    pretendToBeVisual: true,
  });

  // Configurar globals
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;

  // Clipboard mock
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });

  // localStorage
  globalThis.localStorage = dom.window.localStorage;

  // Element helpers
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  dom.window.HTMLElement.prototype.scrollIntoView = vi.fn();

  return dom;
}

export function createContentPageDOM(overrides = {}) {
  const html = overrides.html || `<!doctype html><body>
    <form>
      <label for="email">E-mail</label><input id="email" type="email" autocomplete="email">
      <label for="cpf">CPF</label><input id="cpf" name="cpf">
      <label for="uf">Estado</label><select id="uf"><option value="">Selecione</option><option value="CE">CE</option><option value="SP">SP</option></select>
    </form>
  </body>`;

  const dom = new JSDOM(html, {
    url: overrides.url || "https://sistema.example.test/cadastro",
    pretendToBeVisual: true,
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
  dom.window.HTMLElement.prototype.scrollIntoView = vi.fn();

  return dom;
}

export const scannedFields = [
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
    locatorName: "cadastro-e-mail-email",
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
    locatorName: "cadastro-cpf-text",
  },
];