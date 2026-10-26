import { describe, expect, it } from "vitest";
import { getBaseUrl, normalizePageUrl } from "../src/scripts/domain/url-utils.js";

describe("url-utils", () => {
  describe("getBaseUrl", () => {
    // Os casos com `.org.br` e `.net` documentam o comportamento atual (achado A3).
    // Não são bugs a corrigir nesta refatoração.
    it.each([
      ["https://app.empresa.com.br/x", "https://empresa.com.br"],
      ["https://www.google.com.br:8443/x", "https://google.com.br:8443"],
      ["https://qa.app.com", "https://app.com"],
      ["https://example.com", "https://example.com"],
      ["http://localhost:3000", "http://localhost:3000"],
      ["https://app.x.org.br", "https://app.x.org.br"],
      ["https://a.b.example.net", "https://a.b.example.net"],
      ["not a url", ""],
    ])("getBaseUrl(%s) retorna %s", (input, expected) => {
      expect(getBaseUrl(input)).toBe(expected);
    });
  });

  describe("normalizePageUrl", () => {
    it.each([
      ["https://a.com/p?x=1#h", "https://a.com/p"],
      ["https://a.com", "https://a.com/"],
      ["not a url", "not a url"],
    ])("normalizePageUrl(%s) retorna %s", (input, expected) => {
      expect(normalizePageUrl(input)).toBe(expected);
    });
  });
});
