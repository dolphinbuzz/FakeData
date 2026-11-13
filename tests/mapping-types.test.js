import { describe, expect, it } from "vitest";
import { filterMappingTypes, MAPPING_TYPES } from "../src/scripts/data/mapping-types.js";

describe("mapping-types", () => {
  it("ordena os rótulos alfabeticamente em português", () => {
    const labels = MAPPING_TYPES.map(([, label]) => label);
    const sortedLabels = [...labels].sort((first, second) =>
      first.localeCompare(second, "pt-BR", { sensitivity: "base" })
    );

    expect(labels).toEqual(sortedLabels);
  });

  it("filtra por rótulo ou chave sem diferenciar caixa e acentos", () => {
    expect(filterMappingTypes("ENDERECO")).toEqual([["address", "Endereço"]]);
    expect(filterMappingTypes("BIRTHdate")).toEqual([["birthDate", "Data de nascimento"]]);
  });

  it("retorna todos os tipos quando a busca está vazia", () => {
    expect(filterMappingTypes("  ")).toBe(MAPPING_TYPES);
  });
});
