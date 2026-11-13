import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM } from "./fixtures/dom-factory.js";
import { loadApp } from "./helpers/app-loader.js";
import { click, getLastSentMessage, getMappedFields } from "./helpers/interaction.js";

const vehicleFields = [
  {
    key: "#brand::0",
    selector: "#brand",
    label: "Marca",
    inferredType: "brand",
    tagName: "input",
    inputType: "text",
    selectorRule: "id",
    selectorStatus: "stable",
    selectorSuggestion: "",
    locatorName: "cadastro-marca-text",
  },
  {
    key: "#model::1",
    selector: "#model",
    label: "Modelo",
    inferredType: "model",
    tagName: "input",
    inputType: "text",
    selectorRule: "id",
    selectorStatus: "stable",
    selectorSuggestion: "",
    locatorName: "cadastro-modelo-text",
  },
];

const vehicleCatalog = [
  { marca: "Fiat", modelos: ["Argo"] },
  { marca: "Toyota", modelos: ["Corolla"] },
];

let dom;
let chromeMock;
let appUtils;

beforeEach(async () => {
  dom = createPopupDOM();
  chromeMock = createChromeMock({ scanFields: vehicleFields, vehicleCatalog });
  appUtils = await loadApp(chromeMock);
});

afterEach(() => {
  appUtils.cleanup();
  vi.restoreAllMocks();
});

function fixValue(row, value) {
  row.querySelector(".page-field-fixed-toggle").click();
  const input = row.querySelector(".page-field-fixed-value");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// Fixa o sorteio em um veículo incoerente com o campo fixado: sem a correção do
// achado A2 o valor enviado seria sempre o do `pickVehicle` aleatório, e o teste falharia.
function forceRandom(value) {
  return vi.spyOn(Math, "random").mockReturnValue(value);
}

describe("popup app - coerência de marca e modelo no preenchimento individual", () => {
  it("preenche o modelo com a marca fixada no formulário", () => {
    const [brandRow, modelRow] = document.querySelectorAll(".page-field");
    expect(getMappedFields().map((field) => field.type)).toEqual(["brand", "model"]);

    fixValue(brandRow, "Fiat");
    appUtils.clearSentMessages();
    // 0,99 faria o sorteio cair em Toyota/Corolla.
    forceRandom(0.99);

    modelRow.querySelector('[data-action="fill"]').click();

    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD))
      .toMatchObject({ selector: "#model", value: "Argo" });
  });

  it("preenche a marca com o modelo fixado no formulário", () => {
    const [brandRow, modelRow] = document.querySelectorAll(".page-field");

    fixValue(modelRow, "Corolla");
    appUtils.clearSentMessages();
    // 0 faria o sorteio cair em Fiat/Argo.
    forceRandom(0);

    brandRow.querySelector('[data-action="fill"]').click();

    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD))
      .toMatchObject({ selector: "#brand", value: "Toyota" });
  });

  it("mantém a coerência na solicitação do controle flutuante", () => {
    const [brandRow] = document.querySelectorAll(".page-field");

    fixValue(brandRow, "Fiat");
    appUtils.clearSentMessages();
    // 0,99 faria o sorteio cair em Toyota/Corolla.
    forceRandom(0.99);

    const listener = appUtils.getAppMessageListener();
    let response = null;
    listener(
      { action: ACTIONS.PAGE_FIELD_FILL_REQUEST, key: "#model::1", selector: "#model" },
      { tab: { id: 10, url: "https://sistema.example.test/cadastro" } },
      (value) => { response = value; }
    );

    expect(response).toEqual({ filled: true });
    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD))
      .toMatchObject({ selector: "#model", value: "Argo" });
  });

  it("mantém a coerência em campos mapeados como inferência automática", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: vehicleFields,
      vehicleCatalog,
      profiles: [{
        id: "profile-auto",
        name: "Cadastro com tipo automático",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [
          { ...vehicleFields[0], dataType: "auto", fixed: true, fixedValue: "Fiat" },
          { ...vehicleFields[1], dataType: "auto" },
        ],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    const rows = document.querySelectorAll(".page-field");
    appUtils.clearSentMessages();
    forceRandom(0.99);

    rows[1].querySelector('[data-action="fill"]').click();

    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD))
      .toMatchObject({ selector: "#model", value: "Argo" });
  });

  it("resolve o veículo do lote apenas com os campos fixados", () => {
    const [brandRow, modelRow] = document.querySelectorAll(".page-field");

    fixValue(brandRow, "Fiat");
    appUtils.clearSentMessages();
    // 0,99 faria o sorteio cair em Toyota/Corolla.
    forceRandom(0.99);

    click("#fill-all-button");

    const message = getLastSentMessage(chromeMock, ACTIONS.FILL_ALL);
    expect(message.fields).toEqual([
      expect.objectContaining({ selector: "#brand", value: "Fiat" }),
      expect.objectContaining({ selector: "#model", value: "Argo" }),
    ]);
    expect(getMappedFields().map((field) => field.fixed)).toEqual([true, false]);
    expect(modelRow.querySelector(".page-field-fixed-value").value).toBe("Argo");
  });

  it("não deixa o modelo preenchido anteriormente contaminar o lote", () => {
    const [brandRow] = document.querySelectorAll(".page-field");

    forceRandom(0.99);
    click("#fill-all-button");
    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_ALL).fields)
      .toEqual(expect.arrayContaining([expect.objectContaining({ selector: "#model", value: "Corolla" })]));

    fixValue(brandRow, "Fiat");
    appUtils.clearSentMessages();
    forceRandom(0.99);
    click("#fill-all-button");

    expect(getLastSentMessage(chromeMock, ACTIONS.FILL_ALL).fields)
      .toEqual(expect.arrayContaining([expect.objectContaining({ selector: "#model", value: "Argo" })]));
  });
});
