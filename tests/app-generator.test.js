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
  it("altera tema, abas e copia um resultado gerado", async () => {
    expect(document.documentElement.dataset.theme).toBe("dark");
    click("#theme-toggle");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("fakedata-theme")).toBe("light");

    click("#mapping-tab");
    expect(document.querySelector("#mapping-panel").hidden).toBe(false);
    click("#generator-tab");
    expect(document.querySelector("#generator-panel").hidden).toBe(false);

    click(".copy-field-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(document.querySelector(".copy-field-button").textContent).toBe("✓");
  });

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
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("clipboard indisponível"));
    click(".copy-field-button");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
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