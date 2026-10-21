import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, expectSentAction, getPageFieldsStatus } from "./helpers/interaction.js";

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

describe("popup app - ações da lista de campos", () => {
  it("remapeia todos os campos quando solicitado", async () => {
    appUtils.clearSentMessages();

    click("#remap-all-button");
    await nextTick();

    expect(expectSentAction(chromeMock, ACTIONS.SCAN_FIELDS)).toBe(true);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });

  it("confirma a edição do nome do campo com Enter", () => {
    click(".page-field-edit-label");
    const editor = document.querySelector(".page-field-label-editor");
    editor.value = "Nome confirmado";

    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(document.querySelector(".page-field-label").textContent).toBe("Nome confirmado");
  });

  it("reporta seletor não encontrado e alterna a marcação do campo", () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.MARK_FIELD) callback({ marked: false });
      else callback({});
    });

    click(".page-field [data-action='highlight']");
    expect(getPageFieldsStatus()).toBe("Seletor não encontrado na página. Ajuste o seletor e tente novamente.");

    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.MARK_FIELD) callback({ marked: true });
      else if (message.action === ACTIONS.UNMARK_FIELD) callback({ unmarked: true });
      else callback({});
    });

    click(".page-field [data-action='highlight']");
    expect(getPageFieldsStatus()).toBe("E-mail marcado.");

    click(".page-field [data-action='highlight']");
    expect(getPageFieldsStatus()).toBe("E-mail desmarcado.");
  });

  it("refaz o escaneamento ao adicionar seletor sem página acessível", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      openTabs: [{ id: 1, url: "chrome://settings/", active: true }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    chromeMock.tabs.query.mockClear();
    appUtils.clearSentMessages();

    click("#add-selector-button");
    await nextTick();

    expect(chromeMock.tabs.query).toHaveBeenCalled();
    expect(expectSentAction(chromeMock, ACTIONS.CAPTURE_NEXT_CLICK)).toBe(false);
    expect(getPageFieldsStatus()).toBe("A página ativa não permite acesso a formulários.");
  });

  it("adiciona um novo seletor capturado à lista de campos", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.SCAN_FIELDS) callback({ fields: scannedFields });
      else if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) {
        callback({ captured: true, field: { selector: "#novo", label: "Novo campo", inferredType: "phone" } });
      } else callback({});
    });

    click("#add-selector-button");
    await nextTick();

    expect(document.querySelectorAll(".page-field")).toHaveLength(3);
    expect([...document.querySelectorAll(".page-field-selector")].pop().value).toBe("#novo");
    expect(getPageFieldsStatus()).toBe("Seletor adicionado. Salve os seletores para mantê-lo no perfil.");
  });

  it("informa ausência de campos ao marcar todos", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: [] });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("#mark-all-button");

    expect(getPageFieldsStatus()).toBe("Nenhum campo encontrado para marcar.");
  });

  it("informa quando nenhum campo possui seletor utilizável", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: [{ ...scannedFields[0], selector: "" }] });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("#mark-all-button");

    expect(getPageFieldsStatus()).toBe("Nenhum campo possui seletor utilizável para marcar.");
  });

  it("reporta falha de comunicação ao marcar todos os campos", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = { message: "Receiver unavailable" };
      callback();
      chromeMock.runtime.lastError = null;
    });
    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = { message: "Cannot access contents" };
      callback();
      chromeMock.runtime.lastError = null;
    });

    click("#mark-all-button");
    await nextTick();

    expect(getPageFieldsStatus()).toBe("Não foi possível atualizar as marcações.");
  });

  it("limpa os valores preenchidos de todos os campos", () => {
    click("#fill-all-button");
    const filledValues = [...document.querySelectorAll(".page-field-fixed-value")].map((input) => input.value);
    expect(filledValues.every((value) => value.length > 0)).toBe(true);

    click("#clear-all-button");

    expect(getPageFieldsStatus()).toBe("2 campo(s) limpado(s).");
    expect([...document.querySelectorAll(".page-field-fixed-value")].map((input) => input.value)).toEqual(["", ""]);
  });

  it("informa quando não há preenchimentos para limpar", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: [] });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("#clear-all-button");

    expect(getPageFieldsStatus()).toBe("Nenhum preenchimento para limpar.");
  });
});
