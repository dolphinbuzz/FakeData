import { describe, expect, it } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";

describe("contrato de mensagens", () => {
  it("expõe ações únicas e imutáveis para os fluxos da extensão", () => {
    const expected = [
      "PAGE_CONTENT_CHANGED",
      "SCAN_FIELDS",
      "FILL_FIELD",
      "FILL_ALL",
      "HIGHLIGHT_FIELD",
      "MARK_FIELD",
      "UNMARK_FIELD",
      "MARK_ALL_FIELDS",
      "UNMARK_ALL_FIELDS",
      "COUNT_SELECTOR_MATCHES",
      "MARK_SELECTOR_MATCHES",
      "UNMARK_SELECTOR_MATCHES",
      "CAPTURE_NEXT_CLICK",
      "UPDATE_PAGE_FIELD_CONTROLS",
      "SET_PAGE_FIELD_CONTROLS_VISIBILITY",
      "PAGE_FIELD_FILL_REQUEST"
    ];

    expect(Object.keys(ACTIONS)).toEqual(expected);
    expect(new Set(Object.values(ACTIONS)).size).toBe(expected.length);
    expect(() => { ACTIONS.SCAN_FIELDS = "changed"; }).toThrow(TypeError);
  });
});
