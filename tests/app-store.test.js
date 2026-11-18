import { beforeEach, describe, expect, it } from "vitest";
import { resetState, state } from "../src/scripts/state/app-store.js";

describe("app-store", () => {
  beforeEach(() => {
    resetState();
  });

  it("resets every shared field in place and replaces selector state", () => {
    const originalMarkedSelectors = state.markedSelectors;
    Object.assign(state, {
      selectedType: "vehicle",
      currentResult: { Marca: "Ford" },
      activeTab: { id: 8 },
      activePageUrl: "https://example.test/form",
      activeBaseUrl: "https://example.test",
      selectedTabId: 8,
      savedProfiles: [{ id: "profile-1" }],
      selectedProfileId: "profile-1",
      mappingModalResolver: () => {},
      mappingModalConfirmHandler: () => {},
      pageFields: [{ selector: "#email" }],
      vehicleCatalog: [{ marca: "Ford", modelos: ["Ka"] }],
      floatingControlsVisible: false,
      selectorPlaygroundMarked: true,
      selectorPlaygroundMarkedSelector: "#email"
    });
    originalMarkedSelectors.add("#email");

    const reset = resetState();

    expect(reset).toBe(state);
    expect(state).toMatchObject({
      selectedType: "person",
      currentResult: null,
      activeTab: null,
      activePageUrl: "",
      activeBaseUrl: "",
      selectedTabId: null,
      savedProfiles: [],
      selectedProfileId: "",
      mappingModalResolver: null,
      mappingModalConfirmHandler: null,
      pageFields: [],
      vehicleCatalog: [],
      floatingControlsVisible: true,
      selectorPlaygroundMarked: false,
      selectorPlaygroundMarkedSelector: ""
    });
    expect(state.markedSelectors).toEqual(new Set());
    expect(state.markedSelectors).not.toBe(originalMarkedSelectors);
  });
});
