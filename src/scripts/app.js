// Interface e regras do gerador da extensão.
import { createGeneratorData, generateMappedValue as generateMappedValuePure, pick } from "./generators.js";
import { DDDS, ESTADOS } from "./data/estados.js";
import { MAPPING_TYPES } from "./data/mapping-types.js";
import { addVehicleModel, normalizeVehicleCatalog, removeVehicleBrand, removeVehicleModel, renameVehicleBrand } from "./data/vehicle-catalog.js";
import { ACTIONS } from "./messages.js";
import { normalizePageUrl, getBaseUrl } from "./domain/url-utils.js";
import { escapeHtml } from "./domain/html-utils.js";
import { getMappingAudit, auditJson } from "./domain/mapping-audit.js";
import { mergeScannedFields } from "./domain/field-merge.js";
import { resolveFieldValue } from "./domain/field-value.js";
import { resolveVehicleContext } from "./domain/vehicle-context.js";
import { sendMessageToTab, findActiveTab } from "./services/tabs-service.js";
import { migrateLegacyProfiles, readProfiles, writeProfiles } from "./services/profiles-repository.js";

import { state } from "./state/app-store.js";

const resultSection = document.querySelector("#result-section");
const resultFields = document.querySelector("#result-fields");
const resultTitle = document.querySelector("#result-title");
const generateLabel = document.querySelector("#generate-label");
const generateButton = document.querySelector("#generate-button");
const copyJsonButton = document.querySelector("#copy-json-button");
const personOptions = document.querySelector("#person-options");
const companyOptions = document.querySelector("#company-options");
const vehicleOptions = document.querySelector("#vehicle-options");
const vehicleBrandInput = document.querySelector("#vehicle-brand-input");
const vehicleModelInput = document.querySelector("#vehicle-model-input");
const vehicleAddButton = document.querySelector("#vehicle-add-button");
const vehicleCatalogList = document.querySelector("#vehicle-catalog-list");
const vehicleCatalogStatus = document.querySelector("#vehicle-catalog-status");
const openVehicleCatalogButton = document.querySelector("#open-vehicle-catalog-button");
const vehicleCatalogModal = document.querySelector("#vehicle-catalog-modal");
const closeVehicleCatalogButton = document.querySelector("#close-vehicle-catalog-button");
const openSidepanelButton = document.querySelector("#open-sidepanel-button");
const themeToggle = document.querySelector("#theme-toggle");
const maximizeButton = document.querySelector("#maximize-button");
const ufSelect = document.querySelector("#uf-select");
const scanFieldsButton = document.querySelector("#scan-fields-button");
const addSelectorButton = document.querySelector("#add-selector-button");
const markAllButton = document.querySelector("#mark-all-button");
const saveMappingsButton = document.querySelector("#save-mappings-button");
const fillAllButton = document.querySelector("#fill-all-button");
const clearAllButton = document.querySelector("#clear-all-button");
const floatingControlsToggle = document.querySelector("#floating-controls-toggle");
const emptyStateScanButton = document.querySelector("#empty-state-scan");
const emptyStateElement = document.querySelector("#empty-state");
const emptyStateTitle = document.querySelector("#empty-state-title");
const emptyStateSubtitle = document.querySelector("#empty-state-subtitle");
const remapAllButton = document.querySelector("#remap-all-button");
const savedMappingsSelect = document.querySelector("#saved-mappings-select");
const renameMappingButton = document.querySelector("#rename-mapping-button");
const deleteMappingButton = document.querySelector("#delete-mapping-button");
const selectorPlaygroundInput = document.querySelector("#selector-playground-input");
const selectorPlaygroundTarget = document.querySelector("#selector-playground-target");
const selectorPlaygroundCount = document.querySelector("#selector-playground-count");
const selectorPlaygroundMark = document.querySelector("#selector-playground-mark");
const copyAuditButton = document.querySelector("#copy-audit-button");
const automaticMappingTab = document.querySelector("#automatic-mapping-tab");
const playgroundMappingTab = document.querySelector("#playground-mapping-tab");
const automaticMappingPanel = document.querySelector("#automatic-mapping-panel");
const playgroundMappingPanel = document.querySelector("#playground-mapping-panel");
const mappingModal = document.querySelector("#mapping-modal");
const mappingNameInput = document.querySelector("#mapping-name-input");
const mappingModalError = document.querySelector("#mapping-modal-error");
const mappingModalConfirm = document.querySelector("#mapping-modal-confirm");
const mappingModalCancel = document.querySelector("#mapping-modal-cancel");
const pageFieldsElement = document.querySelector("#page-fields");
const pageFieldsStatus = document.querySelector("#page-fields-status");
const baseUrlSelect = document.querySelector("#base-url-select");
const generatorTab = document.querySelector("#generator-tab");
const mappingTab = document.querySelector("#mapping-tab");
const generatorPanel = document.querySelector("#generator-panel");
const mappingPanel = document.querySelector("#mapping-panel");

function applyPopupMode(isPopup) {
  if (!isPopup) return;
  document.documentElement.dataset.extensionMode = "popup";
  activateTab("mapping");
  activateMappingSubtab("automatic");
  [
    generatorTab,
    generatorPanel,
    playgroundMappingTab,
    playgroundMappingPanel,
    addSelectorButton,
    markAllButton,
    saveMappingsButton,
    remapAllButton,
    copyAuditButton
  ].forEach((element) => {
    if (element) element.hidden = true;
  });
}

function detectPopupMode(callback) {
  if (!chrome.windows || typeof chrome.windows.getCurrent !== "function") {
    callback(false);
    return;
  }
  chrome.windows.getCurrent((currentWindow) => {
    const error = chrome.runtime.lastError;
    callback(!error && currentWindow && currentWindow.type === "popup");
  });
}

const generatorConfig = {
  getState: () => gerarEstadoSelecionado(),
  ddds: DDDS,
  getCpfFormatted: () => document.querySelector("#cpf-formatted") ? document.querySelector("#cpf-formatted").checked : true,
  getCnpjFormatted: () => document.querySelector("#cnpj-formatted") ? document.querySelector("#cnpj-formatted").checked : true,
  getCnpjAlphanumeric: () => document.querySelector("#cnpj-alphanumeric") ? document.querySelector("#cnpj-alphanumeric").checked : false,
  getRenavamFormatted: () => document.querySelector("#renavam-formatted") ? document.querySelector("#renavam-formatted").checked : false,
  getVehicleCatalog: () => state.vehicleCatalog
};
const data = createGeneratorData(generatorConfig);

ESTADOS.forEach((estado) => {
  const option = document.createElement("option");
  option.value = estado.sigla;
  option.textContent = `${estado.sigla} - ${estado.nome}`;
  ufSelect.appendChild(option);
});
ufSelect.value = localStorage.getItem("fakedata-uf") || "ALL";

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selectedTheme;
  if (themeToggle) {
    const isLight = selectedTheme === "light";
    themeToggle.innerHTML = `<span aria-hidden="true">${isLight ? "☀" : "☾"}</span>`;
    themeToggle.setAttribute("aria-label", isLight ? "Ativar tema escuro" : "Ativar tema claro");
    themeToggle.title = isLight ? "Ativar tema escuro" : "Ativar tema claro";
  }
  localStorage.setItem("fakedata-theme", selectedTheme);
}

applyTheme(localStorage.getItem("fakedata-theme") || "dark");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
  });
}

document.querySelectorAll(".type-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedType = button.dataset.type;
    document.querySelectorAll(".type-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    generateLabel.textContent = data[state.selectedType].label;
    personOptions.classList.toggle("is-hidden", state.selectedType !== "person");
    companyOptions.classList.toggle("is-hidden", state.selectedType !== "company");
    vehicleOptions.classList.toggle("is-hidden", state.selectedType !== "vehicle");
    if (openVehicleCatalogButton) openVehicleCatalogButton.hidden = state.selectedType !== "vehicle";
    generate();
  });
});

generateButton.addEventListener("click", generate);
ufSelect.addEventListener("change", () => {
  generate();
  localStorage.setItem("fakedata-uf", ufSelect.value);
});
copyJsonButton.addEventListener("click", () => copyText(JSON.stringify(state.currentResult, null, 2), copyJsonButton));
openSidepanelButton.addEventListener("click", () => {
  chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((error) => {
    console.error("Não foi possível abrir o painel lateral.", error);
  });
  window.close();
});
maximizeButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error("Não foi possível abrir a extensão em uma nova aba.", error);
      return;
    }
    closeCurrentSidePanel();
  });
});

function closeCurrentSidePanel() {
  if (!chrome.sidePanel || typeof chrome.sidePanel.close !== "function" ||
    !chrome.windows || typeof chrome.windows.getCurrent !== "function") {
    window.close();
    return;
  }
  chrome.windows.getCurrent((currentWindow) => {
    const error = chrome.runtime.lastError;
    if (error || !currentWindow || typeof currentWindow.id !== "number") {
      window.close();
      return;
    }
    Promise.resolve(chrome.sidePanel.close({ windowId: currentWindow.id }))
      .catch((closeError) => {
        if (!/No window with id/i.test(String(closeError && closeError.message))) {
          console.error("Não foi possível fechar o painel lateral.", closeError);
        }
      })
      .finally(() => window.close());
  });
}

function saveVehicleCatalog() {
  chrome.storage.local.set({ "fakedata-vehicle-catalog": state.vehicleCatalog }, () => {
    if (chrome.runtime.lastError) {
      vehicleCatalogStatus.textContent = "Não foi possível salvar o catálogo.";
      return;
    }
    renderVehicleCatalog();
    generate();
  });
}

function renderVehicleCatalog() {
  if (!vehicleCatalogList) return;
  vehicleCatalogList.innerHTML = state.vehicleCatalog.length
    ? state.vehicleCatalog.map((entry) => `<div class="vehicle-brand-row">
        <strong>${escapeHtml(entry.marca)}</strong>
        <button type="button" class="copy-all-button" data-edit-brand="${escapeHtml(entry.marca)}">Editar marca</button>
        <button type="button" class="copy-all-button danger-button" data-remove-brand="${escapeHtml(entry.marca)}">Excluir marca</button>
        <div class="vehicle-models">${entry.modelos.map((model) => `<span class="vehicle-model">
          ${escapeHtml(model)} <button type="button" aria-label="Editar ${escapeHtml(model)}" data-edit-model="${escapeHtml(entry.marca)}" data-model="${escapeHtml(model)}">✎</button>
          <button type="button" aria-label="Excluir ${escapeHtml(model)}" data-remove-model="${escapeHtml(entry.marca)}" data-model="${escapeHtml(model)}">×</button>
        </span>`).join("")}</div>
      </div>`).join("")
    : "<span class=\"muted\">Nenhum veículo personalizado cadastrado.</span>";
  vehicleCatalogList.querySelectorAll("[data-remove-brand]").forEach((button) => {
    button.addEventListener("click", () => {
      state.vehicleCatalog = removeVehicleBrand(state.vehicleCatalog, button.dataset.removeBrand);
      saveVehicleCatalog();
    });
  });
  vehicleCatalogList.querySelectorAll("[data-edit-brand]").forEach((button) => {
    button.addEventListener("click", async () => {
      const newName = await openRenameBrandModal(button.dataset.editBrand);
      if (!newName) return;
      try {
        state.vehicleCatalog = renameVehicleBrand(state.vehicleCatalog, button.dataset.editBrand, newName);
        saveVehicleCatalog();
      } catch (error) {
        vehicleCatalogStatus.textContent = error.message;
      }
    });
  });
  vehicleCatalogList.querySelectorAll("[data-edit-model]").forEach((button) => {
    button.addEventListener("click", () => {
      vehicleBrandInput.value = button.dataset.editModel;
      vehicleModelInput.value = button.dataset.model;
      state.vehicleCatalog = removeVehicleModel(state.vehicleCatalog, button.dataset.editModel, button.dataset.model);
      saveVehicleCatalog();
      vehicleModelInput.focus();
    });
  });
  vehicleCatalogList.querySelectorAll("[data-remove-model]").forEach((button) => {
    button.addEventListener("click", () => {
      state.vehicleCatalog = removeVehicleModel(state.vehicleCatalog, button.dataset.removeModel, button.dataset.model);
      saveVehicleCatalog();
    });
  });
}

function addVehicle() {
  try {
    state.vehicleCatalog = addVehicleModel(state.vehicleCatalog, vehicleBrandInput.value, vehicleModelInput.value);
    vehicleBrandInput.value = "";
    vehicleModelInput.value = "";
    vehicleCatalogStatus.textContent = "Veículo cadastrado.";
    saveVehicleCatalog();
  } catch (error) {
    vehicleCatalogStatus.textContent = error.message;
  }
}

function loadVehicleCatalog() {
  chrome.storage.local.get({ "fakedata-vehicle-catalog": [] }, (result) => {
    state.vehicleCatalog = normalizeVehicleCatalog(result["fakedata-vehicle-catalog"]);
    renderVehicleCatalog();
    generate();
  });
}

if (vehicleAddButton) vehicleAddButton.addEventListener("click", addVehicle);
function closeVehicleCatalog() {
  if (vehicleCatalogModal) vehicleCatalogModal.hidden = true;
}

function openVehicleCatalog() {
  if (!vehicleCatalogModal) return;
  vehicleCatalogModal.hidden = false;
  vehicleBrandInput.focus();
}

if (openVehicleCatalogButton) openVehicleCatalogButton.addEventListener("click", openVehicleCatalog);
if (closeVehicleCatalogButton) closeVehicleCatalogButton.addEventListener("click", closeVehicleCatalog);
if (vehicleCatalogModal) {
  vehicleCatalogModal.querySelector("[data-vehicle-modal-close]").addEventListener("click", closeVehicleCatalog);
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && vehicleCatalogModal && !vehicleCatalogModal.hidden) closeVehicleCatalog();
});

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
  pageFieldsElement.addEventListener("blur", handlePageFieldBlur, true);
}
if (floatingControlsToggle) floatingControlsToggle.addEventListener("change", () => {
  state.floatingControlsVisible = floatingControlsToggle.checked;
  chrome.storage.local.set({ "fakedata-floating-controls": state.floatingControlsVisible });
  syncPageFieldControls();
});

function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable);
}

function renderEmptyState() {
  if (!emptyStateElement || !emptyStateTitle || !emptyStateSubtitle || !pageFieldsStatus) return;

  const hasFields = state.pageFields.length > 0;
  const hasPageUrl = Boolean(state.activePageUrl);

  emptyStateElement.hidden = hasFields || !hasPageUrl;

  if (!hasFields && hasPageUrl) {
    emptyStateTitle.textContent = "Nenhum campo encontrado nesta página";
    emptyStateSubtitle.textContent = "A página carregada não possui inputs, selects ou textareas detectáveis. Tente recarregar a página ou verificar se o formulário está visível.";
  } else if (!hasPageUrl) {
    emptyStateTitle.textContent = "Nenhuma página acessível";
    emptyStateSubtitle.textContent = "Abra uma página HTTP(S) com um formulário para começar. Páginas internas do navegador (chrome://, edge://) não são suportadas.";
  }
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
    renderEmptyState();
    if (!pageFieldsStatus) return;
    const cleared = typeof response.cleared === "number" ? response.cleared : state.pageFields.length - failed.length;
    if (failed.length) {
      pageFieldsStatus.textContent = `${cleared} campo(s) limpado(s); ${failed.length} não foi(ram) limpo(s).`;
      return;
    }
    pageFieldsStatus.textContent = `${cleared} campo(s) limpado(s).`;
  });
}

document.addEventListener("keydown", (event) => {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
  const shortcuts = {
    s: scanFieldsButton,
    p: fillAllButton,
    f: floatingControlsToggle,
    l: saveMappingsButton,
    m: markAllButton,
    c: clearAllButton
  };
  const control = shortcuts[event.key.toLowerCase()];
  if (!control || control.hidden || control.disabled) return;
  event.preventDefault();
  control.click();
});
if (remapAllButton) remapAllButton.addEventListener("click", remapAllFields);
if (savedMappingsSelect) savedMappingsSelect.addEventListener("change", () => loadSavedProfile(savedMappingsSelect.value));
if (renameMappingButton) renameMappingButton.addEventListener("click", renameSavedProfile);
if (deleteMappingButton) deleteMappingButton.addEventListener("click", deleteSavedProfile);
if (selectorPlaygroundInput) selectorPlaygroundInput.addEventListener("input", checkSelectorMatches);
if (selectorPlaygroundTarget) selectorPlaygroundTarget.addEventListener("click", capturePlaygroundSelector);
if (selectorPlaygroundMark) selectorPlaygroundMark.addEventListener("click", toggleSelectorMatches);
if (copyAuditButton) copyAuditButton.addEventListener("click", copyMappingAudit);
if (automaticMappingTab) automaticMappingTab.addEventListener("click", () => activateMappingSubtab("automatic"));
if (playgroundMappingTab) playgroundMappingTab.addEventListener("click", () => activateMappingSubtab("playground"));
if (mappingModalConfirm) mappingModalConfirm.addEventListener("click", () => {
  if (state.mappingModalConfirmHandler) state.mappingModalConfirmHandler();
  else confirmMappingModal();
});
if (mappingModalCancel) mappingModalCancel.addEventListener("click", () => closeMappingModal(""));
if (mappingModal) mappingModal.querySelector("[data-modal-close]").addEventListener("click", () => closeMappingModal(""));
if (mappingNameInput) mappingNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmMappingModal();
  if (event.key === "Escape") closeMappingModal("");
});

function loadFloatingControlsPreference(callback) {
  chrome.storage.local.get({ "fakedata-floating-controls": true }, (result) => {
    state.floatingControlsVisible = result["fakedata-floating-controls"] !== false;
    if (floatingControlsToggle) floatingControlsToggle.checked = state.floatingControlsVisible;
    callback();
  });
}

loadVehicleCatalog();
migrateLegacyProfiles(() => {
  loadFloatingControlsPreference(() => {
    detectPopupMode((isPopup) => {
      applyPopupMode(isPopup);
      refreshBaseUrlOptions(() => {
        if (pageFieldsElement) scanPageFields();
      });
    });
  });
});
if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    state.activeTab = null;
    state.activePageUrl = "";
    state.activeBaseUrl = "";
    refreshBaseUrlOptions(() => scanPageFields());
  });
}
// A6: aceita apenas mensagens da aba ativa cuja origem bate com a base da página.
// Sem `sender.tab` (ex.: mensagens internas) a mensagem é aceita, como antes.
function shouldHandlePageContentChange(sender) {
  if (!state.activeTab) return false;
  const senderTab = sender && sender.tab;
  if (!senderTab) return true;
  if (senderTab.id !== state.activeTab.id) return false;
  if (senderTab.url && getBaseUrl(senderTab.url) !== state.activeBaseUrl) return false;
  return true;
}

if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === ACTIONS.PAGE_FIELD_FILL_REQUEST) {
      const field = state.pageFields.find((item) => item.key === message.key || item.selector === message.selector);
      if (!field || !sender.tab || !sender.tab.id) {
        sendResponse({ filled: false });
        return true;
      }
      const value = resolveFieldValue(field, (type, inputType) => {
        const vehicleContext = resolveVehicleContext(state.vehicleCatalog, state.pageFields, pick, type);
        return generateMappedValuePure(type, data.person.context(), inputType, { ...generatorConfig, vehicleContext });
      });
      sendMessageToTab(sender.tab.id, {
        action: ACTIONS.FILL_FIELD,
        selector: field.selector,
        value
      }, (response, error) => {
        const filled = !error && response && response.filled;
        if (filled) {
          field.value = String(value);
          if (field.fixed) field.fixedValue = String(value);
          updatePageFieldValueInput(field);
        }
        sendResponse({ filled });
      }, false);
      return true;
    }
    if (!message || message.action !== ACTIONS.PAGE_CONTENT_CHANGED) return;
    if (!shouldHandlePageContentChange(sender)) return;
    const changedUrl = normalizePageUrl(message.url || "") !== state.activePageUrl;
    if (changedUrl || message.changeType === "route") {
      clearDisplayedPageFields("A página mudou. Atualizando os campos...");
      scanPageFields();
      return;
    }
    scanPageFields(false, true);
  });
}

function activateTab(tabName) {
  const isGenerator = tabName === "generator";
  if (!generatorTab || !mappingTab || !generatorPanel || !mappingPanel) return;
  generatorTab.classList.toggle("active", isGenerator);
  mappingTab.classList.toggle("active", !isGenerator);
  generatorTab.setAttribute("aria-selected", String(isGenerator));
  mappingTab.setAttribute("aria-selected", String(!isGenerator));
  generatorTab.tabIndex = isGenerator ? 0 : -1;
  mappingTab.tabIndex = isGenerator ? -1 : 0;
  generatorPanel.hidden = !isGenerator;
  mappingPanel.hidden = isGenerator;
}

function activateMappingSubtab(tabName) {
  const automatic = tabName === "automatic";
  if (!automaticMappingTab || !playgroundMappingTab || !automaticMappingPanel || !playgroundMappingPanel) return;
  automaticMappingTab.classList.toggle("active", automatic);
  playgroundMappingTab.classList.toggle("active", !automatic);
  automaticMappingTab.setAttribute("aria-selected", String(automatic));
  playgroundMappingTab.setAttribute("aria-selected", String(!automatic));
  automaticMappingTab.tabIndex = automatic ? 0 : -1;
  playgroundMappingTab.tabIndex = automatic ? -1 : 0;
  automaticMappingPanel.hidden = !automatic;
  playgroundMappingPanel.hidden = automatic;
}

if (generatorTab) generatorTab.addEventListener("click", () => activateTab("generator"));
if (mappingTab) mappingTab.addEventListener("click", () => activateTab("mapping"));

function generate() {
  const definition = data[state.selectedType];
  const context = definition.context ? definition.context() : {};
  state.currentResult = Object.fromEntries(definition.fields.map(([label, create]) => [label, create(context)]));

  resultTitle.textContent = definition.title;
  resultFields.innerHTML = definition.fields.map(([label]) => `
    <div class="result-field">
      <span class="field-label">${escapeHtml(label)}</span>
      <span class="field-value" title="${escapeHtml(state.currentResult[label])}">${escapeHtml(state.currentResult[label])}</span>
      <button class="copy-field-button" type="button" aria-label="Copiar ${escapeHtml(label)}" data-value="${escapeHtml(state.currentResult[label])}">⧉</button>
    </div>
  `).join("");
  resultFields.querySelectorAll(".copy-field-button").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.value, button));
  });
  resultSection.classList.remove("is-hidden");
}

function clearDisplayedPageFields(statusMessage) {
  state.pageFields = [];
  state.markedSelectors = new Set();
  state.selectedProfileId = "";
  state.savedProfiles = [];
  if (savedMappingsSelect) {
    savedMappingsSelect.innerHTML = '<option value="">Nenhum mapeamento selecionado</option>';
    savedMappingsSelect.value = "";
  }
  updateMarkAllButton();
  renderPageFields();
  if (selectorPlaygroundInput) selectorPlaygroundInput.value = "";
  if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "—";
  state.selectorPlaygroundMarked = false;
  state.selectorPlaygroundMarkedSelector = "";
  updateSelectorMarkButton(0);
  if (pageFieldsStatus) pageFieldsStatus.textContent = statusMessage;
}

function getActiveTab(callback) {
  findActiveTab(state.selectedBaseUrl, callback);
}

function refreshBaseUrlOptions(callback = () => {}) {
  if (!baseUrlSelect || !chrome.tabs || !chrome.tabs.query) {
    callback();
    return;
  }
  chrome.tabs.query({}, (tabs) => {
    const bases = [...new Set((tabs || [])
      .map((tab) => tab && /^https?:/i.test(tab.url || "") ? getBaseUrl(tab.url) : "")
      .filter(Boolean))].sort();
    if (state.selectedBaseUrl && !bases.includes(state.selectedBaseUrl)) state.selectedBaseUrl = "";
    baseUrlSelect.innerHTML = bases.length
      ? bases.map((base) => `<option value="${escapeHtml(base)}">${escapeHtml(base)}</option>`).join("")
      : '<option value="">Nenhuma página HTTP(S) aberta</option>';
    if (!state.selectedBaseUrl) {
      const activeWebTab = (tabs || []).find((tab) => tab && tab.active && /^https?:/i.test(tab.url || ""));
      state.selectedBaseUrl = activeWebTab ? getBaseUrl(activeWebTab.url) : bases[0] || "";
    }
    baseUrlSelect.value = state.selectedBaseUrl;
    callback();
  });
}

function sendToPage(message, callback) {
  if (!chrome.tabs || !chrome.tabs.sendMessage) {
    callback(null, new Error("Nenhuma página ativa."));
    return;
  }
  getActiveTab((tab) => {
    state.activeTab = tab;
    if (!state.activeTab || !state.activeTab.id || !/^https?:/i.test(state.activeTab.url || "")) {
      callback(null, new Error("Nenhuma página ativa."));
      return;
    }
    sendMessageToTab(state.activeTab.id, message, callback, true);
  });
}

function checkSelectorMatches() {
  const selector = selectorPlaygroundInput ? selectorPlaygroundInput.value.trim() : "";
  if (state.selectorPlaygroundMarked && selector !== state.selectorPlaygroundMarkedSelector) {
    sendToPage({ action: ACTIONS.UNMARK_SELECTOR_MATCHES, selector: state.selectorPlaygroundMarkedSelector }, () => {});
    state.selectorPlaygroundMarked = false;
    state.selectorPlaygroundMarkedSelector = "";
  }
  if (!selector) {
    if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "—";
    state.selectorPlaygroundMarked = false;
    updateSelectorMarkButton(0);
    return;
  }
  sendToPage({ action: ACTIONS.COUNT_SELECTOR_MATCHES, selector }, (response, error) => {
    if (!selectorPlaygroundCount) return;
    const valid = !error && response && !response.invalid;
    selectorPlaygroundCount.textContent = !valid
      ? "Inválido"
      : `${response.count} encontrado(s)`;
    if (!valid || response.count === 0) state.selectorPlaygroundMarked = false;
    updateSelectorMarkButton(valid ? response.count : 0);
  });
}

function updateSelectorMarkButton(count) {
  if (!selectorPlaygroundMark) return;
  selectorPlaygroundMark.disabled = count === 0;
  selectorPlaygroundMark.textContent = state.selectorPlaygroundMarked ? "Desmarcar encontrados" : "Marcar encontrados";
}

function toggleSelectorMatches() {
  const selector = selectorPlaygroundInput ? selectorPlaygroundInput.value.trim() : "";
  if (!selector) return;
  const action = state.selectorPlaygroundMarked ? ACTIONS.UNMARK_SELECTOR_MATCHES : ACTIONS.MARK_SELECTOR_MATCHES;
  sendToPage({ action, selector }, (response, error) => {
    if (error || !response) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações do seletor.";
      return;
    }
    state.selectorPlaygroundMarked = !state.selectorPlaygroundMarked;
    state.selectorPlaygroundMarkedSelector = state.selectorPlaygroundMarked ? selector : "";
    updateSelectorMarkButton(response.count || 0);
    if (pageFieldsStatus) {
      pageFieldsStatus.textContent = state.selectorPlaygroundMarked
        ? `${response.count} elemento(s) encontrado(s) marcado(s).`
        : "Marcações do seletor removidas.";
    }
  });
}

function capturePlaygroundSelector() {
  if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "...";
  sendToPage({ action: ACTIONS.CAPTURE_NEXT_CLICK }, (response, error) => {
    if (error || !response || !response.captured || !response.field) {
      if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "Não capturado";
      return;
    }
    if (selectorPlaygroundInput) selectorPlaygroundInput.value = response.field.selector;
    checkSelectorMatches();
  });
}

function profileId() {
  return `${state.activePageUrl}::${Date.now()}::${Math.random().toString(36).slice(2)}`;
}

function updateSavedProfiles(profiles) {
  state.savedProfiles = profiles.filter((profile) => normalizePageUrl(profile.pageUrl) === state.activePageUrl);
  if (!savedMappingsSelect) return;
  savedMappingsSelect.innerHTML = '<option value="">Nenhum mapeamento selecionado</option>' +
    state.savedProfiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)} (${escapeHtml(profile.pageUrl)})</option>`).join("");
  savedMappingsSelect.value = state.selectedProfileId;
}

function loadSavedProfile(id) {
  const profile = state.savedProfiles.find((item) => item.id === id);
  if (!profile) return;
  state.selectedProfileId = id;
  state.pageFields = profile.fields.map((field) => ({ ...field, fixed: Boolean(field.fixed), fixedValue: field.fixedValue || "" }));
  renderPageFields();
  if (pageFieldsStatus) pageFieldsStatus.textContent = `Mapeamento "${profile.name}" carregado.`;
}

function getCurrentProfile(profiles) {
  return profiles.find((profile) => profile.id === state.selectedProfileId);
}

function openMappingModal(initialName, title, confirmHandler = confirmMappingModal) {
  if (!mappingModal || !mappingNameInput) return Promise.resolve("");
  mappingModal.querySelector("#mapping-modal-title").textContent = title;
  mappingNameInput.value = initialName || "";
  mappingModalError.textContent = "";
  mappingModal.hidden = false;
  mappingNameInput.focus();
  mappingNameInput.select();
  state.mappingModalConfirmHandler = confirmHandler;
  return new Promise((resolve) => {
    state.mappingModalResolver = resolve;
  });
}

function closeMappingModal(value) {
  if (!mappingModal || !state.mappingModalResolver) return;
  mappingModal.hidden = true;
  const resolve = state.mappingModalResolver;
  state.mappingModalResolver = null;
  state.mappingModalConfirmHandler = null;
  resolve(value);
}

function confirmMappingModal() {
  const name = mappingNameInput ? mappingNameInput.value.trim() : "";
  if (!name) {
    if (mappingModalError) mappingModalError.textContent = "Informe um nome para continuar.";
    if (mappingNameInput) mappingNameInput.focus();
    return;
  }
  closeMappingModal(name);
}

function openRenameBrandModal(currentName) {
  return openMappingModal(currentName, "Renomear marca");
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
    const options = MAPPING_TYPES.map(([value, label]) =>
      `<option value="${escapeHtml(value)}" ${field.dataType === value ? "selected" : ""}>${escapeHtml(label)}</option>`
    ).join("");
    return `
      <div class="page-field" data-index="${index}">
        <div class="page-field-heading">
          <span class="page-field-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
          <input class="page-field-label-editor" type="text" aria-label="Nome do campo mapeado" value="${escapeHtml(field.label)}" hidden>
          <button type="button" class="page-field-edit-label" title="Editar nome do campo" aria-label="Editar nome do campo">✎</button>
          ${field.selectorStatus !== "stable" || field.selectorSuggestion ? `<span class="field-warning" title="${escapeHtml(field.selectorSuggestion || "Este campo possui um problema no mapeamento.")}" aria-label="${escapeHtml(field.selectorSuggestion || "Este campo possui um problema no mapeamento.")}">!</span>` : ""}
          <span class="muted">${escapeHtml(field.inputType || field.tagName)}</span>
        </div>
        <select class="page-field-type" aria-label="Tipo para ${escapeHtml(field.label)}">${options}</select>
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

// A7: os eventos da lista são tratados por delegação no container `#page-fields`
// (registrada uma única vez no início do módulo), não por linha renderizada.
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
  if (event.target.matches(".page-field-type")) {
    context.field.dataType = event.target.value;
    return;
  }
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
  if (event.target.matches(".page-field-selector")) {
    context.field.selector = event.target.value;
  } else if (event.target.matches(".page-field-fixed-value") && context.field.fixed) {
    context.field.fixedValue = event.target.value;
  }
}

function handlePageFieldKeydown(event) {
  if (!event.target || !event.target.matches || !event.target.matches(".page-field-label-editor")) return;
  const context = getPageFieldContext(event.target);
  if (!context) return;
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

function persistPageMapping(name, existingId) {
  const mappings = state.pageFields.map((field) => ({
    key: field.key,
    selector: field.selector,
    label: field.label,
    dataType: field.dataType,
    fixed: Boolean(field.fixed),
    fixedValue: field.fixed ? field.fixedValue || "" : "",
    selectorRule: field.selectorRule || "",
    selectorStatus: field.selectorStatus || "stable",
    selectorSuggestion: field.selectorSuggestion || "",
    locatorName: field.locatorName || ""
  }));
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    let application = stored[state.activeBaseUrl];
    if (Array.isArray(application)) application = { pages: [] };
    if (!application || !Array.isArray(application.pages)) application = { pages: [] };
    const existing = application.pages.find((profile) => profile.id === existingId);
    const profile = { id: existing ? existing.id : profileId(), name: name.trim(), pageUrl: state.activePageUrl, fields: mappings, audit: getMappingAudit(state.pageFields) };
    application.pages = existing
      ? application.pages.map((item) => item.id === profile.id ? profile : item)
      : application.pages.concat(profile);
    stored[state.activeBaseUrl] = application;
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, () => {
      state.selectedProfileId = profile.id;
      updateSavedProfiles(application.pages);
      if (pageFieldsStatus) pageFieldsStatus.textContent = `Mapeamento "${profile.name}" salvo.`;
    });
  });
}

function renameSavedProfile() {
  const profile = state.savedProfiles.find((item) => item.id === state.selectedProfileId);
  if (!profile) return;
  openMappingModal(profile.name, "Renomear mapeamento").then((name) => {
    if (!name) return;
    readProfiles(state.activeBaseUrl, (profiles) => {
      const updated = profiles.map((item) => item.id === profile.id ? { ...item, name } : item);
      writeProfiles(state.activeBaseUrl, updated, () => {
        updateSavedProfiles(updated);
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Nome atualizado.";
      });
    });
  });
}

function deleteSavedProfile() {
  const profile = state.savedProfiles.find((item) => item.id === state.selectedProfileId);
  if (!profile || !window.confirm(`Excluir "${profile.name}"?`)) return;
  readProfiles(state.activeBaseUrl, (profiles) => {
    writeProfiles(state.activeBaseUrl, profiles.filter((item) => item.id !== profile.id), () => {
      state.selectedProfileId = "";
      updateSavedProfiles(profiles.filter((item) => item.id !== profile.id));
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Mapeamento excluído.";
    });
  });
}

function fillPageField(index) {
  const field = state.pageFields[index];
  if (!field) return;
  const value = resolveFieldValue(field, (type, inputType) => {
    const vehicleContext = resolveVehicleContext(state.vehicleCatalog, state.pageFields, pick, type);
    return generateMappedValuePure(type, data.person.context(), inputType, { ...generatorConfig, vehicleContext });
  });
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
  const context = data.person.context();
  // P1: só campos fixados participam da escolha do veículo; os demais entram
  // com `value` vazio para não influenciar a coerência marca/modelo.
  const pinnedFields = state.pageFields.map((field) => (field.fixed ? field : { ...field, value: "" }));
  const vehicleContext = resolveVehicleContext(state.vehicleCatalog, pinnedFields, pick);
  const fields = state.pageFields.map((field) => ({
    selector: field.selector,
    value: resolveFieldValue(field, (type, inputType) =>
      generateMappedValuePure(type, context, inputType, { ...generatorConfig, vehicleContext }))
  }));
  sendToPage({ action: ACTIONS.FILL_ALL, fields }, (response, error) => {
    if (!error && response) {
      state.pageFields.forEach((field, index) => {
        if (!fields[index]) return;
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

function gerarEstadoSelecionado() {
  const selectedUf = ufSelect.value;
  if (selectedUf === "ALL") {
    return pick(ESTADOS);
  }
  return ESTADOS.find((estado) => estado.sigla === selectedUf) || pick(ESTADOS);
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = "✓";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1200);
  } catch (error) {
    console.error("Não foi possível copiar o dado.", error);
  }
}


generate();