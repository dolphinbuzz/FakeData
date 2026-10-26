// Interface e regras do gerador da extensão.
import { createGeneratorData, generateMappedValue as generateMappedValuePure, pick } from "./generators.js";
import { DDDS, ESTADOS } from "./data/estados.js";
import { addVehicleModel, normalizeVehicleCatalog, removeVehicleBrand, removeVehicleModel, renameVehicleBrand } from "./data/vehicle-catalog.js";
import { ACTIONS } from "./messages.js";
import { normalizePageUrl, getBaseUrl } from "./domain/url-utils.js";
import { escapeHtml } from "./domain/html-utils.js";
import { getMappingAudit } from "./domain/mapping-audit.js";
import { resolveFieldValue } from "./domain/field-value.js";
import { resolveVehicleContext } from "./domain/vehicle-context.js";
import { sendMessageToTab, findActiveTab } from "./services/tabs-service.js";
import { migrateLegacyProfiles, readProfiles, writeProfiles } from "./services/profiles-repository.js";
import { initPageFieldsPanel } from "./ui/page-fields-panel.js";

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

function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable);
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
if (savedMappingsSelect) savedMappingsSelect.addEventListener("change", () => loadSavedProfile(savedMappingsSelect.value));
if (renameMappingButton) renameMappingButton.addEventListener("click", renameSavedProfile);
if (deleteMappingButton) deleteMappingButton.addEventListener("click", deleteSavedProfile);
if (selectorPlaygroundInput) selectorPlaygroundInput.addEventListener("input", checkSelectorMatches);
if (selectorPlaygroundTarget) selectorPlaygroundTarget.addEventListener("click", capturePlaygroundSelector);
if (selectorPlaygroundMark) selectorPlaygroundMark.addEventListener("click", toggleSelectorMatches);
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

const pageFieldsPanel = initPageFieldsPanel({
  state,
  refs: {
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
  },
  sendToPage,
  getActiveTab,
  readProfiles,
  updateSavedProfiles,
  getCurrentProfile,
  openMappingModal,
  persistPageMapping,
  persistFloatingControls: (visible) => chrome.storage.local.set({ "fakedata-floating-controls": visible }),
  copyText,
  generateFieldValue,
  generateAllFieldValues
});

loadVehicleCatalog();
migrateLegacyProfiles(() => {
  loadFloatingControlsPreference(() => {
    detectPopupMode((isPopup) => {
      applyPopupMode(isPopup);
      refreshBaseUrlOptions(() => {
        if (pageFieldsElement) pageFieldsPanel.scanPageFields();
      });
    });
  });
});
if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    state.activeTab = null;
    state.activePageUrl = "";
    state.activeBaseUrl = "";
    refreshBaseUrlOptions(() => pageFieldsPanel.scanPageFields());
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
      const value = generateFieldValue(field);
      sendMessageToTab(sender.tab.id, {
        action: ACTIONS.FILL_FIELD,
        selector: field.selector,
        value
      }, (response, error) => {
        const filled = !error && response && response.filled;
        if (filled) {
          field.value = String(value);
          if (field.fixed) field.fixedValue = String(value);
          pageFieldsPanel.updatePageFieldValueInput(field);
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
      pageFieldsPanel.scanPageFields();
      return;
    }
    pageFieldsPanel.scanPageFields(false, true);
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
  pageFieldsPanel.updateMarkAllButton();
  pageFieldsPanel.renderPageFields();
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
  pageFieldsPanel.renderPageFields();
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

function generateFieldValue(field) {
  return resolveFieldValue(field, (type, inputType) => {
    const vehicleContext = resolveVehicleContext(state.vehicleCatalog, state.pageFields, pick, type);
    return generateMappedValuePure(type, data.person.context(), inputType, { ...generatorConfig, vehicleContext });
  });
}

// P1: só campos fixados participam da escolha do veículo; os demais entram
// com `value` vazio para não influenciar a coerência marca/modelo.
function generateAllFieldValues(fields) {
  const context = data.person.context();
  const pinnedFields = fields.map((field) => (field.fixed ? field : { ...field, value: "" }));
  const vehicleContext = resolveVehicleContext(state.vehicleCatalog, pinnedFields, pick);
  return fields.map((field) => resolveFieldValue(field, (type, inputType) =>
    generateMappedValuePure(type, context, inputType, { ...generatorConfig, vehicleContext })));
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