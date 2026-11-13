import { describe, expect, it } from "vitest";
import { auditJson, getMappingAudit } from "../src/scripts/domain/mapping-audit.js";

function field(overrides = {}) {
  return {
    label: "Campo",
    selector: "#campo",
    locatorName: "campo",
    selectorRule: "id",
    selectorStatus: "stable",
    selectorSuggestion: "",
    ...overrides,
  };
}

describe("mapping-audit", () => {
  describe("getMappingAudit", () => {
    it("marca como estável um campo stable com locator único", () => {
      expect(getMappingAudit([field({ selectorSuggestion: "Prefira data-testid" })])).toEqual([
        {
          elemento: "Campo",
          seletorGerado: "#campo",
          locator: "campo",
          regraAplicada: "id",
          status: "estável",
          sugestao: "Prefira data-testid",
        },
      ]);
    });

    it("usa string vazia como sugestão quando o campo stable não tem sugestão", () => {
      expect(getMappingAudit([field()])[0].sugestao).toBe("");
    });

    it("marca como frágil o campo sem selectorStatus e usa os fallbacks", () => {
      const [audit] = getMappingAudit([{ label: "Sem status", selector: "#x" }]);
      expect(audit).toEqual({
        elemento: "Sem status",
        seletorGerado: "#x",
        locator: "",
        regraAplicada: "desconhecida",
        status: "frágil — requer atenção manual",
        sugestao: "",
      });
    });

    it("mantém o primeiro locator estável e marca o segundo como duplicado", () => {
      const audits = getMappingAudit([field({ label: "Primeiro" }), field({ label: "Segundo" })]);
      expect(audits[0].status).toBe("estável");
      expect(audits[0].sugestao).toBe("");
      expect(audits[1].status).toBe("frágil — requer atenção manual");
      expect(audits[1].sugestao).toBe("Renomear o locator para eliminar a colisão.");
    });

    it("não considera duplicado o campo sem locatorName", () => {
      const audits = getMappingAudit([field({ locatorName: "" }), field({ locatorName: "" })]);
      expect(audits.map((item) => item.status)).toEqual(["estável", "estável"]);
      expect(audits.map((item) => item.locator)).toEqual(["", ""]);
    });
  });

  describe("auditJson", () => {
    it("ignora campos sem selector ou sem locatorName", () => {
      expect(auditJson([
        field({ locatorName: "a", selector: "#a" }),
        field({ locatorName: "sem-seletor", selector: "" }),
        field({ locatorName: "", selector: "#sem-locator" }),
      ])).toBe(JSON.stringify({ a: "#a" }, null, 2));
    });

    it("mantém o último seletor quando o locator se repete", () => {
      expect(auditJson([
        field({ locatorName: "a", selector: "#a" }),
        field({ locatorName: "a", selector: "#a2" }),
      ])).toBe(JSON.stringify({ a: "#a2" }, null, 2));
    });

    it("produz JSON indentado com 2 espaços", () => {
      expect(auditJson([field({ locatorName: "a", selector: "#a" })])).toBe('{\n  "a": "#a"\n}');
    });
  });
});
