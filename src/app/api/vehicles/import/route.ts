import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { parseCsv, parseFirstSheet } from "@/lib/excel";
import type { VehiclesImportResult } from "@/lib/types";

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const filename = file.name.toLowerCase();
  let rows: Record<string, unknown>[] = [];
  if (filename.endsWith(".csv")) {
    const text = await file.text();
    rows = parseCsv(text);
  } else {
    const buffer = await file.arrayBuffer();
    rows = parseFirstSheet(buffer);
  }
  const result: VehiclesImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  const supabase = getSupabaseAdmin();
  
  // Parse all rows first
  const parsedRows: Array<{ rowNum: number; payload: any; vehicle_code: string }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const vehicle_code = String(
      row.vehicle_code || row.VehicleCode || row["Vehicle Number"] || row.code || ""
    ).trim();
    if (!vehicle_code) {
      result.skipped += 1;
      result.errors.push({ row: i + 2, message: "Missing vehicle_code" });
      continue;
    }
    const payload = {
      vehicle_code,
      brand: row.brand || row.Brand ? String(row.brand || row.Brand) : null,
      model: row.model || row.Model || row["Type of Vehicles"] ? 
        String(row.model || row.Model || row["Type of Vehicles"]) : null,
      year: row.year || row.Year ? Number(row.year || row.Year) : null,
      notes: row.notes || row.Notes ? String(row.notes || row.Notes) : null,
      is_active: true,
    };
    parsedRows.push({ rowNum: i + 2, payload, vehicle_code });
  }

  // Get all existing vehicles in one query
  const vehicleCodes = parsedRows.map(r => r.vehicle_code);
  const { data: existingVehicles } = await supabase
    .from("vehicles")
    .select("id, vehicle_code")
    .in("vehicle_code", vehicleCodes);

  const existingMap = new Map((existingVehicles || []).map(v => [v.vehicle_code, v.id]));

  // Separate into inserts and updates
  const toInsert: any[] = [];
  const toUpdate: Array<{ id: string; payload: any; rowNum: number }> = [];

  for (const { rowNum, payload, vehicle_code } of parsedRows) {
    const existingId = existingMap.get(vehicle_code);
    if (existingId) {
      toUpdate.push({ id: existingId, payload, rowNum });
    } else {
      toInsert.push({ ...payload, _rowNum: rowNum });
    }
  }

  // Batch insert
  if (toInsert.length > 0) {
    const insertPayloads = toInsert.map(({ _rowNum, ...rest }) => rest);
    const { error } = await supabase.from("vehicles").insert(insertPayloads);
    if (error) {
      console.error("Batch insert error:", error);
      toInsert.forEach(item => {
        result.errors.push({ row: item._rowNum, message: error.message });
      });
    } else {
      result.inserted = toInsert.length;
    }
  }

  // Batch update (Supabase doesn't support batch update, so we do it in chunks)
  for (const { id, payload, rowNum } of toUpdate) {
    const { error } = await supabase.from("vehicles").update(payload).eq("id", id);
    if (error) {
      result.errors.push({ row: rowNum, message: error.message });
    } else {
      result.updated += 1;
    }
  }

  return NextResponse.json(result);
}
