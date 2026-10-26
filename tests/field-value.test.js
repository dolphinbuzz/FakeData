import { describe, expect, it, vi } from "vitest";
import { resolveFieldType, resolveFieldValue } from "../src/scripts/domain/field-value.js";

describe("field-value", () => {
  describe("resolveFieldType", () => {
    it("usa inferredType quando dataType é auto", () => {
      expect(resolveFieldType({ dataType: "auto", inferredType: "cpf" })).toBe("cpf");
    });

    it("usa dataType nos demais casos", () => {
      expect(resolveFieldType({ dataType: "email", inferredType: "text" })).toBe("email");
    });
  });

  describe("resolveFieldValue", () => {
    it("devolve fixedValue sem chamar generate quando o campo é fixo", () => {
      const generate = vi.fn();

      const value = resolveFieldValue({
        fixed: true,
        fixedValue: "valor fixo",
        dataType: "cpf",
        inferredType: "cpf",
        inputType: "text",
      }, generate);

      expect(value).toBe("valor fixo");
      expect(generate).not.toHaveBeenCalled();
    });

    it("chama generate com o tipo resolvido e repassa o inputType", () => {
      const generate = vi.fn(() => "gerado");

      const value = resolveFieldValue({
        fixed: false,
        dataType: "auto",
        inferredType: "phone",
        inputType: "tel",
      }, generate);

      expect(value).toBe("gerado");
      expect(generate).toHaveBeenCalledWith("phone", "tel");
    });

    it("usa dataType quando não é auto", () => {
      const generate = vi.fn((type) => `valor-${type}`);

      const value = resolveFieldValue({
        fixed: false,
        dataType: "cnpj",
        inferredType: "text",
        inputType: "text",
      }, generate);

      expect(value).toBe("valor-cnpj");
    });
  });
});
