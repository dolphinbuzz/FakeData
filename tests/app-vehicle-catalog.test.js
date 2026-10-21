import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click } from "./helpers/interaction.js";

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

describe("popup app - catálogo de veículos", () => {
  it("adiciona, edita e remove itens do catálogo de veículos", async () => {
    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");

    document.querySelector("#vehicle-brand-input").value = "Toyota";
    document.querySelector("#vehicle-model-input").value = "Corolla";
    click("#vehicle-add-button");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"]).toEqual([{ marca: "Toyota", modelos: ["Corolla"] }]);
    expect(document.querySelector("#vehicle-catalog-status").textContent).toBe("Veículo cadastrado.");

    click("[data-edit-brand='Toyota']");
    await nextTick();
    expect(document.querySelector("#mapping-modal").hidden).toBe(false);
    expect(document.querySelector("#mapping-modal-title").textContent).toBe("Renomear marca");
    document.querySelector("#mapping-name-input").value = "Lexus";
    click("#mapping-modal-confirm");
    await nextTick();
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"][0].marca).toBe("Lexus");

    click("[data-edit-model][data-model='Corolla']");
    expect(document.querySelector("#mapping-modal").hidden).toBe(true);
    await nextTick();
    expect(document.querySelector("#vehicle-brand-input").value).toBe("Lexus");
    expect(document.querySelector("#vehicle-model-input").value).toBe("Corolla");
    click("#vehicle-add-button");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"][0].modelos).toEqual(["Corolla"]);

    click("[data-remove-brand='Lexus']");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"]).toEqual([]);
  });

  it("remove apenas o modelo selecionado", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      vehicleCatalog: [{ marca: "Toyota", modelos: ["Corolla", "Etios"] }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");

    click("[data-remove-model='Toyota'][data-model='Corolla']");
    await nextTick();

    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"]).toEqual([{ marca: "Toyota", modelos: ["Etios"] }]);
    expect(document.querySelector("#vehicle-catalog-list").textContent).not.toContain("Corolla");
  });

  it("cancelar renomeação de marca não exibe erro", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      vehicleCatalog: [{ marca: "Toyota", modelos: ["Corolla"] }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");

    click("[data-edit-brand='Toyota']");
    click("#mapping-modal-cancel");
    await nextTick();

    expect(document.querySelector("#vehicle-catalog-status").textContent).not.toContain("Informe uma marca.");
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"][0].marca).toBe("Toyota");
  });

  it("informa falha ao salvar o catálogo de veículos", async () => {
    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");
    document.querySelector("#vehicle-brand-input").value = "Toyota";
    document.querySelector("#vehicle-model-input").value = "Corolla";
    chromeMock.storage.local.set.mockImplementation((items, callback = () => {}) => {
      chromeMock.runtime.lastError = { message: "quota excedida" };
      callback();
      chromeMock.runtime.lastError = null;
    });

    click("#vehicle-add-button");

    expect(document.querySelector("#vehicle-catalog-status").textContent).toBe("Não foi possível salvar o catálogo.");
  });

  it("informa conflito ao renomear marca para um nome já cadastrado", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      vehicleCatalog: [
        { marca: "Toyota", modelos: ["Corolla"] },
        { marca: "Ford", modelos: ["Ka"] },
      ],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");
    click("[data-edit-brand='Toyota']");
    await nextTick();

    document.querySelector("#mapping-name-input").value = "Ford";
    click("#mapping-modal-confirm");
    await nextTick();
    await nextTick();

    expect(document.querySelector("#vehicle-catalog-status").textContent).toBe("Essa marca já está cadastrada.");
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"].map((entry) => entry.marca)).toEqual(["Toyota", "Ford"]);
  });

  it("valida modelo ausente ao cadastrar veículo", () => {
    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");
    document.querySelector("#vehicle-brand-input").value = "Toyota";

    click("#vehicle-add-button");

    expect(document.querySelector("#vehicle-catalog-status").textContent).toBe("Informe um modelo.");
  });

  it("valida nome vazio ao renomear marca e permite cancelar", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      vehicleCatalog: [{ marca: "Toyota", modelos: ["Corolla"] }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("[data-type='vehicle']");
    click("#open-vehicle-catalog-button");
    click("[data-edit-brand='Toyota']");
    await nextTick();

    document.querySelector("#mapping-name-input").value = "";
    click("#mapping-modal-confirm");
    expect(document.querySelector("#mapping-modal-error").textContent).toBe("Informe um nome para continuar.");

    click("#mapping-modal-cancel");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-vehicle-catalog"][0].marca).toBe("Toyota");
  });
});