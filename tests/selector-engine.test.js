import { beforeEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { inferType, scan, selectorFor } from "../src/scripts/selector-engine.js";

let dom;

beforeEach(() => {
  dom = new JSDOM(`<!doctype html><body>
    <label for="email">E-mail</label><input id="email" type="email" autocomplete="email">
    <label for="uf">Estado</label><select id="uf"><option>SP</option><option>RJ</option></select>
  </body>`, { url: "https://example.test/form" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
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
      <select id="state"><option>SP</option><option>RJ</option></select>
    `;

    expect(inferType(document.querySelector("#cpf"))).toBe("cpf");
    expect(inferType(document.querySelector("#cnpj"))).toBe("cnpj");
    expect(inferType(document.querySelector("#cep"))).toBe("cep");
    expect(inferType(document.querySelector("#phone"))).toBe("phone");
    expect(inferType(document.querySelector("#birth"))).toBe("birthDate");
    expect(inferType(document.querySelector("#state"))).toBe("state");
  });
});
