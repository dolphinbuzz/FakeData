import { vi } from "vitest";

/**
 * Clica em um elemento via seletor.
 */
export function click(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  element.click();
}

/**
 * Dispara evento de teclado (para atalhos Alt+Shift+Key).
 */
export function pressShortcut(key, target = document.body) {
  target.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  }));
}

/**
 * Define valor de input e dispara eventos.
 */
export function type(selector, value) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Seleciona opção em select.
 */
export function selectOption(selector, value) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Select não encontrado: ${selector}`);
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Aguarda próximo tick do event loop.
 */
export async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Verifica se mensagem foi enviada com action específica.
 */
export function expectSentAction(chromeMock, action) {
  const messages = chromeMock.__testUtils.getSentMessages();
  return messages.some((m) => m.message?.action === action);
}

/**
 * Obtém última mensagem enviada com action específica.
 */
export function getLastSentMessage(chromeMock, action) {
  const messages = chromeMock.__testUtils.getSentMessages();
  return messages
    .filter((m) => m.message?.action === action)
    .pop()?.message;
}

/**
 * Verifica valores dos campos de resultado no painel generator.
 */
export function getResultFieldValues() {
  return [...document.querySelectorAll("#result-fields .field-value")].map((el) => el.textContent);
}

/**
 * Verifica mensagem de status da página.
 */
export function getPageFieldsStatus() {
  const el = document.querySelector("#page-fields-status");
  return el ? el.textContent : null;
}

/**
 * Verifica campos mapeados renderizados.
 */
export function getMappedFields() {
  return [...document.querySelectorAll(".page-field")].map((field) => ({
    label: field.querySelector(".page-field-label")?.textContent,
    selector: field.querySelector(".page-field-selector")?.value,
    type: field.querySelector(".page-field-type")?.value,
    fixed: field.querySelector(".page-field-fixed-toggle")?.checked,
    fixedValue: field.querySelector(".page-field-fixed-value")?.value,
  }));
}