import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

function findResultRow(label) {
  return [...document.querySelectorAll("#result-fields .result-field")]
    .find((row) => row.querySelector(".field-label").textContent === label);
}

describe("popup app - escape do resultado do gerador", () => {
  it("preserva aspas no modelo de veículo sem quebrar o DOM nem a cópia", async () => {
    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");

    document.querySelector("#vehicle-brand-input").value = "Teste";
    document.querySelector("#vehicle-model-input").value = 'Mod"elo';
    click("#vehicle-add-button");
    await nextTick();

    click("#generate-button");

    expect(getResultFieldValues()).toContain('Mod"elo');

    const modelRow = findResultRow("Modelo");
    expect(modelRow).toBeTruthy();
    expect(modelRow.querySelector(".field-value").getAttribute("title")).toBe('Mod"elo');

    const copyButton = modelRow.querySelector(".copy-field-button");
    expect(copyButton.getAttribute("aria-label")).toBe("Copiar Modelo");
    expect(copyButton.dataset.value).toBe('Mod"elo');

    copyButton.click();
    await nextTick();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Mod"elo');
  });
});
