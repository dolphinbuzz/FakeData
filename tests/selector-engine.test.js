import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

// O módulo mantém estado interno (última assinatura da página e flag de contexto
// invalidado). Recarregamos o módulo a cada teste para isolar esse estado — sem
// isso, o teste de contexto invalidado silencia as notificações de todos os
// testes seguintes, que passariam sem exercitar nada.
let dom;
let sendMessage;
let captureNextClick;
let inferType;
let installNavigationObserver;
let isCustomSelect;
let normalize;
let notifyPageChanged;
let pageSignature;
let scan;
let selectorFor;
let isDynamicId;
let isAngularAttribute;
let isAngularClass;
let hasAngularAttributes;
let fieldFromTarget;
let visible;
let uniqueCandidate;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
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

  vi.resetModules();
  ({
    captureNextClick,
    inferType,
    installNavigationObserver,
    isCustomSelect,
    normalize,
    notifyPageChanged,
    pageSignature,
    scan,
    selectorFor,
    isDynamicId,
    isAngularAttribute,
    isAngularClass,
    hasAngularAttributes,
    fieldFromTarget,
    visible,
    uniqueCandidate
  } = await import("../src/scripts/selector-engine.js"));
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
    ["data-testid", '<input data-testid="email-field">', '[data-testid="email-field"]', "data-testid"],
    ["aria-label", '<input aria-label="Email">', 'input[aria-label="Email"]', "aria-label"]
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

  it("prioriza value exato e atributos semânticos antes do fallback", () => {
    document.body.innerHTML = `
      <label><input type="radio" value="Male"></label>
      <label><input type="radio" value="FeMale"></label>
      <select data-testid="month-select"><option>January</option></select>
    `;
    // Combinações rodam primeiro: type + value (priority 1) é mais específico que value sozinho
    expect(selectorFor(document.querySelectorAll("input")[1])).toMatchObject({
      selector: 'input[type="radio"][value="FeMale"]',
      rule: "type + value",
      status: "stable"
    });
    expect(selectorFor(document.querySelector("select"))).toMatchObject({
      selector: '[data-testid="month-select"]',
      rule: "data-testid"
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
      <input id="tel" type="tel">
      <input id="site" type="url">
      <input id="autocomplete-house" autocomplete="house">
      <input id="autocomplete-org" autocomplete="company-name">
      <input id="autocomplete-family" autocomplete="family-name">
      <input id="autocomplete-name" autocomplete="name">
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
    expect(inferType(document.querySelector("#tel"))).toBe("phone");
    expect(inferType(document.querySelector("#site"))).toBe("website");
    expect(inferType(document.querySelector("#autocomplete-house"))).toBe("number");
    expect(inferType(document.querySelector("#autocomplete-org"))).toBe("company");
    expect(inferType(document.querySelector("#autocomplete-family"))).toBe("name");
    expect(inferType(document.querySelector("#autocomplete-name"))).toBe("name");
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

    const linkCapture = vi.fn();
    captureNextClick(linkCapture);
    const link = document.createElement("a");
    link.href = "#detalhes";
    link.id = "action-link";
    link.textContent = "Ver detalhes";
    document.body.appendChild(link);
    link.click();
    expect(linkCapture).toHaveBeenCalledWith(expect.objectContaining({
      captured: true,
      field: expect.objectContaining({ selector: "#action-link", tagName: "a" })
    }));

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

  it("não envia notificação quando o runtime da extensão não está disponível", () => {
    delete globalThis.chrome;
    document.body.appendChild(document.createElement("input"));

    expect(() => notifyPageChanged()).not.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
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

  it("notifica uma única vez a mudança de rota capturada por pushState e popstate", async () => {
    installNavigationObserver();

    history.pushState({}, "", "/outra");
    window.dispatchEvent(new dom.window.Event("popstate"));
    await wait(300);

    expect(window.location.pathname).toBe("/outra");
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      action: "PAGE_CONTENT_CHANGED",
      url: "https://example.test/outra",
      changeType: "route"
    });

    window.dispatchEvent(new dom.window.Event("popstate"));
    await wait(300);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("cobre replaceState, hashchange e cleanup do observador de navegação", async () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const cleanup = installNavigationObserver();

    history.replaceState({}, "", "/substituida");
    await wait(300);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      action: "PAGE_CONTENT_CHANGED",
      url: "https://example.test/substituida",
      changeType: "route"
    });

    window.dispatchEvent(new dom.window.Event("hashchange"));
    await wait(300);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    cleanup();
    expect(history.pushState).toBe(originalPushState);
    expect(history.replaceState).toBe(originalReplaceState);
    expect(window.location.pathname).toBe("/substituida");

    sendMessage.mockClear();
    history.pushState({}, "", "/depois-do-cleanup");
    await wait(300);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("detecta IDs dinâmicos e evita usá-los", () => {
    // O regex detecta: prefixo r/component/ember/headlessui seguido de [-_], ou hash/numéricos longos
    expect(isDynamicId("r_123456")).toBe(true);
    expect(isDynamicId("component-789")).toBe(true);
    expect(isDynamicId("ember_123")).toBe(true);
    expect(isDynamicId("headlessui-456")).toBe(true);
    expect(isDynamicId("field_a1b2c3d4")).toBe(true); // 8 hex chars
    expect(isDynamicId("input_123456")).toBe(true); // 6 digits
    expect(isDynamicId("stable-id")).toBe(false);
    expect(isDynamicId("")).toBe(true);
    expect(isDynamicId(null)).toBe(true);
  });

  it("usa fallback estrutural quando o input não tem atributos estáveis", () => {
    document.body.innerHTML = `
      <label>Nome do usuário</label>
      <input>
    `;
    const input = document.querySelector("input");
    const result = selectorFor(input);

    expect(result.status).toBe("fragile");
    expect(result.rule).toBe("fallback proibido");
    expect(result.selector).toBe("input");
  });

  it("testa fallback proibido quando não há texto estático", () => {
    document.body.innerHTML = `
      <form>
        <div>
          <input>
        </div>
      </form>
    `;
    const input = document.querySelector("input");
    const result = selectorFor(input);
    expect(result.status).toBe("fragile");
    expect(result.rule).toBe("fallback proibido");
  });

  it("prioriza name + type + value mesmo com ng-model presente", () => {
    document.body.innerHTML = `
      <input ng-model="user.name" name="username" type="text" value="test">
      <input ng-model="user.email" name="email" type="email" value="test@test.com">
    `;
    const inputs = document.querySelectorAll("input");

    expect(selectorFor(inputs[0])).toMatchObject({
      selector: 'input[name="username"][type="text"][value="test"]',
      rule: "name + type + value",
      status: "stable"
    });
    expect(selectorFor(inputs[1])).toMatchObject({
      selector: 'input[name="email"][type="email"][value="test@test.com"]',
      rule: "name + type + value",
      status: "stable"
    });
  });

  it("testa fieldFromTarget com label for", () => {
    document.body.innerHTML = `
      <label for="target-input">Label</label>
      <input id="target-input">
    `;
    const label = document.querySelector("label");
    const result = fieldFromTarget(label);
    expect(result).not.toBeNull();
    expect(result.id).toBe("target-input");
  });

  it("testa fieldFromTarget com label nested", () => {
    document.body.innerHTML = `
      <label>
        <span>Label</span>
        <input id="nested-input">
      </label>
    `;
    const label = document.querySelector("label");
    const result = fieldFromTarget(label);
    expect(result).not.toBeNull();
    expect(result.id).toBe("nested-input");
  });

  it("testa fieldFromTarget com container form", () => {
    document.body.innerHTML = `
      <form>
        <input id="form-input">
      </form>
    `;
    const form = document.querySelector("form");
    const result = fieldFromTarget(form);
    expect(result).not.toBeNull();
    expect(result.id).toBe("form-input");
  });

  it("testa pageSignature com mudança de rota", () => {
    const initialSig = pageSignature();
    // Simula navegação
    history.pushState({}, "", "/nova-pagina");
    const newSig = pageSignature();
    expect(newSig).not.toBe(initialSig);
  });

  it("testa isCustomSelect com diferentes seletores", () => {
    document.body.innerHTML = `
      <multi-select id="ms"></multi-select>
      <div role="combobox" id="role-combo"></div>
      <div class="ui-autocomplete-multiselect" id="ui-auto"></div>
      <input id="normal-input">
    `;
    expect(isCustomSelect(document.querySelector("#ms"))).toBe(true);
    expect(isCustomSelect(document.querySelector("#role-combo"))).toBe(true);
    expect(isCustomSelect(document.querySelector("#ui-auto"))).toBe(true);
    expect(isCustomSelect(document.querySelector("#normal-input"))).toBe(false);
  });

  it("gera seletores estruturais distintos para campos idênticos sem atributos", () => {
    document.body.innerHTML = `
      <div><input><input></div>
      <div><input><input></div>
    `;
    const fields = scan();

    expect(fields).toHaveLength(4);
    expect(fields.map((field) => field.selector)).toEqual([
      "div:nth-of-type(1) > input:nth-of-type(1)",
      "div:nth-of-type(1) > input:nth-of-type(2)",
      "div:nth-of-type(2) > input:nth-of-type(1)",
      "div:nth-of-type(2) > input:nth-of-type(2)"
    ]);
    expect(fields.every((field) => field.selectorStatus === "fragile")).toBe(true);
    expect(fields.every((field) => field.selectorRule === "fallback proibido")).toBe(true);
  });

  it("ignora mutações em controles da extensão e notifica mutações reais do DOM", async () => {
    installNavigationObserver();

    document.body.insertAdjacentHTML("beforeend", '<div data-fakedata-control="true"><input></div>');
    await wait(300);
    expect(sendMessage).not.toHaveBeenCalled();

    document.body.appendChild(document.createElement("input"));
    await wait(300);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      action: "PAGE_CONTENT_CHANGED",
      url: "https://example.test/form",
      changeType: "dom"
    });
  });

  it("testa visible retorna false para display:none e visibility:hidden", () => {
    document.body.innerHTML = `
      <input id="visible">
      <input id="hidden-display" style="display:none">
      <input id="hidden-visibility" style="visibility:hidden">
      <input id="no-rects">
    `;
    // Mock getClientRects para retornar vazio para no-rects
    const noRects = document.querySelector("#no-rects");
    noRects.getClientRects = () => [];
    
    expect(visible(document.querySelector("#visible"))).toBe(true);
    expect(visible(document.querySelector("#hidden-display"))).toBe(false);
    expect(visible(document.querySelector("#hidden-visibility"))).toBe(false);
    expect(visible(noRects)).toBe(false);
  });

  it("uniqueCandidate aceita seletor único e rejeita duplicado, divergente ou inválido", () => {
    document.body.innerHTML = `
      <input id="unico">
      <input name="dup">
      <input name="dup">
    `;
    const unico = document.querySelector("#unico");
    const dup = document.querySelector("[name='dup']");

    expect(uniqueCandidate(unico, "#unico")).toBe(true);
    expect(uniqueCandidate(unico, "input")).toBe(false);
    expect(uniqueCandidate(dup, "#unico")).toBe(false);
    expect(uniqueCandidate(dup, "[name='dup']")).toBe(false);
    expect(uniqueCandidate(unico, "%%% seletor inválido %%%")).toBe(false);
  });

  it("usa texto visível estático quando o campo tem texto curto e literal", () => {
    document.body.innerHTML = `<select><option>Escolha o estado</option><option>SP</option></select>`;
    const select = document.querySelector("select");

    const result = selectorFor(select);

    expect(result.status).toBe("fragile");
    expect(result.rule).toBe("texto visível estático");
    expect(result.selector).toBe("select");
    expect(result.suggestion).toContain("Escolha o estado");
  });

  it("não usa texto vazio, longo ou com template como seletor estático", () => {
    document.body.innerHTML = `
      <select id="vazio"></select>
      <select id="longo"><option>${"x".repeat(90)}</option></select>
      <select id="template"><option>{{valor}}</option></select>
    `;

    ["vazio", "longo", "template"].forEach((id) => {
      const select = document.querySelector(`#${id}`);
      select.removeAttribute("id");
      expect(selectorFor(select).rule).toBe("fallback proibido");
    });
  });

  it("testa combinações sem valor (continue no loop)", () => {
    document.body.innerHTML = `<input data-testid="test-field">`;
    const input = document.querySelector("input");
    // Tem data-testid mas não name, type, value
    // Combinações sem valor devem ser ignoradas, data-testid sozinho funciona
    const result = selectorFor(input);
    expect(result.rule).toBe("data-testid");
    expect(result.status).toBe("stable");
  });

  it("testa inferType com label anterior (previousElementSibling)", () => {
    document.body.innerHTML = `
      <span>CPF</span>
      <input id="cpf-field">
    `;
    const input = document.querySelector("#cpf-field");
    expect(inferType(input)).toBe("cpf");
  });

  it("testa inferType com aria-describedby", () => {
    document.body.innerHTML = `
      <span id="desc">CPF do usuário</span>
      <input id="cpf-field" aria-describedby="desc">
    `;
    const input = document.querySelector("#cpf-field");
    expect(inferType(input)).toBe("cpf");
  });

  it("ignora candidato quando o navegador rejeita o seletor gerado e segue para o próximo", () => {
    document.body.innerHTML = `<input id="seguro" data-testid="campo-invalido">`;
    const input = document.querySelector("#seguro");
    const originalQuerySelectorAll = document.querySelectorAll.bind(document);
    const qsaSpy = vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (String(selector).includes("[data-testid=")) {
        throw new DOMException("seletor inválido neste navegador", "SyntaxError");
      }
      return originalQuerySelectorAll(selector);
    });

    let result;
    try {
      result = selectorFor(input);
    } finally {
      qsaSpy.mockRestore();
    }

    expect(result.selector).toBe("#seguro");
    expect(result.rule).toBe("id");
    expect(result.status).toBe("stable");
  });

  it("testa fallbackSelector percorre árvore até body", () => {
    document.body.innerHTML = `
      <form>
        <div class="container">
          <div class="row">
            <input>
            <input>
          </div>
        </div>
      </form>
    `;
    const inputs = document.querySelectorAll("input");
    const input = inputs[1]; // Segundo input
    // Remove todos atributos estáveis
    input.removeAttribute("id");
    input.removeAttribute("name");
    input.removeAttribute("type");
    input.removeAttribute("placeholder");
    input.removeAttribute("value");
    input.removeAttribute("autocomplete");
    input.removeAttribute("aria-label");
    
    const result = selectorFor(input);
    expect(result.status).toBe("fragile");
    expect(result.selector).toContain(":nth-of-type");
  });

  it("testa scan com elementos duplicados e únicos", () => {
    document.body.innerHTML = `
      <input id="unique">
      <input name="duplicate">
      <input name="duplicate">
    `;
    const fields = scan();
    expect(fields.length).toBe(3);
    // O unique deve ser stable
    const uniqueField = fields.find(f => f.selector === "#unique");
    expect(uniqueField.selectorStatus).toBe("stable");
    // Pelo menos um campo deve ser fragile (os duplicados)
    const fragileFields = fields.filter(f => f.selectorStatus === "fragile");
    expect(fragileFields.length).toBeGreaterThanOrEqual(1);
  });

  it("testa labelsFor com aria-labelledby", () => {
    document.body.innerHTML = `
      <span id="lbl1">Nome</span>
      <span id="lbl2">Completo</span>
      <input id="field" aria-labelledby="lbl1 lbl2">
    `;
    const input = document.querySelector("#field");
    // labelsFor é função interna, testamos via inferType que usa labelsFor
    expect(inferType(input)).toBe("name"); // "nome completo" contém "name"/"nome"
  });

  it("testa fieldFromTarget retorna null para elemento sem campo", () => {
    document.body.innerHTML = `<div id="no-field"></div>`;
    const div = document.querySelector("#no-field");
    const result = fieldFromTarget(div);
    expect(result).toBeNull();
  });

  // ===== TESTES ESPECÍFICOS PARA ANGULAR (2+) =====

  describe("Angular (2+) - detecção de atributos instáveis", () => {
    it("detecta ng-reflect-* como atributo Angular instável", () => {
      document.body.innerHTML = `<input ng-reflect-name="email" ng-reflect-model="test@test.com">`;
      const input = document.querySelector("input");
      expect(hasAngularAttributes(input)).toBe(true);
      const result = selectorFor(input);
      expect(result.status).toBe("fragile");
      expect(result.rule).toContain("Angular");
    });

    it("detecta _ngcontent-* como atributo Angular instável", () => {
      document.body.innerHTML = `<input _ngcontent-ng-c123456789="1">`;
      const input = document.querySelector("input");
      expect(hasAngularAttributes(input)).toBe(true);
      const result = selectorFor(input);
      expect(result.status).toBe("fragile");
    });

    it("detecta _nghost-* como atributo Angular instável", () => {
      document.body.innerHTML = `<div _nghost-ng-c123456789="1"><input></div>`;
      const div = document.querySelector("div");
      expect(hasAngularAttributes(div)).toBe(true);
    });

    it("detecta IDs Angular Material (mat-input-0, mat-select-1, etc.)", () => {
      expect(isAngularAttribute("mat-input-0")).toBe(true);
      expect(isAngularAttribute("mat-select-1")).toBe(true);
      expect(isAngularAttribute("mat-option-2")).toBe(true);
      expect(isAngularAttribute("cdk-describedby-message-3")).toBe(true);
      expect(isAngularAttribute("cdk-overlay-4")).toBe(true);
      expect(isAngularAttribute("stable-id")).toBe(false);
    });

    it("detecta classes Angular (ng-valid, ng-invalid, etc.)", () => {
      expect(isAngularClass("ng-valid")).toBe(true);
      expect(isAngularClass("ng-invalid")).toBe(true);
      expect(isAngularClass("ng-dirty")).toBe(true);
      expect(isAngularClass("ng-pristine")).toBe(true);
      expect(isAngularClass("ng-touched")).toBe(true);
      expect(isAngularClass("ng-untouched")).toBe(true);
      expect(isAngularClass("ng-submitted")).toBe(true);
      expect(isAngularClass("ng-pending")).toBe(true);
      expect(isAngularClass("cdk-overlay-pane")).toBe(true);
      expect(isAngularClass("mat-form-field")).toBe(true);
      expect(isAngularClass("minha-classe-custom")).toBe(false);
    });

    it("usa data-cy estável mesmo quando elemento tem atributos Angular", () => {
      document.body.innerHTML = `<input ng-reflect-name="email" data-cy="stable-email">`;
      const input = document.querySelector("input");
      // data-cy estável tem prioridade sobre detecção de Angular
      const result = selectorFor(input);
      expect(result.status).toBe("stable");
      expect(result.rule).toBe("data-cy");
      expect(result.selector).toBe('[data-cy="stable-email"]');
    });

    it("usa data-cy estável quando NÃO tem atributos Angular", () => {
      document.body.innerHTML = `<input data-cy="email-field" name="email">`;
      const input = document.querySelector("input");
      const result = selectorFor(input);
      expect(result.selector).toBe('[data-cy="email-field"]');
      expect(result.rule).toBe("data-cy");
      expect(result.status).toBe("stable");
    });

    it("ignora ng-version attribute", () => {
      expect(isAngularAttribute("ng-version")).toBe(true);
    });

    it("prioriza data-testid sobre name quando ambos presentes e únicos", () => {
      document.body.innerHTML = `<input data-testid="email-input" name="email" type="email">`;
      const input = document.querySelector("input");
      const result = selectorFor(input);
      expect(result.rule).toBe("data-testid");
      expect(result.selector).toBe('[data-testid="email-input"]');
      expect(result.status).toBe("stable");
    });

    it("usa autocomplete + name como combinação estável", () => {
      document.body.innerHTML = `<input autocomplete="email" name="user-email" type="email">`;
      const input = document.querySelector("input");
      const result = selectorFor(input);
      expect(result.rule).toBe("autocomplete + name");
      expect(result.selector).toBe('input[autocomplete="email"][name="user-email"]');
      expect(result.status).toBe("stable");
    });

    it("usa placeholder + name como combinação estável", () => {
      document.body.innerHTML = `<input placeholder="Digite seu email" name="email" type="email">`;
      const input = document.querySelector("input");
      const result = selectorFor(input);
      expect(result.rule).toBe("placeholder + name");
      expect(result.selector).toBe('input[placeholder="Digite seu email"][name="email"]');
      expect(result.status).toBe("stable");
    });
  });

  // ===== TESTES PARA isDynamicId COM PADRÕES ANGULAR =====

  describe("isDynamicId - padrões Angular", () => {
    it("detecta IDs numéricos sequenciais como dinâmicos", () => {
      expect(isDynamicId("mat-input-0")).toBe(true);
      expect(isDynamicId("mat-select-1")).toBe(true);
      expect(isDynamicId("cdk-describedby-message-2")).toBe(true);
    });

    it("não detecta IDs estáveis como dinâmicos", () => {
      expect(isDynamicId("email-field")).toBe(false);
      expect(isDynamicId("user-name")).toBe(false);
      expect(isDynamicId("cpf-input")).toBe(false);
    });
  });

  // ===== COBERTURA ADICIONAL DE COMBINAÇÕES E ALVOS =====

  describe("cobertura adicional de seletores e alvos", () => {
    it("usa data-test quando não há atributos de maior prioridade", () => {
      document.body.innerHTML = `<input data-test="campo-extra">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("data-test");
      expect(result.selector).toBe('[data-test="campo-extra"]');
    });

    it("usa a combinação name + value sem type", () => {
      document.body.innerHTML = `<input name="nickname" value="ana">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("name + value");
      expect(result.selector).toBe('input[name="nickname"][value="ana"]');
    });

    it("usa a combinação name + type sem value", () => {
      document.body.innerHTML = `<input name="nickname" type="text">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("name + type");
      expect(result.selector).toBe('input[name="nickname"][type="text"]');
    });

    it("usa a combinação role + aria-label", () => {
      document.body.innerHTML = `<div role="button" aria-label="Salvar"></div>`;
      const result = selectorFor(document.querySelector("div"));
      expect(result.rule).toBe("role + aria-label");
      expect(result.selector).toBe('div[role="button"][aria-label="Salvar"]');
    });

    it("usa a combinação aria-labelledby + role", () => {
      document.body.innerHTML = `
        <span id="rotulo">Salvar</span>
        <div role="button" aria-labelledby="rotulo"></div>
      `;
      const result = selectorFor(document.querySelector("div"));
      expect(result.rule).toBe("aria-labelledby + role");
      expect(result.selector).toBe('div[aria-labelledby="rotulo"][role="button"]');
    });

    it("usa o candidato aria-labelledby isolado", () => {
      document.body.innerHTML = `
        <span id="rotulo">Nome</span>
        <div aria-labelledby="rotulo"></div>
      `;
      const result = selectorFor(document.querySelector("div"));
      expect(result.rule).toBe("aria-labelledby");
      expect(result.selector).toBe('div[aria-labelledby="rotulo"]');
    });

    it("usa o candidato value isolado", () => {
      document.body.innerHTML = `<input value="ana">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("value");
      expect(result.selector).toBe('input[value="ana"]');
    });

    it("usa o candidato type isolado", () => {
      document.body.innerHTML = `<input type="text">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("type");
      expect(result.selector).toBe('input[type="text"]');
    });

    it("usa o candidato autocomplete isolado", () => {
      document.body.innerHTML = `<input autocomplete="email">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("autocomplete");
      expect(result.selector).toBe('input[autocomplete="email"]');
    });

    it("usa o candidato placeholder isolado", () => {
      document.body.innerHTML = `<input placeholder="Digite seu nome">`;
      const result = selectorFor(document.querySelector("input"));
      expect(result.rule).toBe("placeholder");
      expect(result.selector).toBe('input[placeholder="Digite seu nome"]');
    });

    it("retorna o fallback quando o elemento não está no documento", () => {
      const detached = document.createElement("input");
      const result = selectorFor(detached);
      expect(result.rule).toBe("fallback proibido");
      expect(result.selector).toBe("input");
    });

    it("resolve opção de lista para o campo customizado do grupo", () => {
      document.body.innerHTML = `
        <div class="form-group">
          <multi-select><input id="custom"></multi-select>
          <div role="option">Opção</div>
        </div>
      `;
      const option = document.querySelector("[role='option']");
      expect(fieldFromTarget(option)).toBe(document.querySelector("multi-select"));
    });

    it("resolve label com campo oculto aninhado", () => {
      document.body.innerHTML = `<label><input type="hidden" id="oculto"></label>`;
      const label = document.querySelector("label");
      expect(fieldFromTarget(label)).toBe(document.querySelector("#oculto"));
    });

    it("resolve label com for apontando para campo oculto", () => {
      document.body.innerHTML = `
        <label for="oculto">Oculto</label>
        <input type="hidden" id="oculto">
      `;
      const label = document.querySelector("label");
      expect(fieldFromTarget(label)).toBe(document.querySelector("#oculto"));
    });

    it("remove o listener de captura após 30 segundos", () => {
      vi.useFakeTimers();
      try {
        const captured = vi.fn();
        captureNextClick(captured);
        vi.advanceTimersByTime(30000);
        document.querySelector("#email").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        expect(captured).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
