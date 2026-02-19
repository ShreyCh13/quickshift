import * as XLSX from "xlsx";

export type ExportFormat = "xlsx" | "csv";

// ============================================================================
// Column width helpers
// ============================================================================

/** Compute auto column widths by scanning header names and cell values. */
function autoColWidths(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    let max = header.length;
    for (const row of rows) {
      const val = row[header];
      const len = val !== null && val !== undefined ? String(val).length : 0;
      if (len > max) max = len;
    }
    // Cap at 60 characters, min 8
    return { wch: Math.min(60, Math.max(8, max + 2)) };
  });
}

/** Apply frozen top row and auto column widths to a worksheet. */
function applySheetFormatting(ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  // Freeze first row (header)
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  // Auto column widths
  ws["!cols"] = autoColWidths(rows);
}

// ============================================================================
// Public API
// ============================================================================

/** Build a workbook for the Vehicles export. */
export function buildVehiclesWorkbook(rows: Record<string, unknown>[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetFormatting(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
  return wb;
}

/** Build a workbook for the Inspections export. */
export function buildInspectionWorkbook(rows: Record<string, unknown>[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetFormatting(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, "Inspections");
  return wb;
}

/** Build a workbook for the Maintenance export. */
export function buildMaintenanceWorkbook(rows: Record<string, unknown>[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetFormatting(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, "Maintenance");
  return wb;
}

/** Generic single-sheet workbook (legacy / fallback). */
export function rowsToWorkbook(sheetName: string, rows: Record<string, unknown>[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetFormatting(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(ws);
}

export function parseFirstSheet(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
}

export function parseCsv(text: string): Record<string, unknown>[] {
  const wb = XLSX.read(text, { type: "string" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
}
