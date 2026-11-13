import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, getResultFieldValues } from "./helpers/interaction.js";

let dom;
let chromeMock;
let appUtils;

beforeEach(async () => {
  dom = createPopupDOM();
  chromeMock = createChromeMock({ scanFields: scannedFields });
  appUtils = await loadApp(chromeMock);
});

afterEach(() => {
  appUtils.cleanup();
});

describe("popup app - gerador de dados", () => {
  it("gera dados de pessoa", async () => {
    click("#generator-tab");
    click("[data-type='person']");
    expect(document.querySelector("#result-title").textContent).toBe("Pessoa gerada");
    const values = getResultFieldValues();
    expect(values.length).toBeGreaterThan(0);
    // Verifica campos esperados
    const labels = [...document.querySelectorAll("#result-fields .field-label")].map((el) => el.textContent);
    expect(labels).toContain("Nome");
    expect(labels).toContain("CPF");
    expect(labels).toContain("E-mail");
  });

  it("gera um lote e copia todos os registros como JSON", async () => {
    click("#generator-tab");
    document.querySelector("#batch-size").value = "3";
    click("#generate-button");

    expect(document.querySelector("#batch-status").textContent).toBe("3 registros gerados.");
    expect(document.querySelector("#result-title").textContent).toBe("Pessoa: 3 registros");
    click("#copy-json-button");
    await nextTick();

    const copied = JSON.parse(navigator.clipboard.writeText.mock.calls.at(-1)[0]);
    expect(copied).toHaveLength(3);
    expect(copied[0]).toHaveProperty("CPF");
  });

  it("impede exportar quando a quantidade do lote é inválida", () => {
    click("#generator-tab");
    document.querySelector("#batch-size").value = "101";
    click("#generate-button");

    expect(document.querySelector("#batch-status").textContent).toContain("entre 1 e 100");
    expect(document.querySelector("#export-json-button").disabled).toBe(true);
    expect(document.querySelector("#export-csv-button").disabled).toBe(true);
    expect(document.querySelector("#copy-json-button").disabled).toBe(true);
  });

  it("exporta o lote atual como arquivos JSON e CSV", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => "blob:fakedata-test");
    const revokeObjectURL = vi.fn();
    const downloads = [];
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const createElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = createElement(tagName, options);
      if (tagName === "a") {
        vi.spyOn(element, "click").mockImplementation(() => downloads.push(element.download));
      }
      return element;
    });

    try {
      click("#generator-tab");
      document.querySelector("#batch-size").value = "2";
      click("#generate-button");
      click("#export-json-button");
      click("#export-csv-button");

      expect(createObjectURL).toHaveBeenCalledTimes(2);
      expect(createObjectURL.mock.calls[0][0].type).toContain("application/json");
      expect(createObjectURL.mock.calls[1][0].type).toContain("text/csv");
      expect(downloads).toEqual(["fakedata-person-2.json", "fakedata-person-2.csv"]);
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete URL.createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        delete URL.revokeObjectURL;
      }
    }
  });

  it("gera dados de empresa", async () => {
    click("#generator-tab");
    click("[data-type='company']");
    expect(document.querySelector("#result-title").textContent).toBe("Empresa gerada");
    const values = getResultFieldValues();
    expect(values.length).toBeGreaterThan(0);
    const labels = [...document.querySelectorAll("#result-fields .field-label")].map((el) => el.textContent);
    expect(labels).toContain("Razão social");
    expect(labels).toContain("CNPJ");
  });

  it("gera dados de veículo", async () => {
    click("#generator-tab");
    click("[data-type='vehicle']");
    expect(document.querySelector("#result-title").textContent).toBe("Veículo gerado");
    const values = getResultFieldValues();
    expect(values.length).toBeGreaterThan(0);
    const labels = [...document.querySelectorAll("#result-fields .field-label")].map((el) => el.textContent);
    expect(labels).toContain("Marca");
    expect(labels).toContain("Modelo");
    expect(labels).toContain("Placa");
    expect(labels).toContain("Chassi");
    expect(labels).toContain("Renavam");
  });

  it("trata falha ao copiar", async () => {
    click("#generator-tab");
    click("[data-type='company']");
    const copyButton = document.querySelector(".copy-field-button");
    const originalText = copyButton.textContent;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("clipboard indisponível"));
    copyButton.click();
    await nextTick();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "Não foi possível copiar o dado.",
      expect.objectContaining({ message: "clipboard indisponível" })
    );
    expect(copyButton.textContent).toBe(originalText);
    expect(copyButton.classList.contains("copied")).toBe(false);
  });

  it("reporta falha ao criar o arquivo de exportação", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const createObjectURL = vi.fn(() => {
      throw new Error("blob indisponível");
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      click("#generator-tab");
      document.querySelector("#batch-size").value = "2";
      click("#generate-button");
      click("#export-json-button");

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(document.querySelector("#batch-status").textContent).toBe("Não foi possível exportar os registros.");
      expect(errorSpy).toHaveBeenCalledWith(
        "Não foi possível exportar os registros.",
        expect.objectContaining({ message: "blob indisponível" })
      );
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        delete URL.createObjectURL;
      }
    }
  });

  it("conclui a captura de campo e restaura o botão após copiar", async () => {
    vi.useFakeTimers();
    const copyButton = document.querySelector(".copy-field-button");
    const originalText = copyButton.textContent;
    copyButton.click();
    await Promise.resolve();
    expect(copyButton.textContent).toBe("✓");
    vi.advanceTimersByTime(1200);
    expect(copyButton.textContent).toBe(originalText);
    vi.useRealTimers();
  });
});