import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/scripts/domain/html-utils.js";

describe("html-utils", () => {
  describe("escapeHtml", () => {
    it("converte null e undefined em string vazia", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
    });

    it("converte números em string", () => {
      expect(escapeHtml(123)).toBe("123");
      expect(escapeHtml(0)).toBe("0");
    });

    it.each([
      ["&", "&amp;"],
      ["<", "&lt;"],
      [">", "&gt;"],
      ['"', "&quot;"],
      ["'", "&#039;"],
    ])("escapa o caractere %s", (input, expected) => {
      expect(escapeHtml(input)).toBe(expected);
    });

    it("escapa todos os caracteres especiais na mesma string", () => {
      expect(escapeHtml("a & b < c > d \" e ' f")).toBe("a &amp; b &lt; c &gt; d &quot; e &#039; f");
    });

    it("mantém texto sem caracteres especiais inalterado", () => {
      expect(escapeHtml("Cadastro de pessoa física")).toBe("Cadastro de pessoa física");
    });
  });
});
