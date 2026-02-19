import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { buildInspectionWorkbook, buildMaintenanceWorkbook, buildVehiclesWorkbook, workbookToBuffer, rowsToCsv } from "@/lib/excel";
import { checkRateLimit, getClientIp, createRateLimitKey, rateLimitPresets, rateLimitHeaders } from "@/lib/rate-limit";
import { parseFilters, getVehicleIdsByFilter, applyDateFilters } from "@/lib/query-helpers";
import { INSPECTION_CATEGORIES } from "@/lib/constants";

type ExportType = "vehicles" | "inspections" | "maintenance";
type ExportFormat = "xlsx" | "csv";

// ============================================================================
// Types
// ============================================================================

interface ChecklistEntry {
  ok: boolean;
  remarks: string;
}

interface InspectionRow {
  created_at: string;
  odometer_km: number;
  driver_name: string | null;
  remarks_json: Record<string, ChecklistEntry | string> | null;
  vehicles: { vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null } | null;
  users: { display_name: string } | null;
}

interface MaintenanceRow {
  created_at: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  supplier_invoice_number: string;
  amount: number;
  remarks: string;
  vehicles: { vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null } | null;
  users: { display_name: string } | null;
}

interface VehicleRow {
  vehicle_code: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function isEmptyFilters(filters: unknown) {
  if (!filters || typeof filters !== "object") return true;
  return Object.keys(filters as Record<string, unknown>).length === 0;
}

function generateFileName(type: ExportType, filters: Record<string, unknown> | null): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const parts: string[] = [type];
  if (filters) {
    if (filters.vehicle_query) parts.push(`search-${String(filters.vehicle_query).replace(/[^a-zA-Z0-9]/g, "_")}`);
    if (filters.brand) parts.push(`brand-${String(filters.brand).replace(/[^a-zA-Z0-9]/g, "_")}`);
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? String(filters.date_from).split("T")[0] : "";
      const to = filters.date_to ? String(filters.date_to).split("T")[0] : "";
      if (from && to) parts.push(`${from}_to_${to}`);
      else if (from) parts.push(`from-${from}`);
      else if (to) parts.push(`until-${to}`);
    }
  }
  parts.push(timestamp);
  return parts.join("_");
}

/** Format a single checklist cell value from remarks_json. */
function fmtChecklistCell(entry: ChecklistEntry | string | undefined): string {
  if (entry === undefined || entry === null) return "";
  // New format: { ok, remarks }
  if (typeof entry === "object" && "ok" in entry) {
    if (entry.ok) return "✓ OK";
    return entry.remarks?.trim() ? `✗  ${entry.remarks.trim()}` : "✗ Issue";
  }
  // Legacy format: plain string value (old remark_fields-style)
  if (typeof entry === "string") return entry;
  return "";
}

// ============================================================================
// Export Handlers
// ============================================================================

async function exportVehicles(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<VehicleRow[]> {
  let query = supabase
    .from("vehicles")
    .select("vehicle_code, plate_number, brand, model, year, notes, is_active, created_at");

  if (filters?.search) {
    const term = `%${String(filters.search)}%`;
    query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
  }
  if (filters?.is_active === true) query = query.eq("is_active", true);
  if (filters?.is_active === false) query = query.eq("is_active", false);

  const { data, error } = await query.order("vehicle_code", { ascending: true }).limit(limit);
  if (error) { console.error("Failed to export vehicles:", error); throw new Error("Failed to export vehicles"); }
  return (data || []) as VehicleRow[];
}

async function exportInspections(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<InspectionRow[]> {
  const vehicleResult = await getVehicleIdsByFilter(supabase, {
    vehicle_id: filters?.vehicle_id as string | undefined,
    vehicle_query: filters?.vehicle_query as string | undefined,
    brand: filters?.brand as string | undefined,
  });
  if (vehicleResult.noMatch) return [];

  let query = supabase
    .from("inspections")
    .select("created_at, odometer_km, driver_name, remarks_json, vehicles(vehicle_code, plate_number, brand, model), users!inspections_created_by_fkey(display_name)")
    .eq("is_deleted", false);

  if (vehicleResult.ids.length === 1) query = query.eq("vehicle_id", vehicleResult.ids[0]);
  else if (vehicleResult.ids.length > 1) query = query.in("vehicle_id", vehicleResult.ids);

  query = applyDateFilters(query, {
    date_from: filters?.date_from as string | undefined,
    date_to: filters?.date_to as string | undefined,
  });

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) { console.error("Failed to export inspections:", error); throw new Error("Failed to export inspections"); }
  return (data || []) as unknown as InspectionRow[];
}

async function exportMaintenance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filters: Record<string, unknown>,
  limit: number
): Promise<MaintenanceRow[]> {
  const vehicleResult = await getVehicleIdsByFilter(supabase, {
    vehicle_id: filters?.vehicle_id as string | undefined,
    vehicle_query: filters?.vehicle_query as string | undefined,
    brand: filters?.brand as string | undefined,
  });
  if (vehicleResult.noMatch) return [];

  let query = supabase
    .from("maintenance")
    .select("created_at, odometer_km, bill_number, supplier_name, supplier_invoice_number, amount, remarks, vehicles(vehicle_code, plate_number, brand, model), users!maintenance_created_by_fkey(display_name)")
    .eq("is_deleted", false);

  if (vehicleResult.ids.length === 1) query = query.eq("vehicle_id", vehicleResult.ids[0]);
  else if (vehicleResult.ids.length > 1) query = query.in("vehicle_id", vehicleResult.ids);

  query = applyDateFilters(query, {
    date_from: filters?.date_from as string | undefined,
    date_to: filters?.date_to as string | undefined,
  });

  if (filters?.supplier) query = query.ilike("supplier_name", `%${filters.supplier}%`);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) { console.error("Failed to export maintenance:", error); throw new Error("Failed to export maintenance"); }
  return (data || []) as unknown as MaintenanceRow[];
}

// ============================================================================
// Row Mappers (typed → flat Record for Excel/CSV)
// ============================================================================

/** All checklist fields in canonical order, used as column headers. */
const CHECKLIST_FIELDS = INSPECTION_CATEGORIES.flatMap((cat) =>
  cat.fields.map((f) => ({ key: f.key, label: `[${cat.label}] ${f.label}` }))
);

export function mapInspectionRows(rows: InspectionRow[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const v = row.vehicles;
    const u = row.users;
    const base: Record<string, unknown> = {
      "Date": row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
      "Time": row.created_at ? new Date(row.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "",
      "Vehicle Code": v?.vehicle_code ?? "",
      "Plate Number": v?.plate_number ?? "",
      "Brand": v?.brand ?? "",
      "Model": v?.model ?? "",
      "Odometer (km)": row.odometer_km ?? "",
      "Driver Name": row.driver_name ?? "",
      "Recorded By": u?.display_name ?? "",
    };

    // One column per checklist item
    const json = (row.remarks_json ?? {}) as Record<string, ChecklistEntry | string>;
    for (const field of CHECKLIST_FIELDS) {
      base[field.label] = fmtChecklistCell(json[field.key]);
    }

    return base;
  });
}

export function mapMaintenanceRows(rows: MaintenanceRow[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const v = row.vehicles;
    const u = row.users;
    return {
      "Date": row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
      "Time": row.created_at ? new Date(row.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "",
      "Vehicle Code": v?.vehicle_code ?? "",
      "Plate Number": v?.plate_number ?? "",
      "Brand": v?.brand ?? "",
      "Model": v?.model ?? "",
      "Odometer (km)": row.odometer_km ?? "",
      "Bill No.": row.bill_number ?? "",
      "Invoice No.": row.supplier_invoice_number ?? "",
      "Supplier": row.supplier_name ?? "",
      "Amount (₹)": row.amount ?? 0,
      "Remarks": row.remarks ?? "",
      "Recorded By": u?.display_name ?? "",
    };
  });
}

export function mapVehicleRows(rows: VehicleRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    "Vehicle Code": row.vehicle_code ?? "",
    "Plate Number": row.plate_number ?? "",
    "Brand": row.brand ?? "",
    "Model": row.model ?? "",
    "Year": row.year ?? "",
    "Status": row.is_active ? "Active" : "Inactive",
    "Notes": row.notes ?? "",
    "Added On": row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
  }));
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientIp = getClientIp(req);
  const rateLimitKey = createRateLimitKey(clientIp, "export", session.user.id);
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitPresets.export.limit, rateLimitPresets.export.windowMs);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: "Too many export requests. Please try again later." }, { status: 429, headers: rateLimitHeaders(rateLimitResult) });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ExportType | null;
  const format = (url.searchParams.get("format") || "xlsx") as ExportFormat;
  const filters = parseFilters<Record<string, unknown>>(url.searchParams.get("filters"));

  if (!type || !["vehicles", "inspections", "maintenance"].includes(type)) {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }
  if (!["xlsx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid export format" }, { status: 400 });
  }
  if (isEmptyFilters(filters) && !requireRole(session, ["admin", "dev"])) {
    return NextResponse.json({ error: "Admin required for full export" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const EXPORT_LIMIT = 10000;
  const baseFilename = generateFileName(type, filters);

  try {
    if (format === "csv") {
      let flatRows: Record<string, unknown>[] = [];
      if (type === "vehicles") flatRows = mapVehicleRows(await exportVehicles(supabase, filters || {}, EXPORT_LIMIT));
      else if (type === "inspections") flatRows = mapInspectionRows(await exportInspections(supabase, filters || {}, EXPORT_LIMIT));
      else if (type === "maintenance") flatRows = mapMaintenanceRows(await exportMaintenance(supabase, filters || {}, EXPORT_LIMIT));
      return new NextResponse(rowsToCsv(flatRows), {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${baseFilename}.csv"` },
      });
    }

    // Build typed workbooks with proper formatting
    let wb;
    if (type === "vehicles") {
      wb = buildVehiclesWorkbook(mapVehicleRows(await exportVehicles(supabase, filters || {}, EXPORT_LIMIT)));
    } else if (type === "inspections") {
      wb = buildInspectionWorkbook(mapInspectionRows(await exportInspections(supabase, filters || {}, EXPORT_LIMIT)));
    } else {
      wb = buildMaintenanceWorkbook(mapMaintenanceRows(await exportMaintenance(supabase, filters || {}, EXPORT_LIMIT)));
    }

    const buffer = workbookToBuffer(wb);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
