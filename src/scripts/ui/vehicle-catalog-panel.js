import { addVehicleModel, normalizeVehicleCatalog, removeVehicleBrand, removeVehicleModel, renameVehicleBrand } from "../data/vehicle-catalog.js";
import { escapeHtml } from "../domain/html-utils.js";

export function initVehicleCatalogPanel({ state, refs, generate, openRenameBrandModal }) {
  const {
    brandInput,
    modelInput,
    addButton,
    list,
    status,
    openButton,
    modal,
    closeButton
  } = refs;

  function saveVehicleCatalog() {
    chrome.storage.local.set({ "fakedata-vehicle-catalog": state.vehicleCatalog }, () => {
      if (chrome.runtime.lastError) {
        status.textContent = "Não foi possível salvar o catálogo.";
        return;
      }
      renderVehicleCatalog();
      generate();
    });
  }

  function renderVehicleCatalog() {
    if (!list) return;
    list.innerHTML = state.vehicleCatalog.length
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
    list.querySelectorAll("[data-remove-brand]").forEach((button) => {
      button.addEventListener("click", () => {
        state.vehicleCatalog = removeVehicleBrand(state.vehicleCatalog, button.dataset.removeBrand);
        saveVehicleCatalog();
      });
    });
    list.querySelectorAll("[data-edit-brand]").forEach((button) => {
      button.addEventListener("click", async () => {
        const newName = await openRenameBrandModal(button.dataset.editBrand);
        if (!newName) return;
        try {
          state.vehicleCatalog = renameVehicleBrand(state.vehicleCatalog, button.dataset.editBrand, newName);
          saveVehicleCatalog();
        } catch (error) {
          status.textContent = error.message;
        }
      });
    });
    list.querySelectorAll("[data-edit-model]").forEach((button) => {
      button.addEventListener("click", () => {
        brandInput.value = button.dataset.editModel;
        modelInput.value = button.dataset.model;
        state.vehicleCatalog = removeVehicleModel(state.vehicleCatalog, button.dataset.editModel, button.dataset.model);
        saveVehicleCatalog();
        modelInput.focus();
      });
    });
    list.querySelectorAll("[data-remove-model]").forEach((button) => {
      button.addEventListener("click", () => {
        state.vehicleCatalog = removeVehicleModel(state.vehicleCatalog, button.dataset.removeModel, button.dataset.model);
        saveVehicleCatalog();
      });
    });
  }

  function addVehicle() {
    try {
      state.vehicleCatalog = addVehicleModel(state.vehicleCatalog, brandInput.value, modelInput.value);
      brandInput.value = "";
      modelInput.value = "";
      status.textContent = "Veículo cadastrado.";
      saveVehicleCatalog();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function load() {
    chrome.storage.local.get({ "fakedata-vehicle-catalog": [] }, (result) => {
      state.vehicleCatalog = normalizeVehicleCatalog(result["fakedata-vehicle-catalog"]);
      renderVehicleCatalog();
      generate();
    });
  }

  function close() {
    if (modal) modal.hidden = true;
  }

  function open() {
    if (!modal) return;
    modal.hidden = false;
    brandInput.focus();
  }

  if (addButton) addButton.addEventListener("click", addVehicle);
  if (openButton) openButton.addEventListener("click", open);
  if (closeButton) closeButton.addEventListener("click", close);
  if (modal) {
    modal.querySelector("[data-vehicle-modal-close]").addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  return { load, render: renderVehicleCatalog, open, close };
}
