import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";

let dom;
let messageListener;

function setupPage() {
  dom = new JSDOM(`<!doctype html><body>
    <form>
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="email">
      <label for="cpf">CPF</label>
      <input id="cpf" name="cpf">
      <label for="uf">Estado</label>
      <select id="uf"><option value="">Selecione</option><option value="CE">CE</option><option value="SP">SP</option></select>
    </form>
  </body>`, {
    url: "https://sistema.example.test/cadastro",
    pretendToBeVisual: true
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.history = dom.window.history;
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  dom.window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

function setupChromeMock() {
  messageListener = null;
  globalThis.chrome = {
    runtime: {
      id: "test-extension-id",
      getURL: vi.fn((filePath) => pathToFileURL(resolve(filePath)).href),
      sendMessage: vi.fn((message, callback) => {
        if (typeof callback === "function") callback({ filled: false });
      }),
      onMessage: {
        addListener: vi.fn((listener) => {
          messageListener = listener;
        }),
        removeListener: vi.fn((listener) => {
          if (messageListener === listener) messageListener = null;
        })
      }
    }
  };
}

async function loadContentScript() {
  vi.resetModules();
  await import("../src/scripts/content.js");
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));
}

function sendContentMessage(message) {
  return new Promise((resolveMessage) => {
    messageListener(message, {}, resolveMessage);
  });
}

beforeEach(async () => {
  setupPage();
  setupChromeMock();
  await loadContentScript();
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.window.close();
  delete globalThis.chrome;
});

describe("content script", () => {
  it("responde ao escaneamento com campos editáveis da página", async () => {
    const response = await sendContentMessage({ action: ACTIONS.SCAN_FIELDS });

    expect(response.fields.map((field) => field.selector)).toEqual(["#email", "#cpf", "#uf"]);
    expect(response.fields.map((field) => field.inferredType)).toEqual(["email", "cpf", "state"]);
  });

  it("preenche todos os campos mapeados e dispara eventos de formulário", async () => {
    const email = document.querySelector("#email");
    const cpf = document.querySelector("#cpf");
    const uf = document.querySelector("#uf");
    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    [email, cpf, uf].forEach((element) => {
      element.addEventListener("input", inputEvents);
      element.addEventListener("change", changeEvents);
    });

    const response = await sendContentMessage({
      action: ACTIONS.FILL_ALL,
      fields: [
        { selector: "#email", value: "qa@example.test" },
        { selector: "#cpf", value: "123.456.789-09" },
        { selector: "#uf", value: "CE" }
      ]
    });

    expect(response).toEqual({ filled: 3, total: 3, failed: [] });
    expect(email.value).toBe("qa@example.test");
    expect(cpf.value).toBe("123.456.789-09");
    expect(uf.value).toBe("CE");
    expect(inputEvents).toHaveBeenCalledTimes(3);
    expect(changeEvents).toHaveBeenCalledTimes(3);
  });

  it("exibe um botão de preenchimento junto aos campos sincronizados", async () => {
    const response = await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });

    expect(response).toEqual({ updated: true, count: 1 });
    const button = document.querySelector(".fakedata-page-fill");
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Preencher E-mail");
  });

  it("preenche checkbox e radio conforme o valor booleano", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <input id="check" type="checkbox">
      <input id="radio" type="radio">
    `);
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#check", value: true })).filled).toBe(true);
    expect(document.querySelector("#check").checked).toBe(true);
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#radio", value: false })).filled).toBe(true);
    expect(document.querySelector("#radio").checked).toBe(false);
  });

  it("retorna falha para seletor inválido ou elemento inexistente", async () => {
    expect(await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#missing", value: "x" })).toEqual({ filled: false });
    expect(await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "[", value: "x" })).toEqual({ filled: false });
    expect(await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#missing" })).toEqual({ marked: false });
    expect(await sendContentMessage({ action: ACTIONS.COUNT_SELECTOR_MATCHES, selector: "[" })).toEqual({ invalid: true, count: 0 });
  });

  it("marca, desmarca e destaca um campo", async () => {
    expect(await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#email" })).toEqual({ marked: true });
    expect(document.querySelector("#email").style.outline).toContain("#ef4444");
    expect(await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#email" })).toEqual({ unmarked: true });
    expect(await sendContentMessage({ action: ACTIONS.HIGHLIGHT_FIELD, selector: "#email" })).toEqual({ highlighted: true });
    expect(document.querySelector("#email").scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("remove controles antigos ao sincronizar uma lista vazia", async () => {
    await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(1);
    expect(await sendContentMessage({ action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS, fields: [] }))
      .toEqual({ updated: true, count: 0 });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(0);
  });

  it("oculta e reexibe controles flutuantes sem alterar o preenchimento", async () => {
    await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(1);

    expect(await sendContentMessage({
      action: ACTIONS.SET_PAGE_FIELD_CONTROLS_VISIBILITY,
      visible: false
    })).toEqual({ updated: true, count: 0 });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(0);

    expect(await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      visible: true,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    })).toEqual({ updated: true, count: 1 });
  });

  it("marca todos os seletores e informa falhas sem interromper o lote", async () => {
    const response = await sendContentMessage({
      action: ACTIONS.MARK_ALL_FIELDS,
      selectors: ["#email", "#missing"]
    });
    expect(response.marked).toBe(1);
    expect(response.total).toBe(2);
    expect(response.failed).toEqual(["#missing"]);
    expect((await sendContentMessage({
      action: ACTIONS.UNMARK_ALL_FIELDS,
      selectors: ["#email", "#missing"]
    })).unmarked).toBeGreaterThanOrEqual(1);
  });

  it("conta e marca correspondências do playground", async () => {
    expect(await sendContentMessage({ action: ACTIONS.COUNT_SELECTOR_MATCHES, selector: "input" }))
      .toEqual({ count: 2 });
    expect(await sendContentMessage({ action: ACTIONS.MARK_SELECTOR_MATCHES, selector: "input" }))
      .toEqual({ count: 2 });
    expect(await sendContentMessage({ action: ACTIONS.UNMARK_SELECTOR_MATCHES, selector: "input" }))
      .toEqual({ count: 2 });
  });

  it("preenche datas, meses e números normalizando formatos brasileiros", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <input id="date" type="date">
      <input id="month" type="month">
      <input id="number" type="number">
    `);
    await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#date", value: "03/04/2025" });
    await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#month", value: "03/04/2025" });
    await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#number", value: "R$ 1.234,56" });
    expect(document.querySelector("#date").value).toBe("2025-04-03");
    expect(document.querySelector("#month").value).toBe("2025-04");
    expect(document.querySelector("#number").value).toBe("1234.56");
  });

  it("preenche selects por valor, texto ou escolha aleatória e trata select vazio", async () => {
    document.querySelector("#uf").innerHTML = "<option value='CE'>Ceará</option><option value='SP'>São Paulo</option>";
    await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#uf", value: "São Paulo" });
    expect(document.querySelector("#uf").value).toBe("SP");
    document.querySelector("#uf").innerHTML = "<option value=''>Selecione</option>";
    expect(await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#uf", value: "SP" })).toEqual({ filled: false });
  });

  it("retorna falha para campo desabilitado e aceita mensagem desconhecida", async () => {
    document.querySelector("#email").disabled = true;
    expect(await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#email", value: "x" })).toEqual({ filled: false });
    sendContentMessage({ action: "UNKNOWN_ACTION" });
    sendContentMessage(null);
  });

  it("captura o próximo clique e atualiza controles inválidos", async () => {
    const pending = sendContentMessage({ action: ACTIONS.CAPTURE_NEXT_CLICK });
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    document.querySelector("#email").click();
    const capture = await pending;
    expect(capture.captured).toBe(true);

    expect(await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "missing", selector: "#missing", label: "Ausente" }, null, {}]
    })).toEqual({ updated: true, count: 0 });
  });

  it("preenche e marca componentes customizados e evita menus sem opções", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <multi-select id="custom"><input role="combobox"><div><ul class="ui-autocomplete"><li list-select>Brasil</li></ul></div></multi-select>
      <multi-select id="empty"><input role="combobox"></multi-select>
    `);
    const option = document.querySelector("#custom li");
    option.addEventListener("click", vi.fn());
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#custom", value: "Brasil" })).filled).toBe(true);
    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#custom" })).marked).toBe(true);
    document.querySelector("#custom").remove();
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#empty", value: "Brasil" })).filled).toBe(false);
    expect((await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#custom" })).unmarked).toBe(true);
  });

  it("preenche select2 usando o campo nativo associado ao combobox", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <select id="country" class="select2-hidden-accessible"><option value="BR">Brasil</option></select>
      <span id="select2-country-container" class="select2-selection"></span>
    `);
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#country", value: "Brasil" })).filled).toBe(true);
    expect(document.querySelector("#country").value).toBe("BR");
  });

  it("mantém um único destaque quando seletores compartilham o mesmo alvo", async () => {
    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#email" })).marked).toBe(true);
    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "input[type='email']" })).marked).toBe(true);
    expect((await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#email" })).unmarked).toBe(true);
    expect(await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#missing" })).toEqual({ unmarked: true });
  });

  it("retorna resultados parciais no preenchimento em lote", async () => {
    const response = await sendContentMessage({
      action: ACTIONS.FILL_ALL,
      fields: [
        { selector: "#email", value: "ok@example.test" },
        { selector: "#missing", value: "falha" }
      ]
    });
    expect(response).toEqual({ filled: 1, total: 2, failed: [] });
  });

  it("atualiza o título do botão de campo quando o preenchimento falha", async () => {
    await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "missing", selector: "#email", label: "E-mail" }]
    });
    chrome.runtime.lastError = { message: "Receiver unavailable" };
    document.querySelector(".fakedata-page-fill").click();
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    chrome.runtime.lastError = null;
    expect(document.querySelector(".fakedata-page-fill").title).toBe("Não foi possível preencher este campo");
  });

  it("não duplica listeners nem estilo quando o script é injetado duas vezes na mesma página", async () => {
    // O beforeEach já executou content.js uma vez nesta página.
    expect(document.querySelectorAll("#fakedata-page-control-style")).toHaveLength(1);

    await loadContentScript();

    expect(document.querySelectorAll("#fakedata-page-control-style")).toHaveLength(1);
    // A instância original continua ativa e respondendo normalmente.
    const response = await sendContentMessage({ action: ACTIONS.SCAN_FIELDS });
    expect(response.fields.map((field) => field.selector)).toEqual(["#email", "#cpf", "#uf"]);
  });

  it("presume viva a instalação anterior com guarda booleana (formato antigo)", async () => {
    window.__fakedataContentInstalled = true;

    await loadContentScript();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it("desmonta a instalação anterior antes de reinstalar após contexto invalidado", async () => {
    const originalPushState = history.pushState;
    const previousInstall = window.__fakedataContentInstalled;
    chrome.runtime.id = undefined;

    await loadContentScript();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("#fakedata-page-control-style")).toHaveLength(1);
    expect(history.pushState).not.toBe(originalPushState);
    expect(previousInstall()).toBe(false);
    // A nova instalação responde normalmente (reparo efetivo da página).
    const response = await sendContentMessage({ action: ACTIONS.SCAN_FIELDS });
    expect(response.fields.map((field) => field.selector)).toEqual(["#email", "#cpf", "#uf"]);
  });

  it("reinstala quando o probe da instalação anterior responde falso (runtime sem id)", async () => {
    chrome.runtime.id = undefined;

    await loadContentScript();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
  });

  it("reinstala quando o probe lança e o dispose da instalação anterior também falha", async () => {
    const previousInstall = () => {
      throw new Error("contexto invalidado");
    };
    previousInstall.dispose = () => {
      throw new Error("limpeza impossível");
    };
    window.__fakedataContentInstalled = previousInstall;

    await loadContentScript();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
    const response = await sendContentMessage({ action: ACTIONS.SCAN_FIELDS });
    expect(response.fields.map((field) => field.selector)).toEqual(["#email", "#cpf", "#uf"]);
  });

  it("ignora falha do runtime ao remover o listener durante o dispose", async () => {
    const probe = window.__fakedataContentInstalled;
    chrome.runtime.onMessage.removeListener = vi.fn(() => {
      throw new Error("runtime já invalidado");
    });

    expect(() => probe.dispose()).not.toThrow();
    expect(probe()).toBe(false);
  });

  it("resolve o select nativo do select2 por aria-labelledby e pelo container anterior", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="combo-wrapper"><input role="combobox" aria-labelledby="select2-city-container"></div>
      <select id="city"><option value="RIO">Rio de Janeiro</option></select>
      <span id="select2-city-container"></span>
      <select id="native-prev"><option value="CE">Ceará</option></select>
      <span id="visual-prev" class="select2-container"><input role="combobox"></span>
    `);

    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#combo-wrapper", value: "Rio de Janeiro" })).filled).toBe(true);
    expect(document.querySelector("#city").value).toBe("RIO");
    expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#visual-prev", value: "Ceará" })).filled).toBe(true);
    expect(document.querySelector("#native-prev").value).toBe("CE");
  });

  it("destaca o componente visual de selects select2 marcados", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <select id="sel2-a" class="select2-hidden-accessible"><option value="BR">Brasil</option></select>
      <span id="select2-sel2-a-container" class="select2-selection"></span>
      <select id="sel2-b" class="select2-hidden-accessible"><option value="BR">Brasil</option></select>
      <span class="select2-container"></span>
    `);

    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#sel2-a" })).marked).toBe(true);
    expect(document.querySelector("#select2-sel2-a-container").style.outline).toContain("#ef4444");
    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#sel2-b" })).marked).toBe(true);
    expect((await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#sel2-b" })).unmarked).toBe(true);
  });

  it("marca o contêiner agrupador quando o campo está oculto", async () => {
    document.body.insertAdjacentHTML("beforeend", `
      <fieldset id="grupo"><input id="oculto" style="display: none"></fieldset>
    `);

    expect((await sendContentMessage({ action: ACTIONS.MARK_FIELD, selector: "#oculto" })).marked).toBe(true);
    expect(document.querySelector("#grupo").style.outline).toContain("#ef4444");
    expect((await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#oculto" })).unmarked).toBe(true);
  });

  it("preenche input mesmo sem descritor de valor no protótipo", async () => {
    const prototype = dom.window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    delete prototype.value;
    try {
      expect((await sendContentMessage({ action: ACTIONS.FILL_FIELD, selector: "#email", value: "sem-acessor" })).filled).toBe(true);
      expect(document.querySelector("#email").value).toBe("sem-acessor");
    } finally {
      Object.defineProperty(prototype, "value", descriptor);
    }
  });

  it("trata seletor inválido no playground e desmarca campo nunca marcado", async () => {
    expect(await sendContentMessage({ action: ACTIONS.MARK_SELECTOR_MATCHES, selector: "[" }))
      .toEqual({ invalid: true, count: 0 });
    expect(await sendContentMessage({ action: ACTIONS.UNMARK_FIELD, selector: "#email" }))
      .toEqual({ unmarked: true });
  });

  it("restaura o título do botão quando o preenchimento é bem-sucedido", async () => {
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (typeof callback === "function") callback({ filled: true });
    });
    await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });

    document.querySelector(".fakedata-page-fill").click();
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));

    expect(document.querySelector(".fakedata-page-fill").title).toBe("Preencher E-mail");
  });

  it("reexibe controles pela ação de visibilidade e os remove no UPDATE com visible falso", async () => {
    await sendContentMessage({
      action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS,
      fields: [{ key: "email-field", selector: "#email", label: "E-mail" }]
    });

    expect(await sendContentMessage({ action: ACTIONS.SET_PAGE_FIELD_CONTROLS_VISIBILITY, visible: true }))
      .toEqual({ updated: true, count: 1 });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(1);

    expect(await sendContentMessage({ action: ACTIONS.UPDATE_PAGE_FIELD_CONTROLS, visible: false, fields: [] }))
      .toEqual({ updated: true, count: 0 });
    expect(document.querySelectorAll(".fakedata-page-fill")).toHaveLength(0);
  });

  it("coleta falhas individuais no preenchimento em lote", async () => {
    const email = document.querySelector("#email");
    Object.defineProperty(email, "disabled", {
      configurable: true,
      get() {
        throw new Error("explosão");
      }
    });

    const response = await sendContentMessage({
      action: ACTIONS.FILL_ALL,
      fields: [
        { selector: "#email", value: "falha" },
        { selector: "#cpf", value: "ok" }
      ]
    });

    expect(response).toEqual({
      filled: 1,
      total: 2,
      failed: [{ selector: "#email", error: "explosão" }]
    });
  });
});
