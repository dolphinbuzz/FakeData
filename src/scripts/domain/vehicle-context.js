import { DEFAULT_VEHICLE_CATALOG, normalizeVehicleCatalog, pickVehicle } from "../data/vehicle-catalog.js";
import { resolveFieldType } from "./field-value.js";

// A2: mantém marca e modelo coerentes no preenchimento individual.
// Usa apenas o `pick` recebido; não acessa document, window nem chrome.
function compareKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

// `dataType: "auto"` guarda o tipo real em `inferredType` (ver resolveFieldType).
function fieldType(field) {
  if (!field) return "";
  return resolveFieldType(field) || field.inferredType || "";
}

function fieldValue(field) {
  if (!field) return "";
  const raw = field.fixed ? field.fixedValue : field.value;
  return String(raw ?? "").trim();
}

export function resolveVehicleContext(catalog, fields, pick, targetType = "") {
  const source = normalizeVehicleCatalog(catalog).filter((entry) => entry.modelos.length);
  const brands = source.length ? source : normalizeVehicleCatalog(DEFAULT_VEHICLE_CATALOG);
  const list = Array.isArray(fields) ? fields : [];
  const brandField = list.find((field) => fieldType(field) === "brand");
  const modelField = list.find((field) => fieldType(field) === "model");
  const brandKey = compareKey(fieldValue(brandField));
  const modelKey = compareKey(fieldValue(modelField));
  const brandEntry = brandKey ? brands.find((entry) => compareKey(entry.marca) === brandKey) : undefined;
  let modelOwner;
  let ownedModel = "";
  if (modelKey) {
    for (const entry of brands) {
      const matched = entry.modelos.find((modelo) => compareKey(modelo) === modelKey);
      if (matched) {
        modelOwner = entry;
        ownedModel = matched;
        break;
      }
    }
  }

  // No preenchimento da marca, um modelo já informado manda na escolha do veículo.
  if (targetType === "brand") {
    if (modelOwner) return { marca: modelOwner.marca, modelo: ownedModel };
    return pickVehicle(brands, pick);
  }

  if (brandEntry) {
    if (modelOwner === brandEntry) return { marca: brandEntry.marca, modelo: ownedModel };
    return { marca: brandEntry.marca, modelo: pick(brandEntry.modelos) };
  }
  if (modelOwner) return { marca: modelOwner.marca, modelo: ownedModel };
  return pickVehicle(brands, pick);
}
