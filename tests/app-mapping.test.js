import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, pressShortcut, expectSentAction, getLastSentMessage, getPageFieldsStatus, getMappedFields, getResultFieldValues } from "./helpers/interaction.js";

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

describe("popup app - mapeamento de campos", () => {
  it("escaneia campos da aba ativa e renderiza os mapeamentos encontrados", async () => {
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      10, // tabId da aba ativa
      { action: ACTIONS.SCAN_FIELDS },
      expect.any(Function)
    );
    expect(getPageFieldsStatus()).toBe(
      "2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário."
    );
    expect(getMappedFields().map((f) => f.label)).toEqual(["E-mail", "CPF"]);
    expect(getMappedFields().map((f) => f.selector)).toEqual(["#email", "#cpf"]);
    expect(getMappedFields().map((f) => f.type)).toEqual(["email", "cpf"]);
  });

  it("carrega o catálogo salvo e gera marca e modelo vinculados", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      vehicleCatalog: [{ marca: "Ford", modelos: ["Ka", "Ranger"] }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("[data-type='vehicle']");

    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ford");
    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ka");
    expect(document.querySelector("#vehicle-catalog-list").textContent).toContain("Ranger");
    const values = getResultFieldValues();
    expect(values).toContain("Ford");
    expect(["Ka", "Ranger"]).toContain(values[1]);
  });

  it("respeita a UF selecionada", async () => {
    const ufSelect = document.querySelector("#uf-select");
    ufSelect.value = "SP";
    ufSelect.dispatchEvent(new Event("change"));

    for (let i = 0; i < 3; i++) {
      click("#generate-button");
      const estadoField = [...document.querySelectorAll("#result-fields .result-field")]
        .find((row) => row.querySelector(".field-label").textContent === "Estado");
      expect(estadoField.querySelector(".field-value").textContent).toBe("SP - São Paulo");
    }
  });

  it("exibe o cadastro de veículos em modal somente no tipo Veículo", async () => {
    const trigger = document.querySelector("#open-vehicle-catalog-button");
    expect(trigger.hidden).toBe(true);

    click("[data-type='vehicle']");
    expect(trigger.hidden).toBe(false);

    click("#open-vehicle-catalog-button");
    expect(document.querySelector("#vehicle-catalog-modal").hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector("#vehicle-catalog-modal").hidden).toBe(true);

    click("[data-type='person']");
    expect(trigger.hidden).toBe(true);
  });
});

describe("popup app - preenchimento", () => {
  it("envia todos os campos mapeados para preenchimento", async () => {
    appUtils.clearSentMessages();
    click("#fill-all-button");

    const fillAllMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_ALL);
    expect(fillAllMessage).toBeTruthy();
    expect(fillAllMessage.fields).toHaveLength(2);
    expect(fillAllMessage.fields.map((f) => f.selector)).toEqual(["#email", "#cpf"]);
    expect(fillAllMessage.fields.every((f) => typeof f.value === "string" && f.value.length > 0)).toBe(true);
    expect(getPageFieldsStatus()).toBe("2 de 2 campo(s) preenchido(s).");
  });

  it("preenche um campo individual pelo ícone de colar", async () => {
    appUtils.clearSentMessages();
    click(".page-field [data-action='fill']");

    const fillMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD);
    expect(fillMessage).toBeTruthy();
    expect(fillMessage.selector).toBe("#email");
    expect(fillMessage.value).toEqual(expect.any(String));
    expect(document.querySelector(".page-field-fixed-value").value).toBe(fillMessage.value);
  });
});

describe("popup app - salvamento de mapeamentos", () => {
  it("salva um novo mapeamento no storage por origem e URL normalizada", async () => {
    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Cadastro principal";
    click("#mapping-modal-confirm");
    await nextTick();

    const stored = appUtils.getStorageData()["fakedata-field-mappings"];
    const application = stored["https://sistema.example.test"];
    expect(application.pages).toHaveLength(1);
    expect(application.pages[0]).toMatchObject({
      name: "Cadastro principal",
      pageUrl: "https://sistema.example.test/cadastro",
      fields: [
        expect.objectContaining({
          key: "#email::0",
          selector: "#email",
          dataType: "email",
          fixed: false,
          fixedValue: "",
          locatorName: "cadastro-e-mail-email",
        }),
        expect.objectContaining({
          key: "#cpf::1",
          selector: "#cpf",
          dataType: "cpf",
          fixed: false,
          fixedValue: "",
          locatorName: "cadastro-cpf-text",
        }),
      ],
    });
    expect(application.pages[0].audit).toEqual([
      expect.objectContaining({ elemento: "E-mail", seletorGerado: "#email", status: "estável" }),
      expect.objectContaining({ elemento: "CPF", seletorGerado: "#cpf", status: "estável" }),
    ]);
    expect(getPageFieldsStatus()).toBe('Mapeamento "Cadastro principal" salvo.');
  });

  it("carrega automaticamente o único perfil da URL e preserva valor fixo", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      profiles: [{
        id: "profile-1",
        name: "Cadastro salvo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email", fixed: true, fixedValue: "fixo@example.test" }],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    expect(document.querySelector("#saved-mappings-select").value).toBe("profile-1");
    expect(document.querySelector(".page-field-fixed-toggle").checked).toBe(true);
    expect(document.querySelector(".page-field-fixed-value").value).toBe("fixo@example.test");
  });

  it("preserva o nome editado ao salvar e selecionar novamente o perfil", async () => {
    click(".page-field-edit-label");
    const editor = document.querySelector(".page-field-label-editor");
    editor.value = "Nome principal";
    editor.dispatchEvent(new Event("blur", { bubbles: true }));

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Cadastro com nome editado";
    click("#mapping-modal-confirm");
    await nextTick();

    const storedProfile = appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages[0];
    expect(storedProfile.fields[0].label).toBe("Nome principal");

    const profileSelect = document.querySelector("#saved-mappings-select");
    profileSelect.value = "";
    profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    // Quando nenhum perfil selecionado, mostra os campos escaneados (2)
    expect(document.querySelectorAll(".page-field").length).toBe(2);

    profileSelect.value = storedProfile.id;
    profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector(".page-field-label").textContent).toBe("Nome principal");
  });

  it("envia valor fixo no preenchimento individual", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      profiles: [{
        id: "profile-1",
        name: "Cadastro salvo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email", fixed: true, fixedValue: "fixo@example.test" }],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    appUtils.clearSentMessages();
    click(".page-field [data-action='fill']");

    const fillMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD);
    expect(fillMessage).toMatchObject({
      selector: "#email",
      value: "fixo@example.test",
    });
  });

  it("exibe e salva os valores do preenchimento em lote", async () => {
    appUtils.clearSentMessages();
    click("#fill-all-button");

    const fillAllMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_ALL);
    const fixedValues = [...document.querySelectorAll(".page-field-fixed-value")].map((input) => input.value);
    expect(fixedValues).toEqual(fillAllMessage.fields.map((f) => f.value));

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Com valores";
    click("#mapping-modal-confirm");
    await nextTick();

    const savedFields = appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields;
    fillAllMessage.fields.forEach((sentField) => {
      expect(savedFields).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: sentField.selector, fixedValue: sentField.value, fixed: false }),
      ]));
    });
  });

  it("fixa o valor atual do campo e salva a configuração", async () => {
    click(".page-field [data-action='fill']");
    const valueInput = document.querySelector(".page-field-fixed-value");
    const generatedValue = valueInput.value;
    expect(valueInput.disabled).toBe(true);

    click(".page-field-fixed-toggle");
    expect(valueInput.disabled).toBe(false);
    expect(valueInput.value).toBe(generatedValue);

    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Valor fixo";
    click("#mapping-modal-confirm");
    await nextTick();

    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields[0])
      .toMatchObject({ fixed: true, fixedValue: generatedValue });
  });
});

describe("popup app - localização e marcação", () => {
  it("localiza o campo pelo seletor e atualiza o status", async () => {
    appUtils.clearSentMessages();
    click(".page-field [data-action='locate']");

    expect(expectSentAction(chromeMock, ACTIONS.HIGHLIGHT_FIELD)).toBe(true);
    const highlightMsg = getLastSentMessage(chromeMock, ACTIONS.HIGHLIGHT_FIELD);
    expect(highlightMsg.selector).toBe("#email");
    expect(getPageFieldsStatus()).toBe("E-mail localizado na página.");
  });
});

describe("popup app - atalhos de teclado", () => {
  it("executa as ações de mapeamento pelos atalhos de teclado", async () => {
    appUtils.clearSentMessages();
    pressShortcut("s");
    pressShortcut("p");
    pressShortcut("l");
    pressShortcut("m");
    pressShortcut("f");
    await nextTick();

    expect(expectSentAction(chromeMock, ACTIONS.SCAN_FIELDS)).toBe(true);
    expect(expectSentAction(chromeMock, ACTIONS.FILL_ALL)).toBe(true);
    expect(expectSentAction(chromeMock, ACTIONS.MARK_ALL_FIELDS)).toBe(true);
    expect(expectSentAction(chromeMock, ACTIONS.UPDATE_PAGE_FIELD_CONTROLS)).toBe(true);
    const floatingMsg = getLastSentMessage(chromeMock, ACTIONS.UPDATE_PAGE_FIELD_CONTROLS);
    expect(floatingMsg.visible).toBe(false);
    expect(appUtils.getStorageData()["fakedata-floating-controls"]).toBe(false);
    expect(document.querySelector("#mapping-name-input").hidden).toBe(false);
  });

  it("exibe a descrição e os tooltips dos atalhos", async () => {
    expect(document.querySelector(".shortcut-help").textContent).toContain("Alt+Shift+S");
    expect(document.querySelector("#scan-fields-button").title).toContain("Alt+Shift+S");
    expect(document.querySelector("#fill-all-button").title).toContain("Alt+Shift+P");
    expect(document.querySelector("#floating-controls-toggle").getAttribute("aria-label")).toContain("Alt+Shift+F");
    expect(document.querySelector("#save-mappings-button").title).toContain("Alt+Shift+L");
    expect(document.querySelector("#mark-all-button").title).toContain("Alt+Shift+M");
  });

  it("não executa atalhos enquanto o foco está em campo editável", async () => {
    appUtils.clearSentMessages();
    const input = document.querySelector("#mapping-name-input");
    input.focus();

    pressShortcut("s", input);
    pressShortcut("p", input);
    await nextTick();

    expect(chromeMock.__testUtils.getSentMessages()).toHaveLength(0);
  });
});