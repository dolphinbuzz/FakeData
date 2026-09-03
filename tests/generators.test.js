import { describe, expect, it } from "vitest";
import {
  cnpj,
  cpf,
  createGeneratorData,
  digits,
  gerarAno,
  gerarChassi,
  gerarEmailPessoa,
  gerarNomeFiliacao,
  gerarPlaca,
  gerarSite,
  generateMappedValue,
  letters,
  normalizar,
  pad,
  randomInt,
  validarCNPJ,
  validarCPF,
  validarChassi
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
    expect(result.Nome).toBe(`${context.nome} ${context.sobrenome}`);
    expect(context.sobrenome.split(/\s+/)).toHaveLength(2);
    expect(context.sobrenome.split(/\s+/)[0]).not.toBe(context.sobrenome.split(/\s+/)[1]);
    expect(result.Telefone).toMatch(/^\(11\) 9\d{4}-\d{4}$/);
    expect(generateMappedValue("city", context, "", { ddds: ["11"] })).toBe("São Paulo");
    const companyData = createGeneratorData({ getState: () => state, ddds: ["11"] });
    for (const definition of [companyData.vehicle, companyData.company]) {
      const generatedContext = definition.context();
      definition.fields.forEach(([, create]) => expect(create(generatedContext)).toBeTruthy());
    }
  });

  it("gera nomes variados com dois sobrenomes distintos", () => {
    const names = Array.from({ length: 60 }, () => {
      const context = createGeneratorData().person.context();
      const parts = context.sobrenome.split(/\s+/);
      return { ...context, parts };
    });

    expect(new Set(names.map(({ nome }) => nome)).size).toBeGreaterThan(1);
    expect(names.every(({ parts }) => parts.length === 2 && parts[0] !== parts[1])).toBe(true);
    expect(names.every(({ nome, parts }) => `${nome} ${parts.join(" ")}`.split(/\s+/).length >= 3)).toBe(true);
  });

  it("mantém e-mails válidos com sobrenomes compostos", () => {
    const email = gerarEmailPessoa("Ana Beatriz", "Silva Costa");
    expect(email).toMatch(/^ana\.silva\.costa\d+@[a-z.]+$/);
    const filiation = gerarNomeFiliacao().trim().split(/\s+/);
    expect(filiation.length).toBeGreaterThanOrEqual(4);
    expect(filiation.at(-1)).not.toBe(filiation.at(-2));
  });

  it("mantém contratos de utilitários e formatos de veículo", () => {
    expect(digits(8)).toMatch(/^\d{8}$/);
    expect(letters(8)).toMatch(/^[A-Z]{8}$/);
    expect(randomInt(4, 4)).toBe(4);
    expect(pad(7)).toBe("07");
    expect(normalizar("João Áureo")).toBe("joao aureo");
    expect(gerarPlaca()).toMatch(/^[A-Z]{3}(?:\d[A-Z]\d{2}|-\d{4})$/);
    expect(gerarAno()).toMatch(/^20\d{2}\/20\d{2}$/);
    expect(gerarChassi()).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(gerarSite("São Paulo Teste")).toMatch(/^https:\/\/www\.saopauloteste\d{1,2}\.com\.br$/);
  });

  it("gera chassis VIN válidos com dígito verificador ISO 3779", () => {
    const chassis = Array.from({ length: 30 }, gerarChassi);

    expect(chassis.every(validarChassi)).toBe(true);
    expect(chassis.every((value) => !/[IOQ]/.test(value))).toBe(true);
    expect(validarChassi(`${chassis[0].slice(0, 8)}0${chassis[0].slice(9)}`)).toBe(false);
    expect(validarChassi("1M8GDM9AXKP042788")).toBe(true);
    expect(validarChassi("1M8GDM9A0KP042788")).toBe(false);
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
    expect(generateMappedValue("chassi", context)).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(generateMappedValue("brand", context, "", {
      getVehicleCatalog: () => [{ marca: "Ford", modelos: ["Ka"] }]
    })).toBe("Ford");
    expect(generateMappedValue("model", context, "", {
      getVehicleCatalog: () => [{ marca: "Ford", modelos: ["Ka"] }]
    })).toBe("Ka");
  });
});
