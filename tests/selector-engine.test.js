import { beforeEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { inferType, scan } from "../src/scripts/selector-engine.js";

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
});
