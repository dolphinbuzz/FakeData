import { describe, expect, it } from "vitest";
import {
  cnpj,
  cpf,
  createGeneratorData,
  digits,
  gerarAno,
  gerarPlaca,
  gerarSite,
  generateMappedValue,
  letters,
  normalizar,
  pad,
  randomInt,
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
    const companyData = createGeneratorData({ getState: () => state, ddds: ["11"] });
    for (const definition of [companyData.vehicle, companyData.company]) {
      const generatedContext = definition.context();
      definition.fields.forEach(([, create]) => expect(create(generatedContext)).toBeTruthy());
    }
  });

  it("mantém contratos de utilitários e formatos de veículo", () => {
    expect(digits(8)).toMatch(/^\d{8}$/);
    expect(letters(8)).toMatch(/^[A-Z]{8}$/);
    expect(randomInt(4, 4)).toBe(4);
    expect(pad(7)).toBe("07");
    expect(normalizar("João Áureo")).toBe("joao aureo");
    expect(gerarPlaca()).toMatch(/^[A-Z]{3}(?:\d[A-Z]\d{2}|-\d{4})$/);
    expect(gerarAno()).toMatch(/^20\d{2}\/20\d{2}$/);
    expect(gerarSite("São Paulo Teste")).toMatch(/^https:\/\/www\.saopauloteste\d{1,2}\.com\.br$/);
  });

  it("rejeita documentos inválidos e aceita entradas mascaradas", () => {
    expect(validarCPF("123")).toBe(false);
    expect(validarCPF(null)).toBe(false);
    expect(validarCPF("529.982.247-25")).toBe(true);
    expect(validarCNPJ("")).toBe(false);
    expect(validarCNPJ("04.252.011/0001-10")).toBe(true);
    expect(validarCNPJ("04.252.011/0001-11")).toBe(false);
  });

  it("mapeia tipos especiais e usa fallback para tipos desconhecidos", () => {
    const context = {
      nome: "Ana",
      sobrenome: "Teste",
      mae: "Maria",
      pai: "Joao",
      cep: "01000-000",
      endereco: "Rua A",
      numero: "10",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo"], ddds: ["11"] }
    };
    expect(generateMappedValue("text", context, "checkbox")).toEqual(expect.any(Boolean));
    expect(generateMappedValue("text", context, "radio")).toBe(true);
    expect(generateMappedValue("unknown", context)).toMatch(/^(acme|qa-lab|teste|sandbox|exemplo)\d{2}$/);
  });
});
