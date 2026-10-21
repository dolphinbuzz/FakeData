import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp, nextTick } from "./helpers/app-loader.js";
import { click, expectSentAction, getLastSentMessage, getPageFieldsStatus } from "./helpers/interaction.js";

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

describe("popup app - ciclo de vida e injeção", () => {
  it("atualiza o scan em mudança de DOM e limpa em mudança de rota", async () => {
    const listener = appUtils.getAppMessageListener();
    expect(listener).toEqual(expect.any(Function));

    listener({ action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "dom", url: "https://sistema.example.test/cadastro?etapa=1#dados" }, { tab: { id: 10, url: "https://sistema.example.test/cadastro?etapa=1#dados" } });
    await nextTick();

    listener({ action: ACTIONS.PAGE_CONTENT_CHANGED, changeType: "route", url: "https://sistema.example.test/outro" }, { tab: { id: 10, url: "https://sistema.example.test/cadastro?etapa=1#dados" } });
    await nextTick();

    const scans = appUtils.getSentMessages().filter((m) => m.message.action === ACTIONS.SCAN_FIELDS);
    expect(scans.length).toBeGreaterThanOrEqual(3);
  });

  it("informa quando não há uma página web acessível", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: scannedFields, openTabs: [{ id: 1, url: "chrome://settings/", active: true }] });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    expect(getPageFieldsStatus()).toBe("A página ativa não permite acesso a formulários.");
  });

  it("trata falhas de comunicação e de injeção durante o escaneamento", async () => {
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

    click("#scan-fields-button");
    await nextTick();

    expect(getPageFieldsStatus()).toContain("Não foi possível ler esta página");
  });

  it("serializa a injeção por aba e atende chamadas concorrentes com um único executeScript", async () => {
    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();
    chromeMock.storage.local.get.mockClear();

    let failing = true;
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      appUtils.getSentMessages().push({ tabId, message: message });
      if (failing) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({ fields: scannedFields });
    });

    let injectionCallback = null;
    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = null;
      injectionCallback = callback;
    });

    click("#scan-fields-button");
    click("#scan-fields-button");

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.local.get).not.toHaveBeenCalled();

    failing = false;
    injectionCallback();
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });

  it("fluxo de sucesso: injeta, reenvia a mensagem e renderiza os campos", async () => {
    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();

    let attempts = 0;
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      attempts += 1;
      appUtils.getSentMessages().push({ tabId, message: message });
      if (attempts === 1) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({ fields: scannedFields });
    });

    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = null;
      callback();
    });

    click("#scan-fields-button");
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith(
      { target: { tabId: 10 }, files: ["src/scripts/content.js"] },
      expect.any(Function)
    );
    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });

  it("mantém filas separadas por aba: uma injeção por aba e resposta nas duas", async () => {
    appUtils.cleanup();
    const tabs = [
      { id: 10, url: "https://sistema.example.test/cadastro", active: true },
      { id: 11, url: "https://outro.example.test/login", active: false },
    ];
    chromeMock = createChromeMock({ scanFields: scannedFields, openTabs: tabs });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();
    chromeMock.storage.local.get.mockClear();

    let contentInstalled = false;
    const injectionCallbacks = new Map();
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      appUtils.getSentMessages().push({ tabId, message: message });
      if (!contentInstalled) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({ fields: scannedFields });
    });

    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = null;
      injectionCallbacks.set(details.target.tabId, callback);
    });

    click("#scan-fields-button");
    const baseUrlSelect = document.querySelector("#base-url-select");
    baseUrlSelect.value = "https://outro.example.test";
    baseUrlSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(Array.from(injectionCallbacks.keys())).toEqual([10, 11]);
    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(2);

    contentInstalled = true;
    injectionCallbacks.get(10)();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(injectionCallbacks.has(11)).toBe(true);

    injectionCallbacks.get(11)();
    await nextTick();

    expect(chromeMock.storage.local.get).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
  });

  it("limpa a fila após erro de injeção e volta a injetar na chamada seguinte", async () => {
    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();

    let contentInstalled = false;
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      appUtils.getSentMessages().push({ tabId, message: message });
      if (!contentInstalled && message && message.action === ACTIONS.SCAN_FIELDS) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({ fields: scannedFields });
    });

    let injectionAttempts = 0;
    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = null;
      injectionAttempts += 1;
      if (injectionAttempts === 1) {
        chromeMock.runtime.lastError = { message: "Cannot access contents of the page" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      contentInstalled = true;
      callback();
    });

    click("#scan-fields-button");
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(getPageFieldsStatus()).toContain("Não foi possível ler esta página");

    click("#scan-fields-button");
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });

  it("trata throw síncrono do executeScript sem deixar a fila órfã", async () => {
    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();

    let contentInstalled = false;
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      appUtils.getSentMessages().push({ tabId, message: message });
      if (!contentInstalled && message && message.action === ACTIONS.SCAN_FIELDS) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({ fields: scannedFields });
    });

    let throwOnInjection = true;
    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      chromeMock.runtime.lastError = null;
      if (throwOnInjection) throw new Error("Extension context invalidated");
      contentInstalled = true;
      callback();
    });

    click("#scan-fields-button");
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(getPageFieldsStatus()).toContain("Não foi possível ler esta página");

    throwOnInjection = false;
    click("#scan-fields-button");
    await nextTick();

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });
});

describe("popup app - estados de erro", () => {
  it("mostra estados de erro para marcação, localização e preenchimento", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      appUtils.getSentMessages().push({ tabId, message: message });
      callback(null);
    });

    click(".page-field [data-action='highlight']");
    expect(getPageFieldsStatus()).toContain("Não foi possível marcar");

    click(".page-field [data-action='locate']");
    expect(getPageFieldsStatus()).toContain("Não foi possível localizar");

    click(".page-field [data-action='fill']");
    expect(getPageFieldsStatus()).toContain("Não foi possível preencher");
  });

  it("não duplica seletor capturado e reporta captura inválida", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      appUtils.getSentMessages().push({ tabId, message: message });
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: true, field: { selector: "#email" } });
      else callback({});
    });

    click("#add-selector-button");
    await nextTick();
    expect(getPageFieldsStatus()).toBe("Esse seletor já está mapeado.");

    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: false });
      else callback({});
    });

    click("#add-selector-button");
    await nextTick();
    expect(getPageFieldsStatus()).toBe("Não foi possível adicionar o seletor.");
  });

  it("valida ações sem campos ou sem perfil selecionado", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({ scanFields: [] });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    click("#rename-mapping-button");
    click("#delete-mapping-button");
    click("#save-mappings-button");
    click("#fill-all-button");
    expect(getPageFieldsStatus()).toBe("Nenhum campo mapeado.");
  });

  it("informa falhas parciais ao marcar todos os campos", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.MARK_ALL_FIELDS) {
        callback({ marked: 1, total: 2, selectors: ["#email"], failed: ["#cpf"] });
      } else {
        callback({});
      }
    });

    click("#mark-all-button");
    expect(getPageFieldsStatus()).toBe("1 de 2 campo(s) marcado(s); 1 não foi(ram) localizado(s).");
  });

  it("informa erro quando o preenchimento em lote falha", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => callback(null));
    click("#fill-all-button");
    expect(getPageFieldsStatus()).toBe("Não foi possível preencher os campos desta página.");
  });

  it("preserva o nome original ao cancelar edição do campo", async () => {
    click(".page-field-edit-label");
    const editor = document.querySelector(".page-field-label-editor");
    editor.value = "Nome temporário";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".page-field-label").textContent).toBe("E-mail");
  });

  it("informa erro quando a captura de um campo mapeado falha", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.CAPTURE_NEXT_CLICK) callback({ captured: false });
      else callback({});
    });

    click(".page-field [data-action='target']");
    await nextTick();
    expect(getPageFieldsStatus()).toBe("Não foi possível capturar um campo.");
  });
});

describe("popup app - persistência e atualização de perfil", () => {
  it("atualiza o perfil selecionado sem criar um novo registro", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      profiles: [{
        id: "profile-1",
        name: "Perfil existente",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email" }],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    const selector = document.querySelector(".page-field-selector");
    selector.value = "#email-atualizado";
    selector.dispatchEvent(new Event("input", { bubbles: true }));
    click("#save-mappings-button");
    await nextTick();

    const profiles = appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages;
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: "profile-1", name: "Perfil existente" });
    expect(profiles[0].fields.find((f) => f.key === "#email::0")).toMatchObject({ selector: "#email-atualizado" });
  });

  it("persiste alterações de tipo e valor fixo do campo", async () => {
    const type = document.querySelector(".page-field-type");
    type.value = "phone";
    type.dispatchEvent(new Event("change", { bubbles: true }));
    const fixed = document.querySelector(".page-field-fixed-toggle");
    fixed.click();
    const value = document.querySelector(".page-field-fixed-value");
    value.value = "11999999999";
    value.dispatchEvent(new Event("input", { bubbles: true }));
    click("#save-mappings-button");
    document.querySelector("#mapping-name-input").value = "Tipos e valores";
    click("#mapping-modal-confirm");
    await nextTick();

    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].fields[0])
      .toMatchObject({ dataType: "phone", fixed: true, fixedValue: "11999999999" });
  });

  it("migra perfis legados para a estrutura por origem", async () => {
    appUtils.cleanup();
    const storageData = { "fakedata-field-mappings": { "https://sistema.example.test/cadastro": [{ ...scannedFields[0] }] } };
    chromeMock = createChromeMock({ scanFields: scannedFields });
    chromeMock.__testUtils.setStorageData(storageData);
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    const migrated = appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"];
    expect(migrated.pages[0]).toMatchObject({
      id: "https://sistema.example.test/cadastro::legacy",
      name: "Mapeamento salvo",
    });
    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test/cadastro"]).toBeUndefined();
  });

  it("renomeia e exclui um perfil salvo", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      profiles: [{
        id: "profile-1",
        name: "Antigo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email" }],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    vi.spyOn(window, "prompt").mockReturnValue("Novo nome");
    click("#rename-mapping-button");
    expect(document.querySelector("#mapping-modal").hidden).toBe(false);
    document.querySelector("#mapping-name-input").value = "Novo nome";
    click("#mapping-modal-confirm");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages[0].name).toBe("Novo nome");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    click("#delete-mapping-button");
    await nextTick();
    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"].pages).toEqual([]);
    expect(getPageFieldsStatus()).toBe("Mapeamento excluído.");
  });

  it("valida nome do mapeamento e permite cancelar o modal", async () => {
    click("#save-mappings-button");
    click("#mapping-modal-confirm");
    expect(document.querySelector("#mapping-modal-error").textContent).toBe("Informe um nome para continuar.");
    expect(document.querySelector("#mapping-modal").hidden).toBe(false);
    click("#mapping-modal-cancel");
    expect(document.querySelector("#mapping-modal").hidden).toBe(true);
    expect(appUtils.getStorageData()["fakedata-field-mappings"]["https://sistema.example.test"]).toBeUndefined();
  });

  it("valida confirmação do modal sem manipulador pendente", () => {
    click("#mapping-modal-confirm");

    expect(document.querySelector("#mapping-modal-error").textContent).toBe("Informe um nome para continuar.");
  });
});

describe("popup app - visibilidade de controles flutuantes", () => {
  it("persiste a preferência e sincroniza a visibilidade dos botões flutuantes", async () => {
    const toggle = document.querySelector("#floating-controls-toggle");
    expect(toggle.checked).toBe(true);

    appUtils.clearSentMessages();
    toggle.click();
    await nextTick();

    expect(toggle.checked).toBe(false);
    expect(appUtils.getStorageData()["fakedata-floating-controls"]).toBe(false);
    const updateMessage = getLastSentMessage(chromeMock, ACTIONS.UPDATE_PAGE_FIELD_CONTROLS);
    expect(updateMessage.visible).toBe(false);
  });
});

describe("popup app - tolerância a APIs ausentes", () => {
  it("atualiza bases e reescaneia ao ativar aba, tolerando ausência de tabs.query", async () => {
    const listener = chromeMock.tabs.onActivated.addListener.mock.calls[0][0];
    delete chromeMock.tabs.query;

    listener();
    await nextTick();

    expect(getPageFieldsStatus()).toBe("A página ativa não permite acesso a formulários.");
    expect(document.querySelectorAll(".page-field")).toHaveLength(0);
  });

  it("reporta ausência de tabs.sendMessage no escaneamento", async () => {
    delete chromeMock.tabs.sendMessage;

    click("#scan-fields-button");
    await nextTick();

    expect(getPageFieldsStatus()).toBe("Não foi possível ler esta página. Recarregue-a e tente novamente.");
  });

  it("reporta erro de conexão quando não é possível injetar o content script", async () => {
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = { message: "Receiver unavailable" };
      callback();
      chromeMock.runtime.lastError = null;
    });
    delete chromeMock.scripting.executeScript;

    click("#scan-fields-button");
    await nextTick();

    expect(getPageFieldsStatus()).toBe("Não foi possível ler esta página. Recarregue-a e tente novamente.");
  });

  it("não interrompe a fila quando um waiter falha após a injeção", async () => {
    chromeMock.tabs.sendMessage.mockClear();
    chromeMock.scripting.executeScript.mockClear();

    let sendCalls = 0;
    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      chromeMock.runtime.lastError = null;
      sendCalls += 1;
      if (sendCalls <= 2) {
        chromeMock.runtime.lastError = { message: "Could not establish connection" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      if (sendCalls === 3) throw new Error("sendMessage indisponível");
      callback({ fields: scannedFields });
    });
    let injectionCallback = null;
    chromeMock.scripting.executeScript.mockImplementation((details, callback) => {
      injectionCallback = callback;
    });

    click("#scan-fields-button");
    click("#scan-fields-button");
    expect(injectionCallback).toEqual(expect.any(Function));

    injectionCallback();
    await nextTick();

    expect(document.querySelectorAll(".page-field")).toHaveLength(2);
    expect(getPageFieldsStatus()).toBe("2 campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.");
  });
});