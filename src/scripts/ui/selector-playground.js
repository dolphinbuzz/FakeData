import { ACTIONS } from "../messages.js";

export function initSelectorPlayground({ state, refs, sendToPage }) {
  const { input, targetButton, count, markButton, pageFieldsStatus } = refs;

  function checkMatches() {
    const selector = input ? input.value.trim() : "";
    if (state.selectorPlaygroundMarked && selector !== state.selectorPlaygroundMarkedSelector) {
      sendToPage({ action: ACTIONS.UNMARK_SELECTOR_MATCHES, selector: state.selectorPlaygroundMarkedSelector }, () => {});
      state.selectorPlaygroundMarked = false;
      state.selectorPlaygroundMarkedSelector = "";
    }
    if (!selector) {
      if (count) count.textContent = "—";
      state.selectorPlaygroundMarked = false;
      updateMarkButton(0);
      return;
    }
    sendToPage({ action: ACTIONS.COUNT_SELECTOR_MATCHES, selector }, (response, error) => {
      if (!count) return;
      const valid = !error && response && !response.invalid;
      count.textContent = !valid
        ? "Inválido"
        : `${response.count} encontrado(s)`;
      if (!valid || response.count === 0) state.selectorPlaygroundMarked = false;
      updateMarkButton(valid ? response.count : 0);
    });
  }

  function updateMarkButton(matchCount) {
    if (!markButton) return;
    markButton.disabled = matchCount === 0;
    markButton.textContent = state.selectorPlaygroundMarked ? "Desmarcar encontrados" : "Marcar encontrados";
  }

  function toggleMatches() {
    const selector = input ? input.value.trim() : "";
    if (!selector) return;
    const action = state.selectorPlaygroundMarked ? ACTIONS.UNMARK_SELECTOR_MATCHES : ACTIONS.MARK_SELECTOR_MATCHES;
    sendToPage({ action, selector }, (response, error) => {
      if (error || !response) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações do seletor.";
        return;
      }
      state.selectorPlaygroundMarked = !state.selectorPlaygroundMarked;
      state.selectorPlaygroundMarkedSelector = state.selectorPlaygroundMarked ? selector : "";
      updateMarkButton(response.count || 0);
      if (pageFieldsStatus) {
        pageFieldsStatus.textContent = state.selectorPlaygroundMarked
          ? `${response.count} elemento(s) encontrado(s) marcado(s).`
          : "Marcações do seletor removidas.";
      }
    });
  }

  function captureSelector() {
    if (count) count.textContent = "...";
    sendToPage({ action: ACTIONS.CAPTURE_NEXT_CLICK }, (response, error) => {
      if (error || !response || !response.captured || !response.field) {
        if (count) count.textContent = "Não capturado";
        return;
      }
      if (input) input.value = response.field.selector;
      checkMatches();
    });
  }

  function reset() {
    if (input) input.value = "";
    if (count) count.textContent = "—";
    state.selectorPlaygroundMarked = false;
    state.selectorPlaygroundMarkedSelector = "";
    updateMarkButton(0);
  }

  if (input) input.addEventListener("input", checkMatches);
  if (targetButton) targetButton.addEventListener("click", captureSelector);
  if (markButton) markButton.addEventListener("click", toggleMatches);

  return { checkMatches, reset, toggleMatches, captureSelector, updateMarkButton };
}
