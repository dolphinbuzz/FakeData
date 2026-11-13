import { createGeneratorData, generateMappedValue as generateMappedValuePure, pick } from "../generators.js";
import { DDDS, ESTADOS } from "../data/estados.js";
import { escapeHtml } from "../domain/html-utils.js";
import { parseBatchSize, serializeRecordsAsCsv, serializeRecordsAsJson } from "../domain/batch-export.js";
import { resolveFieldValue } from "../domain/field-value.js";
import { resolveVehicleContext } from "../domain/vehicle-context.js";

export function initGeneratorPanel({ state, refs, copyText }) {
  const {
    resultSection,
    resultFields,
    resultTitle,
    generateLabel,
    generateButton,
    copyJsonButton,
    batchSizeInput,
    batchStatus,
    exportJsonButton,
    exportCsvButton,
    personOptions,
    companyOptions,
    vehicleOptions,
    openVehicleCatalogButton,
    ufSelect,
    cpfFormatted,
    cnpjFormatted,
    cnpjAlphanumeric,
    renavamFormatted,
    typeButtons
  } = refs;

  const generatorConfig = {
    getState: () => gerarEstadoSelecionado(),
    ddds: DDDS,
    getCpfFormatted: () => cpfFormatted ? cpfFormatted.checked : true,
    getCnpjFormatted: () => cnpjFormatted ? cnpjFormatted.checked : true,
    getCnpjAlphanumeric: () => cnpjAlphanumeric ? cnpjAlphanumeric.checked : false,
    getRenavamFormatted: () => renavamFormatted ? renavamFormatted.checked : false,
    getVehicleCatalog: () => state.vehicleCatalog
  };
  const data = createGeneratorData(generatorConfig);
  let currentBatch = [];

  ESTADOS.forEach((estado) => {
    const option = document.createElement("option");
    option.value = estado.sigla;
    option.textContent = `${estado.sigla} - ${estado.nome}`;
    ufSelect.appendChild(option);
  });
  ufSelect.value = localStorage.getItem("fakedata-uf") || "ALL";

  typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedType = button.dataset.type;
      typeButtons.forEach((item) => item.classList.remove("active"));
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
  copyJsonButton.addEventListener("click", () => copyText(
    currentBatch.length > 1 ? serializeRecordsAsJson(currentBatch) : JSON.stringify(state.currentResult, null, 2),
    copyJsonButton
  ));
  if (exportJsonButton) exportJsonButton.addEventListener("click", () => downloadBatch("json"));
  if (exportCsvButton) exportCsvButton.addEventListener("click", () => downloadBatch("csv"));

  function gerarEstadoSelecionado() {
    const selectedUf = ufSelect.value;
    if (selectedUf === "ALL") return pick(ESTADOS);
    return ESTADOS.find((estado) => estado.sigla === selectedUf) || pick(ESTADOS);
  }

  function generate() {
    const definition = data[state.selectedType];
    let count;
    try {
      count = parseBatchSize(batchSizeInput ? batchSizeInput.value : 1);
    } catch (error) {
      currentBatch = [];
      setBatchActionsEnabled(false);
      if (batchStatus) batchStatus.textContent = error.message;
      return;
    }
    currentBatch = Array.from({ length: count }, () => {
      const context = definition.context ? definition.context() : {};
      return Object.fromEntries(definition.fields.map(([label, create]) => [label, create(context)]));
    });
    setBatchActionsEnabled(true);
    state.currentResult = currentBatch[0];

    resultTitle.textContent = count > 1 ? `${definition.label}: ${count} registros` : definition.title;
    if (batchStatus) batchStatus.textContent = count === 1
      ? "1 registro gerado."
      : `${count} registros gerados.`;
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

  function setBatchActionsEnabled(enabled) {
    [copyJsonButton, exportJsonButton, exportCsvButton].forEach((button) => {
      if (button) button.disabled = !enabled;
    });
  }

  function downloadBatch(format) {
    if (!currentBatch.length) {
      if (batchStatus) batchStatus.textContent = "Gere registros válidos antes de exportar.";
      return;
    }
    const isJson = format === "json";
    const extension = isJson ? "json" : "csv";
    const mimeType = isJson ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
    try {
      const content = isJson
        ? serializeRecordsAsJson(currentBatch)
        : serializeRecordsAsCsv(currentBatch);
      const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `fakedata-${state.selectedType}-${currentBatch.length}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error("Não foi possível exportar os registros.", error);
      if (batchStatus) batchStatus.textContent = "Não foi possível exportar os registros.";
    }
  }

  function generateFieldValue(field) {
    return resolveFieldValue(field, (type, inputType) => {
      const vehicleContext = resolveVehicleContext(state.vehicleCatalog, state.pageFields, pick, type);
      return generateMappedValuePure(type, data.person.context(), inputType, { ...generatorConfig, vehicleContext });
    });
  }

  // Only pinned fields constrain vehicle brand/model selection for bulk fills.
  function generateAllFieldValues(fields) {
    const context = data.person.context();
    const pinnedFields = fields.map((field) => (field.fixed ? field : { ...field, value: "" }));
    const vehicleContext = resolveVehicleContext(state.vehicleCatalog, pinnedFields, pick);
    return fields.map((field) => resolveFieldValue(field, (type, inputType) =>
      generateMappedValuePure(type, context, inputType, { ...generatorConfig, vehicleContext })));
  }

  return { generate, generateFieldValue, generateAllFieldValues };
}
