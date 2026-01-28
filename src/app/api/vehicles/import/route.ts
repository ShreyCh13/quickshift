import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { parseCsv, parseFirstSheet } from "@/lib/excel";
import type { VehiclesImportResult } from "@/lib/types";
import { checkRateLimit, getClientIp, rateLimitPresets, rateLimitHeaders } from "@/lib/rate-limit";
import { invalidateCache, cacheKeys } from "@/lib/cache";

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  // Rate limit imports (heavy operation)
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(
    `import:${ip}`,
    rateLimitPresets.import.limit,
    rateLimitPresets.import.windowMs
  );
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many import requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
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
  
  // Helper to get value from row with various column name formats (handles trailing spaces)
  function getRowValue(row: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      // Check exact match
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return String(row[key]).trim();
      }
      // Check with trailing space
      if (row[key + " "] !== undefined && row[key + " "] !== null && row[key + " "] !== "") {
        return String(row[key + " "]).trim();
      }
      // Check trimmed keys in row
      for (const rowKey of Object.keys(row)) {
        if (rowKey.trim().toLowerCase() === key.toLowerCase()) {
          const val = row[rowKey];
          if (val !== undefined && val !== null && val !== "") {
            return String(val).trim();
          }
        }
      }
    }
    return null;
  }

  // Helper to parse "Type of Vehicles" which contains "BRAND MODEL" combined
  function parseBrandModel(typeOfVehicle: string | null): { brand: string | null; model: string | null } {
    if (!typeOfVehicle) return { brand: null, model: null };
    
    // Known brand prefixes to extract
    const knownBrands = [
      "TOYOTA", "SUZUKI", "KIA", "MERCEDES", "JAGUAR", "LANDROVER", "LAND ROVER",
      "RANGE ROVER", "FORCE", "BMW", "AUDI", "HONDA", "HYUNDAI", "MAHINDRA",
      "TATA", "FORD", "VOLKSWAGEN", "SKODA", "MG", "NISSAN", "RENAULT"
    ];
    
    const upper = typeOfVehicle.toUpperCase();
    
    // Try to find a known brand
    for (const brand of knownBrands) {
      if (upper.startsWith(brand + " ")) {
        return {
          brand: brand,
          model: typeOfVehicle.substring(brand.length).trim() || null
        };
      }
    }
    
    // Special cases
    if (upper.includes("SEATER")) {
      // "19 SEATER TEMPO TRAVELLER" -> brand: null, model: full string
      return { brand: null, model: typeOfVehicle };
    }
    
    // If no brand found, use first word as brand if there are multiple words
    const parts = typeOfVehicle.split(/\s+/);
    if (parts.length > 1) {
      return {
        brand: parts[0],
        model: parts.slice(1).join(" ")
      };
    }
    
    return { brand: null, model: typeOfVehicle };
  }
  
  // Parse all rows first
  const parsedRows: Array<{ rowNum: number; payload: any; vehicle_code: string }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    
    // Get vehicle code from various possible column names
    const vehicle_code = getRowValue(row, "vehicle_code", "VehicleCode", "Vehicle Number", "code");
    
    if (!vehicle_code) {
      result.skipped += 1;
      result.errors.push({ row: i + 2, message: "Missing vehicle_code" });
      continue;
    }
    
    // Get brand and model - check for separate columns first, then combined "Type of Vehicles"
    let brand = getRowValue(row, "brand", "Brand");
    let model = getRowValue(row, "model", "Model");
    
    // If no separate brand/model, try to parse from "Type of Vehicles"
    if (!brand && !model) {
      const typeOfVehicle = getRowValue(row, "Type of Vehicles", "TypeOfVehicles", "Vehicle Type");
      const parsed = parseBrandModel(typeOfVehicle);
      brand = parsed.brand;
      model = parsed.model;
    }
    
    const year = getRowValue(row, "year", "Year");
    const notes = getRowValue(row, "notes", "Notes");
    
    const payload = {
      vehicle_code,
      brand: brand || null,
      model: model || null,
      year: year ? Number(year) : null,
      notes: notes || null,
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

  // Batch update using parallel chunks for better performance
  // Process in chunks of 10 to avoid overwhelming the database
  const CHUNK_SIZE = 10;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(({ id, payload }) => 
        supabase.from("vehicles").update(payload).eq("id", id)
      )
    );
    
    results.forEach((res, idx) => {
      const item = chunk[idx];
      if (res.status === 'rejected' || (res.status === 'fulfilled' && res.value.error)) {
        const errorMsg = res.status === 'rejected' 
          ? String(res.reason) 
          : res.value.error?.message || 'Unknown error';
        result.errors.push({ row: item.rowNum, message: errorMsg });
      } else {
        result.updated += 1;
      }
    });
  }

  // Invalidate vehicle cache after import
  if (result.inserted > 0 || result.updated > 0) {
    invalidateCache('vehicles:');
  }

  return NextResponse.json(result, { headers: rateLimitHeaders(rateLimit) });
}
