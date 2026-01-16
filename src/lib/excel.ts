import * as XLSX from "xlsx";

export type ExportFormat = "xlsx" | "csv";

export function rowsToWorkbook(sheetName: string, rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(ws);
}

export function parseFirstSheet(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
}

export function parseCsv(text: string) {
  const wb = XLSX.read(text, { type: "string" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
}
