// Bootstrap e coordenação da interface da extensão.
import { ACTIONS } from "./messages.js";
import { normalizePageUrl, getBaseUrl } from "./domain/url-utils.js";
import { escapeHtml } from "./domain/html-utils.js";
import { sendMessageToTab, findActiveTab } from "./services/tabs-service.js";
import { migrateLegacyProfiles } from "./services/profiles-repository.js";
import { initPageFieldsPanel } from "./ui/page-fields-panel.js";
import { initGeneratorPanel } from "./ui/generator-panel.js";
import { initVehicleCatalogPanel } from "./ui/vehicle-catalog-panel.js";
import { initSelectorPlayground } from "./ui/selector-playground.js";
import { initProfileControls } from "./ui/profile-controls.js";
import { initNavigationControls } from "./ui/navigation-controls.js";

import { state } from "./state/app-store.js";

const openVehicleCatalogButton = document.querySelector("#open-vehicle-catalog-button");
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
const copyAuditButton = document.querySelector("#copy-audit-button");
const pageFieldsElement = document.querySelector("#page-fields");
const pageFieldsStatus = document.querySelector("#page-fields-status");
const baseUrlSelect = document.querySelector("#base-url-select");
let pageFieldsPanel;

function loadFloatingControlsPreference(callback) {
  chrome.storage.local.get({ "fakedata-floating-controls": true }, (result) => {
    state.floatingControlsVisible = result["fakedata-floating-controls"] !== false;
    if (floatingControlsToggle) floatingControlsToggle.checked = state.floatingControlsVisible;
    callback();
  });
}

const generatorPanel = initGeneratorPanel({
  state,
  refs: {
    resultSection: document.querySelector("#result-section"),
    resultFields: document.querySelector("#result-fields"),
    resultTitle: document.querySelector("#result-title"),
    generateLabel: document.querySelector("#generate-label"),
    generateButton: document.querySelector("#generate-button"),
    copyJsonButton: document.querySelector("#copy-json-button"),
    batchSizeInput: document.querySelector("#batch-size"),
    batchStatus: document.querySelector("#batch-status"),
    exportJsonButton: document.querySelector("#export-json-button"),
    exportCsvButton: document.querySelector("#export-csv-button"),
    personOptions: document.querySelector("#person-options"),
    companyOptions: document.querySelector("#company-options"),
    vehicleOptions: document.querySelector("#vehicle-options"),
    openVehicleCatalogButton,
    ufSelect: document.querySelector("#uf-select"),
    cpfFormatted: document.querySelector("#cpf-formatted"),
    cnpjFormatted: document.querySelector("#cnpj-formatted"),
    cnpjAlphanumeric: document.querySelector("#cnpj-alphanumeric"),
    renavamFormatted: document.querySelector("#renavam-formatted"),
    typeButtons: [...document.querySelectorAll(".type-button")]
  },
  copyText
});

const profileControls = initProfileControls({
  state,
  refs: {
    savedMappingsSelect: document.querySelector("#saved-mappings-select"),
    renameMappingButton: document.querySelector("#rename-mapping-button"),
    deleteMappingButton: document.querySelector("#delete-mapping-button"),
    pageFieldsStatus,
    mappingModal: document.querySelector("#mapping-modal"),
    mappingNameInput: document.querySelector("#mapping-name-input"),
    mappingModalError: document.querySelector("#mapping-modal-error"),
    mappingModalConfirm: document.querySelector("#mapping-modal-confirm"),
    mappingModalCancel: document.querySelector("#mapping-modal-cancel")
  },
  renderPageFields: () => pageFieldsPanel.renderPageFields()
});

const vehicleCatalogPanel = initVehicleCatalogPanel({
  state,
  refs: {
    brandInput: document.querySelector("#vehicle-brand-input"),
    modelInput: document.querySelector("#vehicle-model-input"),
    addButton: document.querySelector("#vehicle-add-button"),
    list: document.querySelector("#vehicle-catalog-list"),
    status: document.querySelector("#vehicle-catalog-status"),
    openButton: openVehicleCatalogButton,
    modal: document.querySelector("#vehicle-catalog-modal"),
    closeButton: document.querySelector("#close-vehicle-catalog-button")
  },
  generate: generatorPanel.generate,
  openRenameBrandModal: profileControls.openRenameBrandModal
});

const selectorPlayground = initSelectorPlayground({
  state,
  refs: {
    input: document.querySelector("#selector-playground-input"),
    targetButton: document.querySelector("#selector-playground-target"),
    count: document.querySelector("#selector-playground-count"),
    markButton: document.querySelector("#selector-playground-mark"),
    pageFieldsStatus
  },
  sendToPage
});

const navigationControls = initNavigationControls({
  refs: {
    themeToggle: document.querySelector("#theme-toggle"),
    openSidepanelButton: document.querySelector("#open-sidepanel-button"),
    maximizeButton: document.querySelector("#maximize-button"),
    generatorTab: document.querySelector("#generator-tab"),
    mappingTab: document.querySelector("#mapping-tab"),
    generatorPanel: document.querySelector("#generator-panel"),
    mappingPanel: document.querySelector("#mapping-panel"),
    automaticMappingTab: document.querySelector("#automatic-mapping-tab"),
    playgroundMappingTab: document.querySelector("#playground-mapping-tab"),
    automaticMappingPanel: document.querySelector("#automatic-mapping-panel"),
    playgroundMappingPanel: document.querySelector("#playground-mapping-panel"),
    popupHiddenElements: [
      document.querySelector("#generator-tab"),
      document.querySelector("#generator-panel"),
      document.querySelector("#playground-mapping-tab"),
      document.querySelector("#playground-mapping-panel"),
      addSelectorButton,
      markAllButton,
      saveMappingsButton,
      remapAllButton,
      copyAuditButton
    ],
    shortcuts: {
      scan: scanFieldsButton,
      fill: fillAllButton,
      floating: floatingControlsToggle,
      save: saveMappingsButton,
      mark: markAllButton,
      clear: clearAllButton
    }
  }
});

pageFieldsPanel = initPageFieldsPanel({
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
  readProfiles: profileControls.readProfiles,
  updateSavedProfiles: profileControls.updateSavedProfiles,
  getCurrentProfile: profileControls.getCurrentProfile,
  openMappingModal: profileControls.openMappingModal,
  persistPageMapping: profileControls.persistPageMapping,
  persistFloatingControls: (visible) => chrome.storage.local.set({ "fakedata-floating-controls": visible }),
  copyText,
  generateFieldValue: generatorPanel.generateFieldValue,
  generateAllFieldValues: generatorPanel.generateAllFieldValues
});

vehicleCatalogPanel.load();
migrateLegacyProfiles(() => {
  loadFloatingControlsPreference(() => {
    navigationControls.detectPopupMode((isPopup) => {
      navigationControls.applyPopupMode(isPopup);
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
      const value = generatorPanel.generateFieldValue(field);
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

function clearDisplayedPageFields(statusMessage) {
  state.pageFields = [];
  state.markedSelectors = new Set();
  state.selectedProfileId = "";
  state.savedProfiles = [];
  profileControls.clearSelection();
  pageFieldsPanel.updateMarkAllButton();
  pageFieldsPanel.renderPageFields();
  selectorPlayground.reset();
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


generatorPanel.generate();