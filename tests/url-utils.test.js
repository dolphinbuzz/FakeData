import { describe, expect, it } from "vitest";
import { getBaseUrl, normalizePageUrl } from "../src/scripts/domain/url-utils.js";

describe("url-utils", () => {
  describe("getBaseUrl", () => {
    // Sufixo de segundo nível conhecido (achado A3): mantém 3 labels.
    // TLD simples: mantém 2 labels.
    it.each([
      ["https://app.empresa.com.br/x", "https://empresa.com.br"],
      ["https://www.google.com.br:8443/x", "https://google.com.br:8443"],
      ["https://qa.app.com", "https://app.com"],
      ["https://example.com", "https://example.com"],
      ["http://localhost:3000", "http://localhost:3000"],
      ["https://qa.app.org.br/x", "https://app.org.br"],
      ["https://sub.dominio.com.br", "https://dominio.com.br"],
      ["https://exemplo.com.br", "https://exemplo.com.br"],
      ["https://a.b.c.com", "https://c.com"],
      ["https://qa.app.net", "https://app.net"],
      ["https://qa.app.io", "https://app.io"],
      ["https://a.b.example.net", "https://example.net"],
      ["https://app.x.org.br", "https://x.org.br"],
      ["https://qa.app.co.uk", "https://app.co.uk"],
      ["https://qa.app.com.au", "https://app.com.au"],
      ["https://qa.app.co.jp", "https://app.co.jp"],
      ["https://qa.app.dev.br", "https://app.dev.br"],
      ["http://192.168.0.1:8080", "http://192.168.0.1:8080"],
      ["http://[::1]:3000", "http://[::1]:3000"],
      ["https://sistema.example.test", "https://sistema.example.test"],
      ["https://outro.example.test/p", "https://outro.example.test"],
      ["https://a.b.example.invalid", "https://a.b.example.invalid"],
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
