import { getMappingAudit } from "../domain/mapping-audit.js";
import { escapeHtml } from "../domain/html-utils.js";
import { normalizePageUrl } from "../domain/url-utils.js";
import { readProfiles, writeProfiles } from "../services/profiles-repository.js";

export function initProfileControls({ state, refs, renderPageFields }) {
  const {
    savedMappingsSelect,
    renameMappingButton,
    deleteMappingButton,
    pageFieldsStatus,
    mappingModal,
    mappingNameInput,
    mappingModalError,
    mappingModalConfirm,
    mappingModalCancel
  } = refs;

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
      const profile = {
        id: existing ? existing.id : profileId(),
        name: name.trim(),
        pageUrl: state.activePageUrl,
        fields: mappings,
        audit: getMappingAudit(state.pageFields)
      };
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

  function clearSelection() {
    if (savedMappingsSelect) {
      savedMappingsSelect.innerHTML = '<option value="">Nenhum mapeamento selecionado</option>';
      savedMappingsSelect.value = "";
    }
  }

  if (savedMappingsSelect) savedMappingsSelect.addEventListener("change", () => loadSavedProfile(savedMappingsSelect.value));
  if (renameMappingButton) renameMappingButton.addEventListener("click", renameSavedProfile);
  if (deleteMappingButton) deleteMappingButton.addEventListener("click", deleteSavedProfile);
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

  return {
    readProfiles,
    updateSavedProfiles,
    loadSavedProfile,
    getCurrentProfile,
    openMappingModal,
    persistPageMapping,
    openRenameBrandModal,
    clearSelection
  };
}
