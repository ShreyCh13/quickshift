import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { rowsToCsv, rowsToWorkbook, workbookToBuffer } from "@/lib/excel";
import { checkRateLimit, getClientIp, createRateLimitKey, rateLimitPresets, rateLimitHeaders } from "@/lib/rate-limit";
import { parseFilters, getVehicleIdsByFilter, applyDateFilters } from "@/lib/query-helpers";

type ExportType = "vehicles" | "inspections" | "maintenance";
type ExportFormat = "xlsx" | "csv";

// ============================================================================
// Helper Functions
// ============================================================================

function isEmptyFilters(filters: unknown) {
  if (!filters || typeof filters !== "object") return true;
  return Object.keys(filters as Record<string, unknown>).length === 0;
}

function formatRemarks(remarksJson: unknown): string {
  if (!remarksJson || typeof remarksJson !== "object") return "";
  return Object.entries(remarksJson as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function generateFileName(type: ExportType, filters: Record<string, unknown> | null): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const parts: string[] = [type];
  
  if (filters) {
    if (filters.vehicle_query) {
      parts.push(`search-${String(filters.vehicle_query).replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.vehicle_id) {
      parts.push(`vehicle-${String(filters.vehicle_id).substring(0, 8)}`);
    }
    if (filters.brand) {
      parts.push(`brand-${String(filters.brand).replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.supplier) {
      parts.push(`supplier-${String(filters.supplier).replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? new Date(String(filters.date_from)).toISOString().split('T')[0] : '';
      const to = filters.date_to ? new Date(String(filters.date_to)).toISOString().split('T')[0] : '';
      if (from && to) {
        parts.push(`${from}_to_${to}`);
      } else if (from) {
        parts.push(`from-${from}`);
      } else if (to) {
        parts.push(`until-${to}`);
      }
    }
  }
  
  parts.push(timestamp);
  return parts.join('_');
}

// ============================================================================
// Export Handlers
// ============================================================================

async function exportVehicles(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<Record<string, unknown>[]> {
  let query = supabase.from("vehicles").select("vehicle_code, plate_number, brand, model, year, notes, is_active, created_at");
  
  if (filters?.search) {
    const term = `%${String(filters.search)}%`;
    query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
  }
  if (filters?.is_active === true) query = query.eq("is_active", true);
  if (filters?.is_active === false) query = query.eq("is_active", false);
  
  const { data, error } = await query.order("vehicle_code", { ascending: true }).limit(limit);
  
  if (error) {
    console.error("Failed to export vehicles:", error);
    throw new Error("Failed to export vehicles");
  }
  
  return (data || []).map((item) => ({
    "Vehicle Code": item.vehicle_code || "",
    "Plate Number": item.plate_number || "",
    "Brand": item.brand || "",
    "Model": item.model || "",
    "Year": item.year || "",
    "Notes": item.notes || "",
    "Status": item.is_active ? "Active" : "Inactive",
    "Added On": item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "",
  }));
}

async function exportInspections(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<Record<string, unknown>[]> {
  // Get vehicle IDs using shared helper
  const vehicleResult = await getVehicleIdsByFilter(supabase, {
    vehicle_id: filters?.vehicle_id as string | undefined,
    vehicle_query: filters?.vehicle_query as string | undefined,
    brand: filters?.brand as string | undefined,
  });
  
  if (vehicleResult.noMatch) {
    return [];
  }
  
  let query = supabase
    .from("inspections")
    .select("vehicle_id, created_at, odometer_km, driver_name, remarks_json, vehicles(vehicle_code, plate_number, brand, model)")
    .eq("is_deleted", false);
  
  // Apply vehicle filter
  if (vehicleResult.ids.length === 1) {
    query = query.eq("vehicle_id", vehicleResult.ids[0]);
  } else if (vehicleResult.ids.length > 1) {
    query = query.in("vehicle_id", vehicleResult.ids);
  }
  
  // Apply date filters
  query = applyDateFilters(query, {
    date_from: filters?.date_from as string | undefined,
    date_to: filters?.date_to as string | undefined,
  });
  
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  
  if (error) {
    console.error("Failed to export inspections:", error);
    throw new Error("Failed to export inspections");
  }
  
  return (data || []).map((item: Record<string, unknown>) => {
    const vehicles = item.vehicles as Record<string, unknown> | null;
    return {
      "Date & Time": item.created_at ? new Date(item.created_at as string).toLocaleString("en-IN") : "",
      "Vehicle Code": vehicles?.vehicle_code || "",
      "Plate Number": vehicles?.plate_number || "",
      "Vehicle Brand": vehicles?.brand || "",
      "Vehicle Model": vehicles?.model || "",
      "Odometer (km)": item.odometer_km || 0,
      "Driver Name": item.driver_name || "",
      "Remarks": formatRemarks(item.remarks_json),
    };
  });
}

async function exportMaintenance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<Record<string, unknown>[]> {
  // Get vehicle IDs using shared helper
  const vehicleResult = await getVehicleIdsByFilter(supabase, {
    vehicle_id: filters?.vehicle_id as string | undefined,
    vehicle_query: filters?.vehicle_query as string | undefined,
    brand: filters?.brand as string | undefined,
  });
  
  if (vehicleResult.noMatch) {
    return [];
  }
  
  let query = supabase
    .from("maintenance")
    .select("vehicle_id, created_at, odometer_km, bill_number, supplier_name, amount, remarks, vehicles(vehicle_code, plate_number, brand, model)")
    .eq("is_deleted", false);
  
  // Apply vehicle filter
  if (vehicleResult.ids.length === 1) {
    query = query.eq("vehicle_id", vehicleResult.ids[0]);
  } else if (vehicleResult.ids.length > 1) {
    query = query.in("vehicle_id", vehicleResult.ids);
  }
  
  // Apply date filters
  query = applyDateFilters(query, {
    date_from: filters?.date_from as string | undefined,
    date_to: filters?.date_to as string | undefined,
  });
  
  // Apply supplier filter
  if (filters?.supplier) {
    query = query.ilike("supplier_name", `%${filters.supplier}%`);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  
  if (error) {
    console.error("Failed to export maintenance:", error);
    throw new Error("Failed to export maintenance");
  }
  
  return (data || []).map((item: Record<string, unknown>) => {
    const vehicles = item.vehicles as Record<string, unknown> | null;
    return {
      "Date & Time": item.created_at ? new Date(item.created_at as string).toLocaleString("en-IN") : "",
      "Vehicle Code": vehicles?.vehicle_code || "",
      "Plate Number": vehicles?.plate_number || "",
      "Vehicle Brand": vehicles?.brand || "",
      "Vehicle Model": vehicles?.model || "",
      "Odometer (km)": item.odometer_km || 0,
      "Bill Number": item.bill_number || "",
      "Supplier Name": item.supplier_name || "",
      "Amount (₹)": item.amount || 0,
      "Remarks": item.remarks || "",
    };
  });
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit exports
  const clientIp = getClientIp(req);
  const rateLimitKey = createRateLimitKey(clientIp, "export", session.user.id);
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitPresets.export.limit, rateLimitPresets.export.windowMs);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many export requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ExportType | null;
  const format = (url.searchParams.get("format") || "xlsx") as ExportFormat;
  const filters = parseFilters<Record<string, unknown>>(url.searchParams.get("filters"));

  // Validate parameters
  if (!type || !["vehicles", "inspections", "maintenance"].includes(type)) {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }
  if (!["xlsx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
  }
  if (isEmptyFilters(filters) && !requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Admin required for full export" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const EXPORT_LIMIT = 10000;
  
  try {
    let rows: Record<string, unknown>[] = [];

    switch (type) {
      case "vehicles":
        rows = await exportVehicles(supabase, filters || {}, EXPORT_LIMIT);
        break;
      case "inspections":
        rows = await exportInspections(supabase, filters || {}, EXPORT_LIMIT);
        break;
      case "maintenance":
        rows = await exportMaintenance(supabase, filters || {}, EXPORT_LIMIT);
        break;
    }

    const baseFilename = generateFileName(type, filters);
    
    if (format === "csv") {
      const csv = rowsToCsv(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
        },
      });
    }

    const wb = rowsToWorkbook(type, rows);
    const buffer = workbookToBuffer(wb);
    const blob = new Blob([buffer], { 
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
    });
    
    return new Response(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
