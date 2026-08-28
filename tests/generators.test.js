import { describe, expect, it } from "vitest";
import {
  cnpj,
  cpf,
  createGeneratorData,
  generateMappedValue,
  validarCNPJ,
  validarCPF
} from "../src/scripts/generators.js";

describe("geradores", () => {
  it("gera CPFs válidos formatados e sem máscara", () => {
    expect(validarCPF(cpf())).toBe(true);
    expect(validarCPF(cpf(false))).toBe(true);
    expect(validarCPF("111.111.111-11")).toBe(false);
  });

  it("gera CNPJs válidos nos formatos numérico e alfanumérico", () => {
    expect(validarCNPJ(cnpj())).toBe(true);
    expect(validarCNPJ(cnpj(false, true))).toBe(true);
    expect(validarCNPJ("00.000.000/0000-00")).toBe(true);
    expect(validarCNPJ("12.345.678/0001-90")).toBe(false);
  });

  it("cria dados sem depender do DOM", () => {
    const state = { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo"], ddds: ["11"] };
    const data = createGeneratorData({ getState: () => state, ddds: ["11"] });
    const context = data.person.context();
    const result = Object.fromEntries(data.person.fields.map(([label, create]) => [label, create(context)]));

    expect(result.Estado).toBe("SP - São Paulo");
    expect(result.Telefone).toMatch(/^\(11\) 9\d{4}-\d{4}$/);
    expect(generateMappedValue("city", context, "", { ddds: ["11"] })).toBe("São Paulo");
  });
});
