import { describe, expect, it } from "vitest";
import {
  addVehicleModel,
  DEFAULT_VEHICLE_CATALOG,
  normalizeVehicleCatalog,
  pickVehicle,
  removeVehicleBrand,
  removeVehicleModel,
  renameVehicleBrand,
  renameVehicleModel
} from "../src/scripts/data/vehicle-catalog.js";

describe("catálogo de veículos", () => {
  it("mantém vários modelos vinculados a uma única marca", () => {
    const catalog = addVehicleModel(addVehicleModel([], "Ford", "Ranger"), "Ford", "Ka");
    expect(catalog).toEqual([{ marca: "Ford", modelos: ["Ranger", "Ka"] }]);
    expect(addVehicleModel(catalog, "ford", "ranger")).toEqual(catalog);
  });

  it("normaliza dados inválidos, duplicados e formatos legados", () => {
    expect(normalizeVehicleCatalog([
      { brand: " Fiat ", models: ["Argo", "Argo", " "] },
      { marca: "", modelos: ["Ignorado"] },
      { marca: "Fiat", modelos: ["Mobi"] }
    ])).toEqual([{ marca: "Fiat", modelos: ["Argo"] }]);
  });

  it("seleciona um modelo somente da marca selecionada", () => {
    const result = pickVehicle([{ marca: "Ford", modelos: ["Ranger", "Ka"] }], (items) => items[0]);
    expect(result).toEqual({ marca: "Ford", modelo: "Ranger" });
    expect(pickVehicle([], (items) => items[0])).toEqual({
      marca: DEFAULT_VEHICLE_CATALOG[0].marca,
      modelo: DEFAULT_VEHICLE_CATALOG[0].modelos[0]
    });
  });

  it("permite editar e excluir marcas e modelos", () => {
    let catalog = [{ marca: "Ford", modelos: ["Ka", "Ranger"] }];
    catalog = renameVehicleBrand(catalog, "Ford", "Ford Brasil");
    catalog = renameVehicleModel(catalog, "Ford Brasil", "Ka", "Ka Sedan");
    expect(removeVehicleModel(catalog, "Ford Brasil", "Ranger")).toEqual([
      { marca: "Ford Brasil", modelos: ["Ka Sedan"] }
    ]);
    expect(removeVehicleBrand(catalog, "Ford Brasil")).toEqual([]);
  });

  it("rejeita marca ou modelo vazio", () => {
    expect(() => addVehicleModel([], "", "Ka")).toThrow("Informe uma marca.");
    expect(() => addVehicleModel([], "Ford", "")).toThrow("Informe um modelo.");
  });

  it("rejeita renomeação de marca para nome já existente", () => {
    let catalog = [
      { marca: "Ford", modelos: ["Ka"] },
      { marca: "Chevrolet", modelos: ["Onix"] }
    ];
    expect(() => renameVehicleBrand(catalog, "Ford", "Chevrolet")).toThrow("Essa marca já está cadastrada.");
  });

  it("rejeita renomeação de modelo para nome já existente na marca", () => {
    let catalog = [{ marca: "Ford", modelos: ["Ka", "Ranger"] }];
    expect(() => renameVehicleModel(catalog, "Ford", "Ka", "Ranger")).toThrow("Esse modelo já está cadastrado para a marca.");
  });

  it("retorna catálogo atual se marca não existe ao renomear", () => {
    const catalog = [{ marca: "Ford", modelos: ["Ka"] }];
    expect(renameVehicleBrand(catalog, "Chevrolet", "Ford")).toEqual(catalog);
    expect(renameVehicleModel(catalog, "Chevrolet", "Onix", "Ka")).toEqual(catalog);
  });

  it("retorna lista vazia para valores que não são array", () => {
    expect(normalizeVehicleCatalog(null)).toEqual([]);
    expect(normalizeVehicleCatalog(undefined)).toEqual([]);
    expect(normalizeVehicleCatalog("Ford")).toEqual([]);
  });

  it("ignora modelos não-array e valores vazios", () => {
    expect(normalizeVehicleCatalog([
      { marca: "Ford", modelos: "Ka" },
      { marca: "Fiat", models: [null, "", "  ", "Argo"] }
    ])).toEqual([
      { marca: "Ford", modelos: [] },
      { marca: "Fiat", modelos: ["Argo"] }
    ]);
  });

  it("remove modelo somente da marca informada", () => {
    const catalog = [
      { marca: "Ford", modelos: ["Ka", "Ranger"] },
      { marca: "Fiat", modelos: ["Argo"] }
    ];
    expect(removeVehicleModel(catalog, "Ford", "Ka")).toEqual([
      { marca: "Ford", modelos: ["Ranger"] },
      { marca: "Fiat", modelos: ["Argo"] }
    ]);
  });

  it("rejeita nomes vazios ao renomear marca ou modelo", () => {
    const catalog = [{ marca: "Ford", modelos: ["Ka"] }];
    expect(() => renameVehicleBrand(catalog, "Ford", "")).toThrow("Informe uma marca.");
    expect(() => renameVehicleModel(catalog, "Ford", "Ka", "")).toThrow("Informe um modelo.");
  });
});
