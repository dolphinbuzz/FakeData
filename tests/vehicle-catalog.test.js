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
});
