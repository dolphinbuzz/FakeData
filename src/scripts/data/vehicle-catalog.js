export const DEFAULT_VEHICLE_CATALOG = [
  { marca: "Toyota", modelos: ["Corolla"] },
  { marca: "Volkswagen", modelos: ["T-Cross"] },
  { marca: "Chevrolet", modelos: ["Onix"] },
  { marca: "Honda", modelos: ["Civic"] },
  { marca: "Fiat", modelos: ["Argo"] },
  { marca: "Hyundai", modelos: ["HB20"] },
  { marca: "Nissan", modelos: ["Kicks"] },
  { marca: "Renault", modelos: ["Kwid"] },
  { marca: "Ford", modelos: ["Ranger"] },
  { marca: "Jeep", modelos: ["Compass"] },
  { marca: "Kia", modelos: ["Sportage"] },
  { marca: "BYD", modelos: ["Dolphin"] }
];

export function normalizeVehicleCatalog(value) {
  if (!Array.isArray(value)) return [];
  const brands = [];
  const seenBrands = new Set();
  value.forEach((entry) => {
    const marca = String(entry && (entry.marca || entry.brand) || "").trim();
    if (!marca) return;
    const brandKey = marca.toLocaleLowerCase();
    if (seenBrands.has(brandKey)) return;
    const modelos = Array.isArray(entry.modelos || entry.models) ? entry.modelos || entry.models : [];
    const uniqueModels = [...new Map(modelos
      .map((model) => String(model || "").trim())
      .filter(Boolean)
      .map((model) => [model.toLocaleLowerCase(), model])).values()];
    seenBrands.add(brandKey);
    brands.push({ marca, modelos: uniqueModels });
  });
  return brands;
}

export function validateVehicleEntry(marca, modelo) {
  const brand = String(marca || "").trim();
  const model = String(modelo || "").trim();
  if (!brand) return "Informe uma marca.";
  if (!model) return "Informe um modelo.";
  return "";
}

export function addVehicleModel(catalog, marca, modelo) {
  const error = validateVehicleEntry(marca, modelo);
  if (error) throw new Error(error);
  const next = normalizeVehicleCatalog(catalog);
  const brand = String(marca).trim();
  const model = String(modelo).trim();
  const existing = next.find((entry) => entry.marca.toLocaleLowerCase() === brand.toLocaleLowerCase());
  if (existing) {
    if (!existing.modelos.some((item) => item.toLocaleLowerCase() === model.toLocaleLowerCase())) {
      existing.modelos.push(model);
    }
    return next;
  }
  next.push({ marca: brand, modelos: [model] });
  return next;
}

export function removeVehicleModel(catalog, marca, modelo) {
  return normalizeVehicleCatalog(catalog)
    .map((entry) => entry.marca.toLocaleLowerCase() === String(marca).toLocaleLowerCase()
      ? { ...entry, modelos: entry.modelos.filter((item) => item.toLocaleLowerCase() !== String(modelo).toLocaleLowerCase()) }
      : entry)
    .filter((entry) => entry.modelos.length);
}

export function removeVehicleBrand(catalog, marca) {
  return normalizeVehicleCatalog(catalog)
    .filter((entry) => entry.marca.toLocaleLowerCase() !== String(marca).toLocaleLowerCase());
}

export function renameVehicleBrand(catalog, marca, novoNome) {
  const name = String(novoNome || "").trim();
  if (!name) throw new Error("Informe uma marca.");
  const current = normalizeVehicleCatalog(catalog);
  const target = current.find((entry) => entry.marca.toLocaleLowerCase() === String(marca).toLocaleLowerCase());
  if (!target) return current;
  if (current.some((entry) => entry !== target && entry.marca.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error("Essa marca já está cadastrada.");
  }
  target.marca = name;
  return current;
}

export function renameVehicleModel(catalog, marca, modelo, novoModelo) {
  const name = String(novoModelo || "").trim();
  if (!name) throw new Error("Informe um modelo.");
  const current = normalizeVehicleCatalog(catalog);
  const target = current.find((entry) => entry.marca.toLocaleLowerCase() === String(marca).toLocaleLowerCase());
  if (!target) return current;
  if (target.modelos.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase() &&
    item.toLocaleLowerCase() !== String(modelo).toLocaleLowerCase())) {
    throw new Error("Esse modelo já está cadastrado para a marca.");
  }
  target.modelos = target.modelos.map((item) =>
    item.toLocaleLowerCase() === String(modelo).toLocaleLowerCase() ? name : item);
  return current;
}

export function pickVehicle(catalog, pick) {
  const source = normalizeVehicleCatalog(catalog).filter((entry) => entry.modelos.length);
  const fallback = normalizeVehicleCatalog(DEFAULT_VEHICLE_CATALOG);
  const brands = source.length ? source : fallback;
  const brand = pick(brands);
  return { marca: brand.marca, modelo: pick(brand.modelos) };
}
