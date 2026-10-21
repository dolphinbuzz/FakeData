import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACTIONS } from "../src/scripts/messages.js";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp } from "./helpers/app-loader.js";
import { getLastSentMessage } from "./helpers/interaction.js";

let dom;
let chromeMock;
let appUtils;

beforeEach(async () => {
  dom = createPopupDOM();
  chromeMock = createChromeMock({ scanFields: scannedFields });
  appUtils = await loadApp(chromeMock);
});

afterEach(() => {
  appUtils.cleanup();
});

describe("popup app - preenchimento sob demanda do controle flutuante", () => {
  it("preenche campo sob demanda pelo controle flutuante e reporta falhas", () => {
    appUtils.clearSentMessages();
    const listener = appUtils.getAppMessageListener();
    let response = null;
    const request = { action: ACTIONS.PAGE_FIELD_FILL_REQUEST, key: "#email::0", selector: "#email" };

    listener(request, { tab: { id: 10 } }, (value) => { response = value; });

    expect(response).toEqual({ filled: true });
    const fillMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD);
    expect(fillMessage).toBeTruthy();
    expect(fillMessage.selector).toBe("#email");
    expect(typeof fillMessage.value).toBe("string");
    expect(fillMessage.value.length).toBeGreaterThan(0);
    expect(document.querySelector(".page-field-fixed-value").value).toBe(fillMessage.value);

    listener(
      { action: ACTIONS.PAGE_FIELD_FILL_REQUEST, key: "#ausente", selector: "#ausente" },
      { tab: { id: 10 } },
      (value) => { response = value; }
    );
    expect(response).toEqual({ filled: false });

    listener(request, {}, (value) => { response = value; });
    expect(response).toEqual({ filled: false });

    chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.action === ACTIONS.FILL_FIELD) {
        chromeMock.runtime.lastError = { message: "Receiver unavailable" };
        callback();
        chromeMock.runtime.lastError = null;
        return;
      }
      callback({});
    });
    listener(request, { tab: { id: 10 } }, (value) => { response = value; });
    expect(response).toEqual({ filled: false });
  });

  it("usa o valor fixo na solicitação do controle flutuante", async () => {
    appUtils.cleanup();
    chromeMock = createChromeMock({
      scanFields: scannedFields,
      profiles: [{
        id: "profile-1",
        name: "Cadastro salvo",
        pageUrl: "https://sistema.example.test/cadastro",
        fields: [{ ...scannedFields[0], dataType: "email", fixed: true, fixedValue: "fixo@example.test" }],
      }],
    });
    dom = createPopupDOM();
    appUtils = await loadApp(chromeMock);

    appUtils.clearSentMessages();
    const listener = appUtils.getAppMessageListener();
    let response = null;

    listener(
      { action: ACTIONS.PAGE_FIELD_FILL_REQUEST, key: "#email::0", selector: "#email" },
      { tab: { id: 10 } },
      (value) => { response = value; }
    );

    expect(response).toEqual({ filled: true });
    const fillMessage = getLastSentMessage(chromeMock, ACTIONS.FILL_FIELD);
    expect(fillMessage.value).toBe("fixo@example.test");
  });
});
