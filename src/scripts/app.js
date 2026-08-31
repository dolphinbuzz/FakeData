// Interface e regras do gerador da extensão.
import { createGeneratorData, generateMappedValue as generateMappedValuePure, validarCPF, validarCNPJ, pick } from "./generators.js";
import { DDDS, ESTADOS } from "./data/estados.js";
import { MAPPING_TYPES } from "./data/mapping-types.js";
import { ACTIONS } from "./messages.js";

let selectedType = "person";
let currentResult = null;
let activeTab = null;
let activePageUrl = "";
let activeBaseUrl = "";
let savedProfiles = [];
let selectedProfileId = "";
let mappingModalResolver = null;
let pageFields = [];
let markedSelectors = new Set();

const resultSection = document.querySelector("#result-section");
const resultFields = document.querySelector("#result-fields");
const resultTitle = document.querySelector("#result-title");
const generateLabel = document.querySelector("#generate-label");
const generateButton = document.querySelector("#generate-button");
const copyJsonButton = document.querySelector("#copy-json-button");
const personOptions = document.querySelector("#person-options");
const companyOptions = document.querySelector("#company-options");
const openSidepanelButton = document.querySelector("#open-sidepanel-button");
const themeToggle = document.querySelector("#theme-toggle");
const maximizeButton = document.querySelector("#maximize-button");
const ufSelect = document.querySelector("#uf-select");
const scanFieldsButton = document.querySelector("#scan-fields-button");
const addSelectorButton = document.querySelector("#add-selector-button");
const markAllButton = document.querySelector("#mark-all-button");
const saveMappingsButton = document.querySelector("#save-mappings-button");
const fillAllButton = document.querySelector("#fill-all-button");
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
let selectorPlaygroundMarked = false;
let selectorPlaygroundMarkedSelector = "";
const mappingModal = document.querySelector("#mapping-modal");
const mappingNameInput = document.querySelector("#mapping-name-input");
const mappingModalError = document.querySelector("#mapping-modal-error");
const mappingModalConfirm = document.querySelector("#mapping-modal-confirm");
const mappingModalCancel = document.querySelector("#mapping-modal-cancel");
const pageFieldsElement = document.querySelector("#page-fields");
const pageFieldsStatus = document.querySelector("#page-fields-status");
const generatorTab = document.querySelector("#generator-tab");
const mappingTab = document.querySelector("#mapping-tab");
const generatorPanel = document.querySelector("#generator-panel");
const mappingPanel = document.querySelector("#mapping-panel");

const data = createGeneratorData({
  getState: () => gerarEstadoSelecionado(),
  ddds: DDDS,
  getCpfFormatted: () => document.querySelector("#cpf-formatted").checked,
  getCnpjFormatted: () => document.querySelector("#cnpj-formatted").checked,
  getCnpjAlphanumeric: () => document.querySelector("#cnpj-alphanumeric").checked
});
const generatorOptions = {
  getState: () => gerarEstadoSelecionado(),
  ddds: DDDS,
  getCpfFormatted: () => document.querySelector("#cpf-formatted") ? document.querySelector("#cpf-formatted").checked : true,
  getCnpjFormatted: () => document.querySelector("#cnpj-formatted") ? document.querySelector("#cnpj-formatted").checked : true,
  getCnpjAlphanumeric: () => document.querySelector("#cnpj-alphanumeric") ? document.querySelector("#cnpj-alphanumeric").checked : false
};

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
    selectedType = button.dataset.type;
    document.querySelectorAll(".type-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    generateLabel.textContent = data[selectedType].label;
    personOptions.classList.toggle("is-hidden", selectedType !== "person");
    companyOptions.classList.toggle("is-hidden", selectedType !== "company");
    generate();
  });
});

generateButton.addEventListener("click", generate);
ufSelect.addEventListener("change", generate);
ufSelect.addEventListener("change", () => {
  localStorage.setItem("fakedata-uf", ufSelect.value);
});
copyJsonButton.addEventListener("click", () => copyText(JSON.stringify(currentResult, null, 2), copyJsonButton));
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
    if (chrome.sidePanel && chrome.sidePanel.close && chrome.windows) {
      chrome.sidePanel.close({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((error) => {
        console.error("Não foi possível fechar o painel lateral.", error);
      });
    }
    window.close();
  });
});

if (scanFieldsButton) scanFieldsButton.addEventListener("click", scanPageFields);
if (addSelectorButton) addSelectorButton.addEventListener("click", addNewSelector);
if (markAllButton) markAllButton.addEventListener("click", toggleMarkAllFields);
if (saveMappingsButton) saveMappingsButton.addEventListener("click", savePageMappings);
if (fillAllButton) fillAllButton.addEventListener("click", fillAllPageFields);
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
if (mappingModalConfirm) mappingModalConfirm.addEventListener("click", confirmMappingModal);
if (mappingModalCancel) mappingModalCancel.addEventListener("click", () => closeMappingModal(""));
if (mappingModal) mappingModal.querySelector("[data-modal-close]").addEventListener("click", () => closeMappingModal(""));
if (mappingNameInput) mappingNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmMappingModal();
  if (event.key === "Escape") closeMappingModal("");
});

migrateLegacyProfiles(() => {
  if (pageFieldsElement) scanPageFields();
});
if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    clearDisplayedPageFields("A aba ativa mudou. Clique em Escanear campos para ler a nova página.");
    activeTab = null;
    activePageUrl = "";
    activeBaseUrl = "";
  });
}
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.action !== ACTIONS.PAGE_CONTENT_CHANGED) return;
    if (!activeTab || sender.tab && sender.tab.id !== activeTab.id) return;
    clearDisplayedPageFields("A página mudou. Clique em Escanear campos para atualizar os campos.");
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
  const definition = data[selectedType];
  const context = definition.context ? definition.context() : {};
  currentResult = Object.fromEntries(definition.fields.map(([label, create]) => [label, create(context)]));

  autovalidar(currentResult);

  resultTitle.textContent = definition.title;
  resultFields.innerHTML = definition.fields.map(([label]) => `
    <div class="result-field">
      <span class="field-label">${label}</span>
      <span class="field-value" title="${currentResult[label]}">${currentResult[label]}</span>
      <button class="copy-field-button" type="button" aria-label="Copiar ${label}" data-value="${currentResult[label]}">⧉</button>
    </div>
  `).join("");
  resultFields.querySelectorAll(".copy-field-button").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.value, button));
  });
  resultSection.classList.remove("is-hidden");
}

function clearDisplayedPageFields(statusMessage) {
  pageFields = [];
  markedSelectors = new Set();
  selectedProfileId = "";
  savedProfiles = [];
  if (savedMappingsSelect) {
    savedMappingsSelect.innerHTML = '<option value="">Nenhum mapeamento selecionado</option>';
    savedMappingsSelect.value = "";
  }
  updateMarkAllButton();
  renderPageFields();
  if (selectorPlaygroundInput) selectorPlaygroundInput.value = "";
  if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "—";
  selectorPlaygroundMarked = false;
  selectorPlaygroundMarkedSelector = "";
  updateSelectorMarkButton(0);
  if (pageFieldsStatus) pageFieldsStatus.textContent = statusMessage;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getActiveTab(callback) {
  if (!chrome.tabs || !chrome.tabs.query) {
    callback(null);
    return;
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => callback(tabs && tabs[0]));
}

function sendToPage(message, callback) {
  if (!chrome.tabs || !chrome.tabs.sendMessage) {
    callback(null, new Error("Nenhuma página ativa."));
    return;
  }
  getActiveTab((tab) => {
    activeTab = tab;
    if (!activeTab || !activeTab.id || !/^https?:/i.test(activeTab.url || "")) {
      callback(null, new Error("Nenhuma página ativa."));
      return;
    }
    sendMessageToTab(activeTab.id, message, callback, true);
  });
}

function sendMessageToTab(tabId, message, callback, allowInjection) {
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
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/scripts/content.js"]
    }, () => {
      const injectionError = chrome.runtime.lastError;
      if (injectionError) {
        callback(null, injectionError);
        return;
      }
      sendMessageToTab(tabId, message, callback, false);
    });
  });
}

function checkSelectorMatches() {
  const selector = selectorPlaygroundInput ? selectorPlaygroundInput.value.trim() : "";
  if (selectorPlaygroundMarked && selector !== selectorPlaygroundMarkedSelector) {
    sendToPage({ action: ACTIONS.UNMARK_SELECTOR_MATCHES, selector: selectorPlaygroundMarkedSelector }, () => {});
    selectorPlaygroundMarked = false;
    selectorPlaygroundMarkedSelector = "";
  }
  if (!selector) {
    if (selectorPlaygroundCount) selectorPlaygroundCount.textContent = "—";
    selectorPlaygroundMarked = false;
    updateSelectorMarkButton(0);
    return;
  }
  sendToPage({ action: ACTIONS.COUNT_SELECTOR_MATCHES, selector }, (response, error) => {
    if (!selectorPlaygroundCount) return;
    const valid = !error && response && !response.invalid;
    selectorPlaygroundCount.textContent = !valid
      ? "Inválido"
      : `${response.count} encontrado(s)`;
    if (!valid || response.count === 0) selectorPlaygroundMarked = false;
    updateSelectorMarkButton(valid ? response.count : 0);
  });
}

function updateSelectorMarkButton(count) {
  if (!selectorPlaygroundMark) return;
  selectorPlaygroundMark.disabled = count === 0;
  selectorPlaygroundMark.textContent = selectorPlaygroundMarked ? "Desmarcar encontrados" : "Marcar encontrados";
}

function toggleSelectorMatches() {
  const selector = selectorPlaygroundInput ? selectorPlaygroundInput.value.trim() : "";
  if (!selector) return;
  const action = selectorPlaygroundMarked ? ACTIONS.UNMARK_SELECTOR_MATCHES : ACTIONS.MARK_SELECTOR_MATCHES;
  sendToPage({ action, selector }, (response, error) => {
    if (error || !response) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações do seletor.";
      return;
    }
    selectorPlaygroundMarked = !selectorPlaygroundMarked;
    selectorPlaygroundMarkedSelector = selectorPlaygroundMarked ? selector : "";
    updateSelectorMarkButton(response.count || 0);
    if (pageFieldsStatus) {
      pageFieldsStatus.textContent = selectorPlaygroundMarked
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

function normalizePageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch (error) {
    return url;
  }
}

function getBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch (error) {
    return "";
  }
}

function profileId() {
  return `${activePageUrl}::${Date.now()}::${Math.random().toString(36).slice(2)}`;
}

function migrateLegacyProfiles(callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    let migrated = false;
    Object.keys(stored).forEach((legacyUrl) => {
      if (!Array.isArray(stored[legacyUrl])) return;
      const baseUrl = getBaseUrl(legacyUrl) || legacyUrl;
      const application = stored[baseUrl] && !Array.isArray(stored[baseUrl])
        ? stored[baseUrl]
        : { pages: [] };
      if (!Array.isArray(application.pages)) application.pages = [];
      const legacyId = `${legacyUrl}::legacy`;
      if (!application.pages.some((profile) => profile.id === legacyId)) {
        application.pages.push({
          id: legacyId,
          name: "Mapeamento salvo",
          pageUrl: legacyUrl,
          fields: stored[legacyUrl]
        });
      }
      stored[baseUrl] = application;
      if (legacyUrl !== baseUrl) delete stored[legacyUrl];
      migrated = true;
    });
    if (!migrated) {
      callback();
      return;
    }
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, callback);
  });
}

function readProfiles(baseUrl, callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    const profiles = stored[baseUrl];
    callback(profiles && Array.isArray(profiles.pages) ? profiles.pages : []);
  });
}

function writeProfiles(baseUrl, profiles, callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    stored[baseUrl] = { pages: profiles };
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, callback);
  });
}

function updateSavedProfiles(profiles) {
  savedProfiles = profiles.filter((profile) => normalizePageUrl(profile.pageUrl) === activePageUrl);
  if (!savedMappingsSelect) return;
  savedMappingsSelect.innerHTML = '<option value="">Nenhum mapeamento selecionado</option>' +
    savedProfiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)} (${escapeHtml(profile.pageUrl)})</option>`).join("");
  savedMappingsSelect.value = selectedProfileId;
}

function loadSavedProfile(id) {
  const profile = savedProfiles.find((item) => item.id === id);
  if (!profile) return;
  selectedProfileId = id;
  pageFields = profile.fields.map((field) => ({ ...field, fixed: Boolean(field.fixed), fixedValue: field.fixedValue || "" }));
  renderPageFields();
  if (pageFieldsStatus) pageFieldsStatus.textContent = `Mapeamento "${profile.name}" carregado.`;
}

function getCurrentProfile(profiles) {
  return profiles.find((profile) => profile.id === selectedProfileId);
}

function openMappingModal(initialName, title) {
  if (!mappingModal || !mappingNameInput) return Promise.resolve("");
  mappingModal.querySelector("#mapping-modal-title").textContent = title;
  mappingNameInput.value = initialName || "";
  mappingModalError.textContent = "";
  mappingModal.hidden = false;
  mappingNameInput.focus();
  mappingNameInput.select();
  return new Promise((resolve) => {
    mappingModalResolver = resolve;
  });
}

function closeMappingModal(value) {
  if (!mappingModal || !mappingModalResolver) return;
  mappingModal.hidden = true;
  const resolve = mappingModalResolver;
  mappingModalResolver = null;
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

function remapAllFields() {
  if (!pageFields.length) return;
  scanPageFields(true);
}

function scanPageFields(remapping = false) {
  if (!pageFieldsStatus) return;
  pageFieldsStatus.textContent = remapping ? "Remapeando campos automaticamente..." : "Lendo campos da página...";
  getActiveTab((tab) => {
    activeTab = tab;
    activePageUrl = normalizePageUrl(tab && tab.url ? tab.url : "");
    activeBaseUrl = getBaseUrl(activePageUrl);
    if (!activeTab || !activeTab.id || !/^https?:/i.test(activePageUrl)) {
      pageFields = [];
      renderPageFields();
      pageFieldsStatus.textContent = "A página ativa não permite acesso a formulários.";
      return;
    }
    sendToPage({ action: ACTIONS.SCAN_FIELDS }, (response, error) => {
      if (error || !response || response.error) {
        pageFields = [];
        renderPageFields();
        pageFieldsStatus.textContent = response && response.error
          ? response.error
          : "Não foi possível ler esta página. Recarregue-a e tente novamente.";
        return;
      }
      readProfiles(activeBaseUrl, (profiles) => {
        updateSavedProfiles(profiles);
        const selected = getCurrentProfile(profiles);
        const saved = selected && selected.fields ? selected.fields : [];
        pageFields = (response.fields || []).map((field) => {
          const mapping = saved.find((item) => item.key === field.key || item.selector === field.selector);
          return {
            ...field,
            dataType: mapping && mapping.dataType ? mapping.dataType : field.inferredType || "text",
            selector: remapping ? field.selector : (mapping && mapping.selector ? mapping.selector : field.selector),
            fixed: Boolean(mapping && mapping.fixed),
            fixedValue: mapping && mapping.fixedValue ? mapping.fixedValue : ""
          };
        });
        markedSelectors = new Set();
        updateMarkAllButton();
        renderPageFields();
        pageFieldsStatus.textContent = pageFields.length
          ? `${pageFields.length} campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.`
          : "Nenhum campo editável encontrado nesta página.";
      });
    });
  });
}

function renderPageFields() {
  if (!pageFieldsElement) return;
  pageFieldsElement.innerHTML = pageFields.map((field, index) => {
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
        <input class="page-field-fixed-value" type="text" aria-label="Valor fixo para ${escapeHtml(field.label)}" placeholder="Valor usado sempre" value="${escapeHtml(field.fixedValue || "")}" ${field.fixed ? "" : "disabled"}>
        <div class="page-field-actions">
          <button type="button" data-action="highlight">${markedSelectors.has(field.selector) ? "Desmarcar" : "Marcar"}</button>
          <button type="button" data-action="target" title="Capturar o próximo clique na página" aria-label="Capturar seletor do próximo clique">🎯</button>
          <button type="button" data-action="fill">Preencher</button>
        </div>
      </div>
    `;
  }).join("");

  pageFieldsElement.querySelectorAll(".page-field").forEach((row) => {
    const index = Number(row.dataset.index);
    row.querySelector(".page-field-type").addEventListener("change", (event) => {
      pageFields[index].dataType = event.target.value;
    });
    row.querySelector(".page-field-selector").addEventListener("input", (event) => {
      pageFields[index].selector = event.target.value;
    });
    const label = row.querySelector(".page-field-label");
    const labelEditor = row.querySelector(".page-field-label-editor");
    const editLabelButton = row.querySelector(".page-field-edit-label");
    editLabelButton.addEventListener("click", () => {
      label.hidden = true;
      editLabelButton.hidden = true;
      labelEditor.hidden = false;
      labelEditor.focus();
      labelEditor.select();
    });
    const saveLabel = () => {
      const value = labelEditor.value.trim();
      if (value) pageFields[index].label = value;
      renderPageFields();
    };
    labelEditor.addEventListener("blur", saveLabel);
    labelEditor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        labelEditor.blur();
      }
      if (event.key === "Escape") {
        labelEditor.value = pageFields[index].label;
        labelEditor.blur();
      }
    });
    row.querySelector(".page-field-fixed-toggle").addEventListener("change", (event) => {
      pageFields[index].fixed = event.target.checked;
      row.querySelector(".page-field-fixed-value").disabled = !event.target.checked;
    });
    row.querySelector(".page-field-fixed-value").addEventListener("input", (event) => {
      pageFields[index].fixedValue = event.target.value;
    });
    row.querySelector('[data-action="highlight"]').addEventListener("click", () => {
      const selector = pageFields[index].selector;
      const marked = markedSelectors.has(selector);
      sendToPage({ action: marked ? ACTIONS.UNMARK_FIELD : ACTIONS.MARK_FIELD, selector }, (response, error) => {
        if (!pageFieldsStatus) return;
        if (error || !response) {
          pageFieldsStatus.textContent = "Não foi possível marcar o campo. Recarregue a página e tente novamente.";
        } else if (!(marked ? response.unmarked : response.marked)) {
          pageFieldsStatus.textContent = "Seletor não encontrado na página. Ajuste o seletor e tente novamente.";
        } else {
          if (marked) markedSelectors.delete(selector);
          else markedSelectors.add(selector);
          updateMarkAllButton();
          renderPageFields();
          pageFieldsStatus.textContent = marked ? `${pageFields[index].label} desmarcado.` : `${pageFields[index].label} marcado.`;
        }

      });
    });
    row.querySelector('[data-action="target"]').addEventListener("click", () => captureFieldSelector(index));
    row.querySelector('[data-action="fill"]').addEventListener("click", () => fillPageField(index));
  });
}

function addNewSelector() {
  if (!activePageUrl) {
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
    if (pageFields.some((field) => field.selector === captured.selector)) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Esse seletor já está mapeado.";
      return;
    }
    pageFields.push({
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

function getMappingAudit() {
  const locators = new Set();
  return pageFields.map((field) => {
    const duplicateLocator = field.locatorName && locators.has(field.locatorName);
    if (field.locatorName) locators.add(field.locatorName);
    return {
    elemento: field.label,
    seletorGerado: field.selector,
    locator: field.locatorName || "",
    regraAplicada: field.selectorRule || "desconhecida",
    status: field.selectorStatus === "stable" && !duplicateLocator ? "estável" : "frágil — requer atenção manual",
    sugestao: duplicateLocator ? "Renomear o locator para eliminar a colisão." : (field.selectorSuggestion || "")
    };
  });
}

function auditJson() {
  return JSON.stringify(Object.fromEntries(pageFields
    .filter((field) => field.selector && field.locatorName)
    .map((field) => [field.locatorName, field.selector])), null, 2);
}

function copyMappingAudit() {
  copyText(auditJson(), copyAuditButton);
}

function updateMarkAllButton() {
  if (!markAllButton) return;
  const allMarked = pageFields.length > 0 && pageFields.every((field) => markedSelectors.has(field.selector));
  markAllButton.textContent = allMarked ? "Desmarcar todos" : "Marcar todos";
}

function toggleMarkAllFields() {
  if (!pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo encontrado para marcar.";
    return;
  }
  const markableFields = pageFields.filter((field) => field.selector);
  if (!markableFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo possui seletor utilizável para marcar.";
    return;
  }
  const allMarked = markableFields.every((field) => markedSelectors.has(field.selector));
  const action = allMarked ? ACTIONS.UNMARK_ALL_FIELDS : ACTIONS.MARK_ALL_FIELDS;
  sendToPage({ action, selectors: markableFields.map((field) => field.selector) }, (response, error) => {
    if (error || !response) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações.";
      return;
    }
    markedSelectors = new Set(allMarked ? [] : (response.selectors || []));
    updateMarkAllButton();
    renderPageFields();
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
    pageFields[index] = {
      ...pageFields[index],
      selector: response.field.selector,
      label: response.field.label || pageFields[index].label,
      inferredType: response.field.inferredType || pageFields[index].inferredType,
      dataType: pageFields[index].dataType === "text" ? response.field.inferredType : pageFields[index].dataType
    };
    renderPageFields();
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Seletor capturado. Salve o mapeamento para mantê-lo.";
  });
}

function savePageMappings() {
  if (!activePageUrl || !pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum mapeamento para salvar.";
    return;
  }
  const selectedProfile = getCurrentProfile(savedProfiles);
  if (selectedProfile) {
    persistPageMapping(selectedProfile.name, selectedProfile.id);
    return;
  }
  openMappingModal("", "Salvar novo mapeamento").then((name) => {
    if (name) persistPageMapping(name, null);
  });
}

function persistPageMapping(name, existingId) {
  const mappings = pageFields.map((field) => ({
    key: field.key,
    selector: field.selector,
    dataType: field.dataType,
    fixed: Boolean(field.fixed),
    fixedValue: field.fixed ? field.fixedValue : "",
    selectorRule: field.selectorRule || "",
    selectorStatus: field.selectorStatus || "stable",
    selectorSuggestion: field.selectorSuggestion || "",
    locatorName: field.locatorName || ""
  }));
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    let application = stored[activeBaseUrl];
    if (Array.isArray(application)) application = { pages: [] };
    if (!application || !Array.isArray(application.pages)) application = { pages: [] };
    const existing = application.pages.find((profile) => profile.id === existingId);
    const profile = { id: existing ? existing.id : profileId(), name: name.trim(), pageUrl: activePageUrl, fields: mappings, audit: getMappingAudit() };
    application.pages = existing
      ? application.pages.map((item) => item.id === profile.id ? profile : item)
      : application.pages.concat(profile);
    stored[activeBaseUrl] = application;
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, () => {
      selectedProfileId = profile.id;
      updateSavedProfiles(application.pages);
      if (pageFieldsStatus) pageFieldsStatus.textContent = `Mapeamento "${profile.name}" salvo.`;
    });
  });
}

function renameSavedProfile() {
  const profile = savedProfiles.find((item) => item.id === selectedProfileId);
  if (!profile) return;
  openMappingModal(profile.name, "Renomear mapeamento").then((name) => {
    if (!name) return;
    readProfiles(activeBaseUrl, (profiles) => {
      const updated = profiles.map((item) => item.id === profile.id ? { ...item, name } : item);
      writeProfiles(activeBaseUrl, updated, () => {
        updateSavedProfiles(updated);
        if (pageFieldsStatus) pageFieldsStatus.textContent = "Nome atualizado.";
      });
    });
  });
}

function deleteSavedProfile() {
  const profile = savedProfiles.find((item) => item.id === selectedProfileId);
  if (!profile || !window.confirm(`Excluir "${profile.name}"?`)) return;
  readProfiles(activeBaseUrl, (profiles) => {
    writeProfiles(activeBaseUrl, profiles.filter((item) => item.id !== profile.id), () => {
      selectedProfileId = "";
      updateSavedProfiles(profiles.filter((item) => item.id !== profile.id));
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Mapeamento excluído.";
    });
  });
}

function fillPageField(index) {
  const field = pageFields[index];
  if (!field) return;
  const type = field.dataType === "auto" ? field.inferredType : field.dataType;
  const value = field.fixed ? field.fixedValue : generateMappedValuePure(type, data.person.context(), field.inputType, generatorOptions);
  sendToPage({ action: ACTIONS.FILL_FIELD, selector: field.selector, value }, (response, error) => {
    if (pageFieldsStatus) {
      pageFieldsStatus.textContent = error || !response || !response.filled
        ? "Não foi possível preencher esse campo. Verifique o seletor."
        : `${field.label} preenchido.`;
    }
  });
}

function fillAllPageFields() {
  if (!pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo mapeado.";
    return;
  }
  const context = data.person.context();
  const fields = pageFields.map((field) => ({
    selector: field.selector,
    value: field.fixed ? field.fixedValue : generateMappedValuePure(field.dataType === "auto" ? field.inferredType : field.dataType, context, field.inputType, generatorOptions)
  }));
  sendToPage({ action: ACTIONS.FILL_ALL, fields }, (response, error) => {
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

// Checagem de sanidade em desenvolvimento: garante que o próprio gerador
// nunca produza um CPF/CNPJ com dígito verificador inválido (regressão silenciosa).
function autovalidar(resultado) {
  if (resultado.CPF) {
    console.assert(validarCPF(resultado.CPF), "CPF gerado é inválido:", resultado.CPF);
  }
  if (resultado.CNPJ) {
    console.assert(validarCNPJ(resultado.CNPJ), "CNPJ gerado é inválido:", resultado.CNPJ);
  }
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