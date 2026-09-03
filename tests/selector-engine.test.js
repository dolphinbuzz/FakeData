import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  captureNextClick,
  inferType,
  installNavigationObserver,
  isCustomSelect,
  normalize,
  notifyPageChanged,
  pageSignature,
  scan,
  selectorFor
} from "../src/scripts/selector-engine.js";

let dom;
let sendMessage;

beforeEach(() => {
  dom = new JSDOM(`<!doctype html><body>
    <label for="email">E-mail</label><input id="email" type="email" autocomplete="email">
    <label for="uf">Estado</label><select id="uf"><option>SP</option><option>RJ</option></select>
  </body>`, { url: "https://example.test/form" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.history = dom.window.history;
  globalThis.MutationObserver = dom.window.MutationObserver;
  sendMessage = vi.fn();
  globalThis.chrome = { runtime: { sendMessage } };
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
});

afterEach(() => {
  dom.window.close();
  delete globalThis.chrome;
});

describe("selector engine", () => {
  it("infere tipos por metadados dos campos", () => {
    expect(inferType(document.querySelector("#email"))).toBe("email");
    expect(inferType(document.querySelector("#uf"))).toBe("state");
  });

  it("escaneia campos visíveis e descreve seus seletores", () => {
    const fields = scan();
    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.selector)).toEqual(["#email", "#uf"]);
  });

  it("inclui seletores reais na assinatura da página", () => {
    const signature = pageSignature();

    expect(signature).toContain("#email|id|stable");
    expect(signature).toContain("#uf|id|stable");
    expect(signature).not.toContain("[object Object]");
  });

  it("ignora notificações pendentes depois que a janela é encerrada", () => {
    dom.window.close();

    expect(() => notifyPageChanged()).not.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["id único", '<input id="stable-field">', "#stable-field", "id"],
    ["data-cy", '<input data-cy="email-field">', '[data-cy="email-field"]', "data-cy"],
    ["ng-model", '<select ng-model="monthbox"><option>January</option></select>', 'select[ng-model="monthbox"]', "ng-model"]
  ])("prioriza %s", (_, markup, expectedSelector, expectedRule) => {
    document.body.innerHTML = markup;
    const element = document.body.firstElementChild;
    const result = selectorFor(element);

    expect(result.selector).toBe(expectedSelector);
    expect(result.rule).toBe(expectedRule);
    expect(result.status).toBe("stable");
  });

  it("marca como frágil um campo sem atributo estável", () => {
    document.body.innerHTML = '<form><div><input></div><div><input></div></form>';
    const result = selectorFor(document.querySelector("input"));

    expect(result.selector).toContain(":nth-of-type");
    expect(result.status).toBe("fragile");
  });

  it("infere categorias de formulário", () => {
    document.body.innerHTML = `
      <input id="cpf" name="cpf">
      <input id="cnpj" name="cnpj">
      <input id="cep" placeholder="CEP">
      <input id="phone" type="tel">
      <input id="birth" name="birthDate">
      <input id="vin" name="chassi">
      <select id="state"><option>SP</option><option>RJ</option></select>
    `;

    expect(inferType(document.querySelector("#cpf"))).toBe("cpf");
    expect(inferType(document.querySelector("#cnpj"))).toBe("cnpj");
    expect(inferType(document.querySelector("#cep"))).toBe("cep");
    expect(inferType(document.querySelector("#phone"))).toBe("phone");
    expect(inferType(document.querySelector("#birth"))).toBe("birthDate");
    expect(inferType(document.querySelector("#vin"))).toBe("chassi");
    expect(inferType(document.querySelector("#state"))).toBe("state");
  });

  it("normaliza texto e escapa atributos difíceis", () => {
    expect(normalize(" João__da--Silva ")).toBe("joao da silva");
    const element = document.createElement("input");
    element.setAttribute("data-cy", 'field"quote');
    document.body.appendChild(element);
    const result = selectorFor(element);
    expect(result.selector).toBe('[data-cy="field\\"quote"]');
  });

  it("prioriza value exato e ng-model antes do fallback", () => {
    document.body.innerHTML = `
      <label><input type="radio" value="Male"></label>
      <label><input type="radio" value="FeMale"></label>
      <select ng-model="monthbox"><option>January</option></select>
    `;
    expect(selectorFor(document.querySelectorAll("input")[1])).toMatchObject({
      selector: 'input[value="FeMale"]',
      rule: "value",
      status: "stable"
    });
    expect(selectorFor(document.querySelector("select"))).toMatchObject({
      selector: 'select[ng-model="monthbox"]',
      rule: "ng-model"
    });
  });

  it("ignora campos ocultos, desabilitados e tipos não editáveis", () => {
    document.body.innerHTML = `
      <input type="hidden" id="hidden">
      <input type="submit" id="submit">
      <input disabled id="disabled">
      <input id="visible">
    `;
    expect(scan().map((field) => field.selector)).toEqual(["#visible"]);
  });

  it("marca colisões de seletores sem omitir os campos", () => {
    document.body.innerHTML = '<input name="same"><input name="same">';
    const fields = scan();
    expect(fields).toHaveLength(2);
    expect(fields.every((field) => field.selector && field.selectorStatus === "fragile")).toBe(true);
  });

  it("usa atributos semânticos e texto de opções para inferir categorias", () => {
    document.body.innerHTML = `
      <input aria-label="Nome da mãe">
      <input placeholder="Renda mensal">
      <select aria-label="Sexo"><option>Masculino</option><option>Feminino</option></select>
      <input autocomplete="street-address">
    `;
    expect(inferType(document.querySelector("[aria-label='Nome da mãe']"))).toBe("mother");
    expect(inferType(document.querySelector("[placeholder='Renda mensal']"))).toBe("income");
    expect(inferType(document.querySelector("select"))).toBe("gender");
    expect(inferType(document.querySelector("[autocomplete='street-address']"))).toBe("address");
  });

  it("infere todas as categorias textuais e usa fallbacks de tipo", () => {
    document.body.innerHTML = `
      <input id="rg" aria-label="RG">
      <input id="father" aria-label="Nome do pai">
      <input id="profession" aria-label="Profissão">
      <input id="neighborhood" aria-label="Bairro">
      <input id="number" aria-label="Número da residência">
      <input id="plate" aria-label="Placa">
      <input id="brand" aria-label="Marca">
      <input id="model" aria-label="Modelo">
      <input id="year" aria-label="Ano">
      <input id="website" aria-label="Website">
      <input id="company" name="empresa">
      <input id="given" autocomplete="given-name">
      <input id="numeric" type="number">
      <input id="date" type="date">
      <input id="month" type="month">
      <input id="plain">
    `;
    expect(inferType(document.querySelector("#rg"))).toBe("rg");
    expect(inferType(document.querySelector("#father"))).toBe("father");
    expect(inferType(document.querySelector("#profession"))).toBe("profession");
    expect(inferType(document.querySelector("#neighborhood"))).toBe("neighborhood");
    expect(inferType(document.querySelector("#number"))).toBe("number");
    expect(inferType(document.querySelector("#plate"))).toBe("plate");
    expect(inferType(document.querySelector("#brand"))).toBe("brand");
    expect(inferType(document.querySelector("#model"))).toBe("model");
    expect(inferType(document.querySelector("#year"))).toBe("year");
    expect(inferType(document.querySelector("#website"))).toBe("website");
    expect(inferType(document.querySelector("#company"))).toBe("company");
    expect(inferType(document.querySelector("#given"))).toBe("name");
    expect(inferType(document.querySelector("#numeric"))).toBe("number");
    expect(inferType(document.querySelector("#date"))).toBe("birthDate");
    expect(inferType(document.querySelector("#month"))).toBe("birthDate");
    expect(inferType(document.querySelector("#plain"))).toBe("text");
  });

  it("resolve campos customizados e alvos de labels e grupos", () => {
    document.body.innerHTML = `
      <div id="labelled"><span id="caption">Nome</span><input></div>
      <label for="linked">CPF</label><input id="linked">
      <label><input id="nested"></label>
      <div role="group"><input id="group-field"></div>
      <multi-select id="custom"><input role="combobox"></multi-select>
      <div role="option">Opção</div>
    `;
    expect(isCustomSelect(document.querySelector("#custom"))).toBe(true);
    const fields = scan();
    expect(fields.map((field) => field.selector)).toEqual(expect.arrayContaining(["#linked", "#nested", "#group-field", "#custom"]));
  });

  it("captura o próximo clique de campo, label e elemento interativo", async () => {
    const captured = vi.fn();
    captureNextClick(captured);
    document.querySelector("#email").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    expect(captured).toHaveBeenCalledWith(expect.objectContaining({ captured: true, field: expect.objectContaining({ selector: "#email" }) }));

    const buttonCapture = vi.fn();
    captureNextClick(buttonCapture);
    const button = document.createElement("button");
    button.textContent = "Salvar";
    document.body.appendChild(button);
    button.click();
    expect(buttonCapture).toHaveBeenCalledWith(expect.objectContaining({ captured: true }));

    const emptyCapture = vi.fn();
    captureNextClick(emptyCapture);
    document.body.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    expect(emptyCapture).toHaveBeenCalledWith({ captured: false });
  });

  it("notifica mudanças de DOM quando o runtime está disponível", () => {
    document.body.appendChild(document.createElement("input"));
    notifyPageChanged();
    document.body.appendChild(document.createElement("input"));
    notifyPageChanged();

    expect(sendMessage).toHaveBeenLastCalledWith({
      action: "PAGE_CONTENT_CHANGED",
      url: "https://example.test/form",
      changeType: "dom"
    });
  });

  it("não lança quando o contexto da extensão é invalidado", () => {
    sendMessage.mockImplementationOnce(() => {
      throw new Error("Uncaught Error: Extension context invalidated.");
    });

    document.body.appendChild(document.createElement("input"));
    expect(() => notifyPageChanged()).not.toThrow();
    document.body.appendChild(document.createElement("input"));
    expect(() => notifyPageChanged()).not.toThrow();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("instala observador de navegação e ignora controles da extensão", async () => {
    installNavigationObserver();
    history.pushState({}, "", "/outra");
    window.dispatchEvent(new dom.window.Event("popstate"));
    document.body.insertAdjacentHTML("beforeend", '<div data-fakedata-control="true"><input></div>');
    await new Promise((resolveTick) => setTimeout(resolveTick, 300));
    expect(window.location.pathname).toBe("/outra");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
