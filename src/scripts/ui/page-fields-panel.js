// Painel de campos da página: escaneamento, renderização, ações por campo,
// marcação, preenchimento e limpeza. Extraído do `app.js` na Fase 2.
import { filterMappingTypes, MAPPING_TYPES } from "../data/mapping-types.js";
import { ACTIONS } from "../messages.js";
import { escapeHtml } from "../domain/html-utils.js";
import { mergeScannedFields } from "../domain/field-merge.js";
import { normalizePageUrl, getBaseUrl } from "../domain/url-utils.js";
import { auditJson } from "../domain/mapping-audit.js";

/**
 * Cria o painel de campos e registra seus listeners.
 *
 * O módulo não conhece o bootstrap da extensão: recebe o store, as referências
 * de DOM já resolvidas e callbacks de orquestração (mensageria, perfis e
 * geração de valores). Retorna apenas a API usada pelo `app.js`.
 */
export function initPageFieldsPanel({
  state,
  refs,
  sendToPage,
  getActiveTab,
  readProfiles,
  updateSavedProfiles,
  getCurrentProfile,
  openMappingModal,
  persistPageMapping,
  persistFloatingControls,
  copyText,
  generateFieldValue,
  generateAllFieldValues
}) {
  const {
    pageFieldsElement,
    pageFieldsStatus,
    emptyStateElement,
    emptyStateTitle,
    emptyStateSubtitle,
    scanFieldsButton,
    emptyStateScanButton,
    addSelectorButton,
    markAllButton,
    saveMappingsButton,
    fillAllButton,
    clearAllButton,
    floatingControlsToggle,
    remapAllButton,
    baseUrlSelect,
    copyAuditButton
  } = refs;

  function getTypeOptionsMarkup(field, query = "") {
    return filterMappingTypes(query).map(([value, label]) =>
      `<button type="button" class="page-field-type-option" role="option" aria-selected="${field.dataType === value}" value="${escapeHtml(value)}">${escapeHtml(label)}</button>`
    ).join("");
  }

  function renderTypeOptions(control, field, query = "") {
    const options = control.querySelector(".page-field-type-options");
    const noResults = control.querySelector(".page-field-type-no-results");
    const matches = filterMappingTypes(query);
    if (options) options.innerHTML = getTypeOptionsMarkup(field, query);
    if (noResults) noResults.hidden = matches.length > 0;
  }

  function closeTypeMenu(control, returnFocus = false) {
    const trigger = control && control.querySelector(".page-field-type");
    const menu = control && control.querySelector(".page-field-type-menu");
    if (!trigger || !menu) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  }

  function closeOtherTypeMenus(exceptControl = null) {
    if (!pageFieldsElement) return;
    pageFieldsElement.querySelectorAll(".page-field-type-control").forEach((control) => {
      if (control !== exceptControl) closeTypeMenu(control);
    });
  }

  function toggleTypeMenu(control, field) {
    const trigger = control.querySelector(".page-field-type");
    const menu = control.querySelector(".page-field-type-menu");
    const search = control.querySelector(".page-field-type-search");
    if (!trigger || !menu || !search) return;
    if (!menu.hidden) {
      closeTypeMenu(control, true);
      return;
    }

    closeOtherTypeMenus(control);
    search.value = "";
    renderTypeOptions(control, field);
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.focus();
  }

  function selectTypeOption(option, field) {
    const control = option.closest(".page-field-type-control");
    const trigger = control && control.querySelector(".page-field-type");
    const value = option.value;
    const selectedType = MAPPING_TYPES.find(([type]) => type === value);
    if (!trigger || !selectedType) return;

    field.dataType = value;
    trigger.value = value;
    trigger.querySelector(".page-field-type-value").textContent = selectedType[1];
    closeTypeMenu(control, true);
  }

  function handleTypeMenuOutsideClick(event) {
    if (!event.target.closest(".page-field-type-control")) closeOtherTypeMenus();
  }

  function renderEmptyState() {
    if (!emptyStateElement || !emptyStateTitle || !emptyStateSubtitle) return;

    const hasFields = state.pageFields.length > 0;
    const hasPageUrl = Boolean(state.activePageUrl);

    // O bloco só existe para orientar quando não há campos mapeados.
    emptyStateElement.hidden = hasFields;

    if (hasPageUrl) {
      emptyStateTitle.textContent = "Nenhum campo encontrado nesta página";
      emptyStateSubtitle.textContent = "A página carregada não possui inputs, selects ou textareas detectáveis. Tente recarregar a página ou verificar se o formulário está visível.";
      return;
    }

    emptyStateTitle.textContent = "Nenhuma página acessível";
    emptyStateSubtitle.textContent = "Abra uma página HTTP(S) com um formulário para começar. Páginas internas do navegador (chrome://, edge://) não são suportadas.";
  }

  function clearAllPageFields() {
    if (!state.pageFields.length) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum preenchimento para limpar.";
      return;
    }

    const selectors = state.pageFields.map((field) => field.selector);
    sendToPage({ action: ACTIONS.CLEAR_PAGE_FIELDS, selectors }, (response, error) => {
      if (error || !response || response.error) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível limpar os campos desta página.";
        return;
      }
      const failed = Array.isArray(response.failed) ? response.failed : [];
      // Inclui seletor vazio: um campo sem seletor falhou e não deve ser zerado em memória.
      const failedSelectors = new Set(
        failed
          .map((item) => (item && typeof item.selector === "string" ? item.selector : null))
          .filter((selector) => selector !== null)
      );
      state.pageFields.forEach((field) => {
        if (failedSelectors.has(field.selector)) return;
        field.value = "";
        field.fixedValue = "";
        state.markedSelectors.delete(field.selector);
      });
      updateMarkAllButton();
      renderPageFields();
      if (!pageFieldsStatus) return;
      const cleared = typeof response.cleared === "number" ? response.cleared : state.pageFields.length - failed.length;
      if (failed.length) {
        pageFieldsStatus.textContent = `${cleared} campo(s) limpado(s); ${failed.length} não foi(ram) limpo(s).`;
        return;
      }
      pageFieldsStatus.textContent = `${cleared} campo(s) limpado(s).`;
    });
  }

  function remapAllFields() {
    if (!state.pageFields.length) return;
    scanPageFields(true);
  }

  function scanPageFields(remapping = false, preserveCurrent = false) {
    if (!pageFieldsStatus) return;
    pageFieldsStatus.textContent = remapping ? "Remapeando campos automaticamente..." : "Lendo campos da página...";
    getActiveTab((tab) => {
      state.activeTab = tab;
      state.activePageUrl = normalizePageUrl(tab && tab.url ? tab.url : "");
      state.activeBaseUrl = getBaseUrl(state.activePageUrl);
      if (!state.activeTab || !state.activeTab.id || !/^https?:/i.test(state.activePageUrl)) {
        state.pageFields = [];
        renderPageFields();
        pageFieldsStatus.textContent = "A página ativa não permite acesso a formulários.";
        return;
      }
      sendToPage({ action: ACTIONS.SCAN_FIELDS }, (response, error) => {
        if (error || !response || response.error) {
          state.pageFields = [];
          renderPageFields();
          pageFieldsStatus.textContent = response && response.error
            ? response.error
            : "Não foi possível ler esta página. Recarregue-a e tente novamente.";
          return;
        }
        readProfiles(state.activeBaseUrl, (profiles) => {
          const matchingProfiles = profiles.filter((profile) => normalizePageUrl(profile.pageUrl) === state.activePageUrl);
          if (!state.selectedProfileId || !matchingProfiles.some((profile) => profile.id === state.selectedProfileId)) {
            state.selectedProfileId = matchingProfiles.length === 1 ? matchingProfiles[0].id : "";
          }
          updateSavedProfiles(profiles);
          const selected = getCurrentProfile(profiles);
          const saved = selected && selected.fields ? selected.fields : [];
          state.pageFields = mergeScannedFields({
            scanned: response.fields || [],
            saved,
            previous: preserveCurrent ? state.pageFields : [],
            remapping,
            preserveCurrent
          });
          state.markedSelectors = new Set();
          updateMarkAllButton();
          renderPageFields();
          pageFieldsStatus.textContent = state.pageFields.length
            ? `${state.pageFields.length} campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.`
            : "Nenhum campo editável encontrado nesta página.";
        });
      });
    });
  }

  function renderPageFields() {
    if (!pageFieldsElement) return;
    pageFieldsElement.innerHTML = state.pageFields.map((field, index) => {
      const options = getTypeOptionsMarkup(field);
      const selectedType = MAPPING_TYPES.find(([value]) => value === field.dataType);
      const typeLabel = selectedType ? selectedType[1] : field.dataType;
      return `
        <div class="page-field" data-index="${index}">
          <div class="page-field-heading">
            <span class="page-field-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
            <input class="page-field-label-editor" type="text" aria-label="Nome do campo mapeado" value="${escapeHtml(field.label)}" hidden>
            <button type="button" class="page-field-edit-label" title="Editar nome do campo" aria-label="Editar nome do campo">✎</button>
            ${field.selectorStatus !== "stable" || field.selectorSuggestion ? `<span class="field-warning" title="${escapeHtml(field.selectorSuggestion || "Este campo possui um problema no mapeamento.")}" aria-label="${escapeHtml(field.selectorSuggestion || "Este campo possui um problema no mapeamento.")}">!</span>` : ""}
            <span class="muted">${escapeHtml(field.inputType || field.tagName)}</span>
          </div>
          <div class="page-field-type-control">
            <button type="button" class="page-field-type" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="page-field-type-options-${index}" aria-label="Tipo para ${escapeHtml(field.label)}" value="${escapeHtml(field.dataType)}">
              <span class="page-field-type-value">${escapeHtml(typeLabel)}</span>
              <span class="page-field-type-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="page-field-type-menu" hidden>
              <input class="page-field-type-search" type="search" aria-label="Buscar tipo para ${escapeHtml(field.label)}" placeholder="Buscar tipo..." autocomplete="off">
              <div id="page-field-type-options-${index}" class="page-field-type-options" role="listbox" aria-label="Tipos para ${escapeHtml(field.label)}">${options}</div>
              <p class="page-field-type-no-results" role="status" hidden>Nenhum tipo corresponde à busca</p>
            </div>
          </div>
          <input class="page-field-selector" type="text" aria-label="Seletor para ${escapeHtml(field.label)}" value="${escapeHtml(field.selector)}">
          <label class="page-field-fixed"><input class="page-field-fixed-toggle" type="checkbox" ${field.fixed ? "checked" : ""}> Fixar valor</label>
          <input class="page-field-fixed-value" type="text" aria-label="Valor para ${escapeHtml(field.label)}" placeholder="Valor" value="${escapeHtml((field.fixed ? field.fixedValue : field.value) || "")}" ${field.fixed ? "" : "disabled"}>
          <div class="page-field-actions">
            <button type="button" data-action="highlight">${state.markedSelectors.has(field.selector) ? "Desmarcar" : "Marcar"}</button>
            <button type="button" data-action="locate" title="Localizar campo na página" aria-label="Localizar ${escapeHtml(field.label)}">⌖</button>
            <button type="button" data-action="target" title="Capturar o próximo clique na página" aria-label="Capturar seletor do próximo clique">🎯</button>
            <button type="button" data-action="fill" class="page-field-fill" title="Preencher campo com dado gerado ou valor fixado" aria-label="Preencher ${escapeHtml(field.label)}">
              <svg class="page-field-fill-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4h8v3H8zM6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"></path>
                <path d="M8 13h8M13 10l3 3-3 3"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

    syncPageFieldControls();
    renderEmptyState();
  }

  // A7: os eventos da lista são tratados por delegação no container `#page-fields`,
  // registrada uma única vez no início do módulo, não por linha renderizada.
  function getPageFieldContext(target) {
    if (!pageFieldsElement || !target || typeof target.closest !== "function") return null;
    const row = target.closest(".page-field");
    if (!row || !pageFieldsElement.contains(row)) return null;
    const field = state.pageFields[Number(row.dataset.index)];
    if (!field) return null;
    return { row, field };
  }

  function getPageFieldRow(field) {
    const index = state.pageFields.indexOf(field);
    if (index < 0 || !pageFieldsElement) return null;
    return pageFieldsElement.querySelector(`.page-field[data-index="${index}"]`);
  }

  function updatePageFieldValueInput(field, row = getPageFieldRow(field)) {
    if (!row) return;
    const input = row.querySelector(".page-field-fixed-value");
    if (input) input.value = String((field.fixed ? field.fixedValue : field.value) || "");
  }

  function updatePageFieldRowLabel(row, field) {
    const label = row.querySelector(".page-field-label");
    if (label) {
      label.textContent = field.label;
      label.title = field.label;
      label.hidden = false;
    }
    const editor = row.querySelector(".page-field-label-editor");
    if (editor) {
      editor.value = field.label;
      editor.hidden = true;
    }
    const editLabelButton = row.querySelector(".page-field-edit-label");
    if (editLabelButton) editLabelButton.hidden = false;
    const typeSelect = row.querySelector(".page-field-type");
    if (typeSelect) typeSelect.setAttribute("aria-label", `Tipo para ${field.label}`);
    const selectorInput = row.querySelector(".page-field-selector");
    if (selectorInput) selectorInput.setAttribute("aria-label", `Seletor para ${field.label}`);
    const valueInput = row.querySelector(".page-field-fixed-value");
    if (valueInput) valueInput.setAttribute("aria-label", `Valor para ${field.label}`);
    const typeSearchInput = row.querySelector(".page-field-type-search");
    if (typeSearchInput) typeSearchInput.setAttribute("aria-label", `Buscar tipo para ${field.label}`);
    const locateButton = row.querySelector('[data-action="locate"]');
    if (locateButton) locateButton.setAttribute("aria-label", `Localizar ${field.label}`);
    const fillButton = row.querySelector('[data-action="fill"]');
    if (fillButton) fillButton.setAttribute("aria-label", `Preencher ${field.label}`);
  }

  function refreshPageFieldHighlightButtons() {
    if (!pageFieldsElement) return;
    pageFieldsElement.querySelectorAll(".page-field").forEach((row) => {
      const field = state.pageFields[Number(row.dataset.index)];
      const button = row.querySelector('[data-action="highlight"]');
      if (!field || !button) return;
      button.textContent = state.markedSelectors.has(field.selector) ? "Desmarcar" : "Marcar";
    });
  }

  function startPageFieldLabelEdition(row) {
    const label = row.querySelector(".page-field-label");
    const editor = row.querySelector(".page-field-label-editor");
    const editLabelButton = row.querySelector(".page-field-edit-label");
    if (!editor) return;
    if (label) label.hidden = true;
    if (editLabelButton) editLabelButton.hidden = true;
    editor.hidden = false;
    editor.focus();
    editor.select();
  }

  function commitPageFieldLabelEdition(editor) {
    const context = getPageFieldContext(editor);
    if (!context) return;
    const value = editor.value.trim();
    if (value) context.field.label = value;
    updatePageFieldRowLabel(context.row, context.field);
    syncPageFieldControls();
  }

  function toggleFieldHighlight(field) {
    if (!field) return;
    const selector = field.selector;
    const marked = state.markedSelectors.has(selector);
    sendToPage({ action: marked ? ACTIONS.UNMARK_FIELD : ACTIONS.MARK_FIELD, selector }, (response, error) => {
      if (!pageFieldsStatus) return;
      if (error || !response) {
        pageFieldsStatus.textContent = "Não foi possível marcar o campo. Recarregue a página e tente novamente.";
      } else if (!(marked ? response.unmarked : response.marked)) {
        pageFieldsStatus.textContent = "Seletor não encontrado na página. Ajuste o seletor e tente novamente.";
      } else {
        if (marked) state.markedSelectors.delete(selector);
        else state.markedSelectors.add(selector);
        updateMarkAllButton();
        refreshPageFieldHighlightButtons();
        pageFieldsStatus.textContent = marked ? `${field.label} desmarcado.` : `${field.label} marcado.`;
      }
    });
  }

  function locatePageField(field) {
    if (!field) return;
    sendToPage({ action: ACTIONS.HIGHLIGHT_FIELD, selector: field.selector }, (response, error) => {
      if (!pageFieldsStatus) return;
      pageFieldsStatus.textContent = error || !response || !response.highlighted
        ? "Não foi possível localizar o campo na página."
        : `${field.label} localizado na página.`;
    });
  }

  function handlePageFieldClick(event) {
    const context = getPageFieldContext(event.target);
    if (!context) return;
    const typeOption = event.target.closest(".page-field-type-option");
    if (typeOption) {
      selectTypeOption(typeOption, context.field);
      return;
    }
    if (event.target.closest(".page-field-type")) {
      toggleTypeMenu(context.row.querySelector(".page-field-type-control"), context.field);
      return;
    }
    if (event.target.closest(".page-field-edit-label")) {
      startPageFieldLabelEdition(context.row);
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "highlight") {
      toggleFieldHighlight(context.field);
      return;
    }
    if (action === "locate") {
      locatePageField(context.field);
      return;
    }
    const index = state.pageFields.indexOf(context.field);
    if (index < 0) return;
    if (action === "target") captureFieldSelector(index);
    else if (action === "fill") fillPageField(index);
  }

  function handlePageFieldChange(event) {
    const context = getPageFieldContext(event.target);
    if (!context) return;
    if (event.target.matches(".page-field-fixed-toggle")) {
      context.field.fixed = event.target.checked;
      if (event.target.checked && !context.field.fixedValue) {
        context.field.fixedValue = context.field.value || "";
      }
      const valueInput = context.row.querySelector(".page-field-fixed-value");
      if (valueInput) {
        valueInput.disabled = !event.target.checked;
        valueInput.value = String((context.field.fixed ? context.field.fixedValue : context.field.value) || "");
      }
    }
  }

  function handlePageFieldInput(event) {
    const context = getPageFieldContext(event.target);
    if (!context) return;
    if (event.target.matches(".page-field-type-search")) {
      renderTypeOptions(
        context.row.querySelector(".page-field-type-control"),
        context.field,
        event.target.value
      );
    } else if (event.target.matches(".page-field-selector")) {
      context.field.selector = event.target.value;
    } else if (event.target.matches(".page-field-fixed-value") && context.field.fixed) {
      context.field.fixedValue = event.target.value;
    }
  }

  function moveTypeOptionFocus(control, currentOption, direction) {
    const options = [...control.querySelectorAll(".page-field-type-option")];
    if (!options.length) return;
    const currentIndex = options.indexOf(currentOption);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : options.length - 1
      : (currentIndex + direction + options.length) % options.length;
    options[nextIndex].focus();
  }

  function handlePageFieldKeydown(event) {
    if (!event.target || !event.target.matches) return;
    const context = getPageFieldContext(event.target);
    if (!context) return;
    if (event.target.matches(".page-field-type")) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        toggleTypeMenu(context.row.querySelector(".page-field-type-control"), context.field);
      }
      return;
    }
    if (event.target.matches(".page-field-type-search")) {
      const control = context.row.querySelector(".page-field-type-control");
      if (event.key === "Escape") {
        event.preventDefault();
        closeTypeMenu(control, true);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveTypeOptionFocus(control, null, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter") {
        const options = control.querySelectorAll(".page-field-type-option");
        if (options.length === 1) {
          event.preventDefault();
          selectTypeOption(options[0], context.field);
        } else if (options.length > 1) {
          event.preventDefault();
          options[0].focus();
        }
      }
      return;
    }
    if (event.target.matches(".page-field-type-option")) {
      const control = context.row.querySelector(".page-field-type-control");
      if (event.key === "Escape") {
        event.preventDefault();
        closeTypeMenu(control, true);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveTypeOptionFocus(control, event.target, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const options = control.querySelectorAll(".page-field-type-option");
        options[event.key === "Home" ? 0 : options.length - 1]?.focus();
      }
      return;
    }
    if (!event.target.matches(".page-field-label-editor")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.target.blur();
      return;
    }
    if (event.key === "Escape") {
      event.target.value = context.field.label;
      event.target.blur();
    }
  }

  // `blur` não borbulha; a fase de captura garante que a delegação funcione.
  function handlePageFieldBlur(event) {
    if (!event.target || !event.target.matches || !event.target.matches(".page-field-label-editor")) return;
    commitPageFieldLabelEdition(event.target);
  }

  function handlePageFieldTypeFocusOut(event) {
    const control = event.target.closest(".page-field-type-control");
    if (control && !control.contains(event.relatedTarget)) closeTypeMenu(control);
  }

  function syncPageFieldControls() {
    if (!state.activeTab) return;
    sendToPage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: state.pageFields.map((field) => ({
        key: field.key,
        selector: field.selector,
        label: field.label
      })),
      visible: state.floatingControlsVisible
    }, () => {});
  }

  function addNewSelector() {
    if (!state.activePageUrl) {
      scanPageFields();
      return;
    }
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Clique no elemento desejado da página para adicionar o seletor...";
    sendToPage({ action: ACTIONS.CAPTURE_NEXT_CLICK }, (response, error) => {
      if (error || !response || !response.captured || !response.field || !response.field.selector) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível adicionar o seletor.";
        return;
      }
      const captured = response.field;
      if (state.pageFields.some((field) => field.selector === captured.selector)) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Esse seletor já está mapeado.";
        return;
      }
      state.pageFields.push({
        ...captured,
        key: `${captured.selector}::manual-${Date.now()}`,
        label: captured.label || "Novo campo",
        dataType: captured.inferredType || "text",
        fixed: false,
        fixedValue: ""
      });
      renderPageFields();
      updateMarkAllButton();
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Seletor adicionado. Salve os seletores para mantê-lo no perfil.";
    });
  }

  function copyMappingAudit() {
    copyText(auditJson(state.pageFields), copyAuditButton);
  }

  function updateMarkAllButton() {
    if (!markAllButton) return;
    const allMarked = state.pageFields.length > 0 && state.pageFields.every((field) => state.markedSelectors.has(field.selector));
    markAllButton.textContent = allMarked ? "Desmarcar todos" : "Marcar todos";
  }

  function toggleMarkAllFields() {
    if (!state.pageFields.length) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo encontrado para marcar.";
      return;
    }
    const markableFields = state.pageFields.filter((field) => field.selector);
    if (!markableFields.length) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo possui seletor utilizável para marcar.";
      return;
    }
    const allMarked = markableFields.every((field) => state.markedSelectors.has(field.selector));
    const action = allMarked ? ACTIONS.UNMARK_ALL_FIELDS : ACTIONS.MARK_ALL_FIELDS;
    sendToPage({ action, selectors: markableFields.map((field) => field.selector) }, (response, error) => {
      if (error || !response) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações.";
        return;
      }
      state.markedSelectors = new Set(allMarked ? [] : (response.selectors || []));
      updateMarkAllButton();
      refreshPageFieldHighlightButtons();
      if (pageFieldsStatus) {
        if (allMarked) {
          pageFieldsStatus.textContent = "Todos os campos foram desmarcados.";
        } else if (response.failed && response.failed.length) {
          pageFieldsStatus.textContent = `${response.marked} de ${response.total} campo(s) marcado(s); ${response.failed.length} não foi(ram) localizado(s).`;
        } else {
          pageFieldsStatus.textContent = "Todos os campos foram marcados.";
        }
      }
    });
  }

  function captureFieldSelector(index) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Clique no elemento desejado da página...";
    sendToPage({ action: ACTIONS.CAPTURE_NEXT_CLICK }, (response, error) => {
      if (error || !response || !response.captured || !response.field) {
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível capturar um campo.";
        return;
      }
      state.pageFields[index] = {
        ...state.pageFields[index],
        selector: response.field.selector,
        label: response.field.label || state.pageFields[index].label,
        inferredType: response.field.inferredType || state.pageFields[index].inferredType,
        dataType: state.pageFields[index].dataType === "text" ? response.field.inferredType : state.pageFields[index].dataType
      };
      renderPageFields();
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Seletor capturado. Salve o mapeamento para mantê-lo.";
    });
  }

  function savePageMappings() {
    if (!state.activePageUrl || !state.pageFields.length) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum mapeamento para salvar.";
      return;
    }
    const selectedProfile = getCurrentProfile(state.savedProfiles);
    if (selectedProfile) {
      persistPageMapping(selectedProfile.name, selectedProfile.id);
      return;
    }
    openMappingModal("", "Salvar novo mapeamento").then((name) => {
      if (name) persistPageMapping(name, null);
    });
  }

  function fillPageField(index) {
    const field = state.pageFields[index];
    if (!field) return;
    const value = generateFieldValue(field);
    sendToPage({ action: ACTIONS.FILL_FIELD, selector: field.selector, value }, (response, error) => {
      if (!error && response && response.filled) {
        field.value = String(value);
        if (field.fixed) field.fixedValue = String(value);
        updatePageFieldValueInput(field);
      }
      if (pageFieldsStatus) {
        pageFieldsStatus.textContent = error || !response || !response.filled
          ? "Não foi possível preencher esse campo. Verifique o seletor."
          : `${field.label} preenchido.`;
      }
    });
  }

  function fillAllPageFields() {
    if (!state.pageFields.length) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo mapeado.";
      return;
    }
    // P1: só campos fixados participam da escolha do veículo; os demais entram
    // com `value` vazio para não influenciar a coerência marca/modelo.
    const values = generateAllFieldValues(state.pageFields);
    const fields = state.pageFields.map((field, index) => ({
      selector: field.selector,
      value: values[index]
    }));
    sendToPage({ action: ACTIONS.FILL_ALL, fields }, (response, error) => {
      if (!error && response) {
        state.pageFields.forEach((field, index) => {
          field.value = String(fields[index].value);
          if (field.fixed) field.fixedValue = String(fields[index].value);
          updatePageFieldValueInput(field);
        });
      }
      if (pageFieldsStatus) {
        pageFieldsStatus.textContent = error || !response
          ? "Não foi possível preencher os campos desta página."
          : `${response.filled} de ${response.total} campo(s) preenchido(s).`;
      }
    });
  }

  if (scanFieldsButton) scanFieldsButton.addEventListener("click", () => scanPageFields());
  if (baseUrlSelect) baseUrlSelect.addEventListener("change", () => {
    state.selectedBaseUrl = baseUrlSelect.value;
    scanPageFields();
  });
  if (emptyStateScanButton) emptyStateScanButton.addEventListener("click", () => scanPageFields());
  if (addSelectorButton) addSelectorButton.addEventListener("click", addNewSelector);
  if (markAllButton) markAllButton.addEventListener("click", toggleMarkAllFields);
  if (saveMappingsButton) saveMappingsButton.addEventListener("click", savePageMappings);
  if (fillAllButton) fillAllButton.addEventListener("click", fillAllPageFields);
  if (clearAllButton) clearAllButton.addEventListener("click", clearAllPageFields);
  if (pageFieldsElement) {
    pageFieldsElement.addEventListener("click", handlePageFieldClick);
    pageFieldsElement.addEventListener("change", handlePageFieldChange);
    pageFieldsElement.addEventListener("input", handlePageFieldInput);
    pageFieldsElement.addEventListener("keydown", handlePageFieldKeydown);
    pageFieldsElement.addEventListener("focusout", handlePageFieldTypeFocusOut);
    pageFieldsElement.addEventListener("blur", handlePageFieldBlur, true);
  }
  document.addEventListener("click", handleTypeMenuOutsideClick);
  if (floatingControlsToggle) floatingControlsToggle.addEventListener("change", () => {
    state.floatingControlsVisible = floatingControlsToggle.checked;
    persistFloatingControls(state.floatingControlsVisible);
    syncPageFieldControls();
  });
  if (remapAllButton) remapAllButton.addEventListener("click", remapAllFields);
  if (copyAuditButton) copyAuditButton.addEventListener("click", copyMappingAudit);

  return {
    scanPageFields,
    renderPageFields,
    updateMarkAllButton,
    updatePageFieldValueInput
  };
}
