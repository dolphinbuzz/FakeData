import { describe, expect, it } from "vitest";
import { parseBatchSize, serializeRecordsAsCsv, serializeRecordsAsJson } from "../src/scripts/domain/batch-export.js";

describe("batch export", () => {
  it("accepts integer batch sizes from 1 through 100", () => {
    expect(parseBatchSize("1")).toBe(1);
    expect(parseBatchSize("100")).toBe(100);
  });

  it.each(["", "0", "101", "1.5", "1e2", "abc"])("rejects invalid batch size %s", (value) => {
    expect(() => parseBatchSize(value)).toThrow(RangeError);
  });

  it("serializes records as a JSON array", () => {
    const records = [{ Nome: "Ana" }, { Nome: "João" }];

    expect(JSON.parse(serializeRecordsAsJson(records))).toEqual(records);
  });

  it("serializes CSV with escaped quotes, CRLF rows and UTF-8 BOM", () => {
    const csv = serializeRecordsAsCsv([{ Nome: 'Ana "QA"', Cidade: "São Paulo" }]);

    expect(csv).toBe('\uFEFF"Nome","Cidade"\r\n"Ana ""QA""","São Paulo"');
  });

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    expect(serializeRecordsAsCsv([{ Nome: "=1+1" }])).toBe('\uFEFF"Nome"\r\n"\u0027=1+1"');
  });

  it("rejects empty exports", () => {
    expect(() => serializeRecordsAsJson([])).toThrow(TypeError);
    expect(() => serializeRecordsAsCsv([])).toThrow(TypeError);
  });
});
