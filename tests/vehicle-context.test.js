import { describe, expect, it, vi } from "vitest";
import { DEFAULT_VEHICLE_CATALOG } from "../src/scripts/data/vehicle-catalog.js";
import { resolveVehicleContext } from "../src/scripts/domain/vehicle-context.js";

const catalog = [
  { marca: "Fiat", modelos: ["Argo", "Mobi"] },
  { marca: "Toyota", modelos: ["Corolla"] },
];
const pickFirst = (items) => items[0];
const pickLast = (items) => items[items.length - 1];

function brandField(value, extra = {}) {
  return { dataType: "brand", value, ...extra };
}

function modelField(value, extra = {}) {
  return { dataType: "model", value, ...extra };
}

describe("vehicle-context", () => {
  it("sem campos de marca/modelo devolve um veículo do catálogo", () => {
    expect(resolveVehicleContext(catalog, [], pickFirst)).toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, null, pickFirst)).toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, [{ dataType: "email", value: "x" }], pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, [{ dataType: "brand" }, { dataType: "model" }], pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  it("com marca presente escolhe um modelo da própria marca", () => {
    expect(resolveVehicleContext(catalog, [brandField("Toyota")], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [brandField("Fiat")], pickLast))
      .toEqual({ marca: "Fiat", modelo: "Mobi" });
  });

  it("usa fixedValue com prioridade sobre value", () => {
    const field = brandField("Fiat", { fixed: true, fixedValue: "Toyota" });
    expect(resolveVehicleContext(catalog, [field], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });

    const model = modelField("Argo", { fixed: true, fixedValue: "Corolla" });
    expect(resolveVehicleContext(catalog, [model], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
  });

  it("ignora marca fora do catálogo e cai no fallback", () => {
    expect(resolveVehicleContext(catalog, [brandField("Ferrari")], pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  it("usa o dono do modelo quando a marca não está no catálogo", () => {
    const fields = [brandField("Ferrari"), modelField("Corolla")];
    expect(resolveVehicleContext(catalog, fields, pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
  });

  it("com modelo presente e sem marca devolve a marca dona do modelo", () => {
    expect(resolveVehicleContext(catalog, [modelField("Corolla")], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [modelField("Mobi")], pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Mobi" });
  });

  it("no preenchimento da marca prioriza o modelo presente", () => {
    const fields = [brandField("Fiat"), modelField("Corolla")];
    expect(resolveVehicleContext(catalog, fields, pickFirst, "brand"))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [modelField("Argo")], pickFirst, "brand"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, [brandField("Toyota")], pickFirst, "brand"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  it("no preenchimento do modelo usa a marca presente", () => {
    expect(resolveVehicleContext(catalog, [brandField("Toyota")], pickFirst, "model"))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
  });

  it("resolve o par inconsistente de acordo com o tipo alvo", () => {
    const fields = [brandField("Fiat"), modelField("Corolla")];

    expect(resolveVehicleContext(catalog, fields, pickFirst, "brand"))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, fields, pickFirst, "model"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, fields, pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  it("compara sem diferenciar maiúsculas e espaços, devolvendo a grafia do catálogo", () => {
    const fields = [brandField("  fIaT "), modelField(" aRgO ")];
    expect(resolveVehicleContext(catalog, fields, pickFirst, "model"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(resolveVehicleContext(catalog, [modelField(" cOrOlLa ")], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [brandField("  fIaT ")], pickLast))
      .toEqual({ marca: "Fiat", modelo: "Mobi" });
  });

  it("usa DEFAULT_VEHICLE_CATALOG quando o catálogo está vazio", () => {
    expect(resolveVehicleContext([], [], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });

    const lastBrand = DEFAULT_VEHICLE_CATALOG[DEFAULT_VEHICLE_CATALOG.length - 1];
    expect(resolveVehicleContext(null, [brandField("Ferrari")], pickLast)).toEqual({
      marca: lastBrand.marca,
      modelo: lastBrand.modelos[lastBrand.modelos.length - 1],
    });
  });

  it("ignora marcas sem modelos", () => {
    const partial = [{ marca: "Vazio", modelos: [] }, { marca: "Ford", modelos: ["Ka"] }];
    expect(resolveVehicleContext(partial, [brandField("Vazio")], pickFirst))
      .toEqual({ marca: "Ford", modelo: "Ka" });

    expect(resolveVehicleContext([{ marca: "Vazio", modelos: [] }], [brandField("Vazio")], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
  });

  it("usa o pick recebido para escolher o modelo da marca", () => {
    const pick = vi.fn(pickLast);
    expect(resolveVehicleContext(catalog, [brandField("Fiat")], pick))
      .toEqual({ marca: "Fiat", modelo: "Mobi" });
    expect(pick).toHaveBeenCalledTimes(1);
    expect(pick).toHaveBeenCalledWith(["Argo", "Mobi"]);
  });

  it("usa o pick recebido também no fallback de marca e modelo", () => {
    const pick = vi.fn(pickLast);
    expect(resolveVehicleContext(catalog, [], pick))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(pick).toHaveBeenNthCalledWith(1, catalog);
    expect(pick).toHaveBeenNthCalledWith(2, ["Corolla"]);
  });

  it("reconhece o tipo real de campos com dataType auto", () => {
    const autoBrand = { dataType: "auto", inferredType: "brand", value: "Toyota" };
    const autoModel = { dataType: "auto", inferredType: "model", value: "Corolla" };
    const semDataType = { inferredType: "brand", value: "Fiat" };

    expect(resolveVehicleContext(catalog, [autoBrand], pickFirst, "model"))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [autoModel], pickFirst))
      .toEqual({ marca: "Toyota", modelo: "Corolla" });
    expect(resolveVehicleContext(catalog, [semDataType], pickFirst, "model"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  it("preserva o par coerente sem sortear outro modelo", () => {
    const pick = vi.fn(pickLast);
    const fields = [brandField("Fiat"), modelField("Argo")];

    expect(resolveVehicleContext(catalog, fields, pick, "model"))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
    expect(pick).not.toHaveBeenCalled();
  });

  it("usa a primeira marca quando o mesmo modelo existe em mais de uma", () => {
    const duplicated = [
      { marca: "Fiat", modelos: ["Argo"] },
      { marca: "Toyota", modelos: ["Argo"] },
    ];

    expect(resolveVehicleContext(duplicated, [modelField("Argo")], pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });

  // Regressão P4: modelo homônimo em duas marcas; a marca já fixada no formulário vence.
  it("no preenchimento da marca, a marca do formulário vence quando também possui o modelo", () => {
    const duplicated = [
      { marca: "Fiat", modelos: ["Argo"] },
      { marca: "Toyota", modelos: ["Argo"] },
    ];
    const fields = [
      brandField("Toyota", { fixed: true, fixedValue: "Toyota" }),
      modelField("Argo", { fixed: true, fixedValue: "Argo" }),
    ];

    expect(resolveVehicleContext(duplicated, fields, pickFirst, "brand"))
      .toEqual({ marca: "Toyota", modelo: "Argo" });

    const caseInsensitive = [
      brandField("toyota", { fixed: true, fixedValue: "toyota" }),
      modelField("ARGO", { fixed: true, fixedValue: "ARGO" }),
    ];
    expect(resolveVehicleContext(duplicated, caseInsensitive, pickFirst, "brand"))
      .toEqual({ marca: "Toyota", modelo: "Argo" });
  });

  it("ignora entradas nulas e campos sem tipo conhecido", () => {
    const fields = [null, { value: "sem tipo" }, { dataType: "auto", value: "sem inferência" }];

    expect(resolveVehicleContext(catalog, fields, pickFirst))
      .toEqual({ marca: "Fiat", modelo: "Argo" });
  });
});
