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
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    // Support multiple column name formats
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

    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .eq("vehicle_code", vehicle_code)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("vehicles").update(payload).eq("id", existing.id);
      if (error) {
        result.errors.push({ row: i + 2, message: error.message });
      } else {
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from("vehicles").insert(payload);
      if (error) {
        result.errors.push({ row: i + 2, message: error.message });
      } else {
        result.inserted += 1;
      }
    }
  }

  return NextResponse.json(result);
}
