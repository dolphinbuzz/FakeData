import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeMock } from "./fixtures/chrome-mock.js";
import {
  migrateLegacyProfiles,
  readProfiles,
  writeProfiles,
} from "../src/scripts/services/profiles-repository.js";

const STORAGE_KEY = "fakedata-field-mappings";

let chromeMock;

beforeEach(() => {
  chromeMock = createChromeMock();
  global.chrome = chromeMock;
});

function setStored(value) {
  chromeMock.__testUtils.setStorageData({ [STORAGE_KEY]: value });
}

function stored() {
  return chromeMock.__testUtils.getStorageData()[STORAGE_KEY];
}

describe("profiles-repository", () => {
  describe("migrateLegacyProfiles", () => {
    it("não grava nada quando não há dados legados", () => {
      setStored({ "https://a.com": { pages: [] } });
      const callback = vi.fn();

      migrateLegacyProfiles(callback);

      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("migra o mapeamento legado para o formato por aplicação", () => {
      const fields = [{ key: "#email::0", selector: "#email", dataType: "email" }];
      setStored({ "https://a.com/p": fields });
      const callback = vi.fn();

      migrateLegacyProfiles(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(stored()).toEqual({
        "https://a.com": {
          pages: [{
            id: "https://a.com/p::legacy",
            name: "Mapeamento salvo",
            pageUrl: "https://a.com/p",
            fields,
          }],
        },
      });
      expect(stored()["https://a.com/p"]).toBeUndefined();
    });

    it("não duplica o perfil legado na segunda execução", () => {
      setStored({ "https://a.com/p": [{ key: "#email::0" }] });

      migrateLegacyProfiles(vi.fn());
      migrateLegacyProfiles(vi.fn());

      expect(stored()["https://a.com"].pages).toHaveLength(1);
    });

    it("reaproveita a aplicação existente e acrescenta o perfil legado", () => {
      setStored({
        "https://a.com": {
          pages: [{ id: "p1", name: "Existente", pageUrl: "https://a.com/x", fields: [] }],
        },
        "https://a.com/p": [{ key: "#x" }],
      });

      migrateLegacyProfiles(vi.fn());

      expect(stored()["https://a.com"].pages.map((profile) => profile.id))
        .toEqual(["p1", "https://a.com/p::legacy"]);
    });

    it("normaliza pages inválida ao migrar", () => {
      setStored({ "https://a.com": { pages: "invalido" }, "https://a.com/p": [] });

      migrateLegacyProfiles(vi.fn());

      expect(Array.isArray(stored()["https://a.com"].pages)).toBe(true);
      expect(stored()["https://a.com"].pages).toHaveLength(1);
    });

    it("usa a própria chave quando a URL legada não é válida", () => {
      setStored({ "nao-e-url": [{ key: "#x" }] });

      migrateLegacyProfiles(vi.fn());

      expect(stored()["nao-e-url"]).toEqual({
        pages: [{
          id: "nao-e-url::legacy",
          name: "Mapeamento salvo",
          pageUrl: "nao-e-url",
          fields: [{ key: "#x" }],
        }],
      });
    });

    it("substitui a base que ainda está no formato legado", () => {
      setStored({ "https://a.com": [{ key: "#antigo" }] });

      migrateLegacyProfiles(vi.fn());

      expect(stored()["https://a.com"]).toEqual({
        pages: [{
          id: "https://a.com::legacy",
          name: "Mapeamento salvo",
          pageUrl: "https://a.com",
          fields: [{ key: "#antigo" }],
        }],
      });
    });
  });

  describe("readProfiles", () => {
    it("devolve [] quando a base não existe", () => {
      const callback = vi.fn();

      readProfiles("https://inexistente.test", callback);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it("devolve as páginas da base", () => {
      const pages = [{ id: "p1" }, { id: "p2" }];
      setStored({ "https://a.com": { pages } });
      const callback = vi.fn();

      readProfiles("https://a.com", callback);

      expect(callback).toHaveBeenCalledWith(pages);
    });

    it("devolve [] quando pages não é array", () => {
      setStored({ "https://a.com": { pages: null } });
      const callback = vi.fn();

      readProfiles("https://a.com", callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe("storage sem a chave de mapeamentos", () => {
    beforeEach(() => {
      chromeMock.storage.local.get.mockImplementation((defaults, callback) => callback({}));
    });

    it("migra sem gravar, lê vazio e grava no write", () => {
      const migrateCallback = vi.fn();
      migrateLegacyProfiles(migrateCallback);

      expect(migrateCallback).toHaveBeenCalledTimes(1);
      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();

      const readCallback = vi.fn();
      readProfiles("https://a.com", readCallback);

      expect(readCallback).toHaveBeenCalledWith([]);

      const writeCallback = vi.fn();
      writeProfiles("https://a.com", [], writeCallback);

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: { "https://a.com": { pages: [] } },
      }, writeCallback);
    });
  });

  describe("writeProfiles", () => {
    it("grava as páginas preservando as demais bases", () => {
      setStored({ "https://outra.com": { pages: [{ id: "x" }] } });
      const callback = vi.fn();

      writeProfiles("https://a.com", [{ id: "novo" }], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(stored()).toEqual({
        "https://outra.com": { pages: [{ id: "x" }] },
        "https://a.com": { pages: [{ id: "novo" }] },
      });
    });

    it("sobrescreve as páginas da base existente", () => {
      setStored({ "https://a.com": { pages: [{ id: "antigo" }] } });

      writeProfiles("https://a.com", [{ id: "novo" }], vi.fn());

      expect(stored()["https://a.com"].pages).toEqual([{ id: "novo" }]);
    });
  });
});
