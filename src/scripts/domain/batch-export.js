const MAX_BATCH_SIZE = 100;

export function parseBatchSize(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new RangeError("Informe uma quantidade inteira entre 1 e 100.");
  }
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_BATCH_SIZE) {
    throw new RangeError("Informe uma quantidade inteira entre 1 e 100.");
  }
  return count;
}

function assertRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new TypeError("Não há registros para exportar.");
  }
}

function quoteCsvCell(value) {
  const text = String(value);
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeRecordsAsJson(records) {
  assertRecords(records);
  return JSON.stringify(records, null, 2);
}

export function serializeRecordsAsCsv(records) {
  assertRecords(records);
  const headers = Object.keys(records[0]);
  const rows = records.map((record) => headers.map((header) => {
    const value = record[header] == null ? "" : String(record[header]);
    return value;
  }));
  return `\uFEFF${[headers, ...rows].map((row) => row.map(quoteCsvCell).join(",")).join("\r\n")}`;
}
