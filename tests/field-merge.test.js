import { describe, expect, it } from "vitest";
import { mergeScannedFields } from "../src/scripts/domain/field-merge.js";

function scannedField(overrides = {}) {
  return {
    key: "k",
    selector: "#scanned",
    label: "Escaneado",
    inferredType: "text",
    ...overrides,
  };
}

describe("field-merge", () => {
  describe("mergeScannedFields", () => {
    it("campo novo sem mapeamento usa inferredType e os padrões", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField({ inferredType: "email" })],
        saved: [],
        previous: [],
      });

      expect(merged).toEqual({
        key: "k",
        selector: "#scanned",
        label: "Escaneado",
        inferredType: "email",
        dataType: "email",
        fixed: false,
        fixedValue: "",
      });
    });

    it("usa text quando o campo não tem inferredType", () => {
      const [merged] = mergeScannedFields({
        scanned: [{ key: "k", selector: "#scanned", label: "Sem tipo" }],
        saved: [],
        previous: [],
      });

      expect(merged.dataType).toBe("text");
    });

    it("mapeamento salvo sobrescreve tipo, rótulo e seletor", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField()],
        saved: [{ key: "k", dataType: "cpf", selector: "#salvo", label: "Salvo", fixed: true, fixedValue: "123" }],
        previous: [],
      });

      expect(merged.selector).toBe("#salvo");
      expect(merged.dataType).toBe("cpf");
      expect(merged.label).toBe("Salvo");
      expect(merged.fixed).toBe(true);
      expect(merged.fixedValue).toBe("123");
    });

    it("encontra o mapeamento pelo seletor quando a key é diferente", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField({ key: "nova" })],
        saved: [
          { key: "outra", selector: "#outra", dataType: "email" },
          { key: "antiga", selector: "#scanned", dataType: "phone" },
        ],
        previous: [],
      });

      expect(merged.dataType).toBe("phone");
    });

    it("mapeamento sem propriedades usa os dados escaneados", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField()],
        saved: [{ key: "k" }],
        previous: [],
      });

      expect(merged).toMatchObject({
        dataType: "text",
        selector: "#scanned",
        label: "Escaneado",
        fixed: false,
        fixedValue: "",
      });
    });

    it("previous tem prioridade sobre saved", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField()],
        saved: [{ key: "k", dataType: "cpf", selector: "#saved", label: "Saved" }],
        previous: [{ key: "k", dataType: "email", selector: "#prev", label: "Prev" }],
      });

      expect(merged).toMatchObject({ dataType: "email", selector: "#prev", label: "Prev" });
    });

    it("remapping mantém o seletor escaneado", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField()],
        saved: [{ key: "k", selector: "#salvo", dataType: "cpf" }],
        previous: [],
        remapping: true,
      });

      expect(merged.selector).toBe("#scanned");
      expect(merged.dataType).toBe("cpf");
    });

    it("preserveCurrent mantém campos fora do scan sem duplicar os presentes", () => {
      const previous = [
        scannedField(),
        scannedField({ key: "antigo", selector: "#antigo", label: "Antigo" }),
      ];

      const merged = mergeScannedFields({
        scanned: [scannedField()],
        saved: [],
        previous,
        preserveCurrent: true,
      });

      expect(merged).toHaveLength(2);
      expect(merged.map((field) => field.key)).toEqual(["k", "antigo"]);
      expect(merged[1]).toEqual(previous[1]);
    });

    it("mantém fixedValue 0 e converte fixed para booleano", () => {
      const [merged] = mergeScannedFields({
        scanned: [scannedField()],
        saved: [{ key: "k", fixed: 1, fixedValue: 0 }],
        previous: [],
      });

      expect(merged.fixed).toBe(true);
      expect(merged.fixedValue).toBe(0);
    });
  });
});
