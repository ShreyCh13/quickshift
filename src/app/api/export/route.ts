import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { inspectionsFilterSchema, maintenanceFilterSchema } from "@/lib/validation";
import { rowsToCsv, rowsToWorkbook, workbookToBuffer } from "@/lib/excel";

type ExportType = "vehicles" | "inspections" | "maintenance";
type ExportFormat = "xlsx" | "csv";

function parseFilters(raw: string | null) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isEmptyFilters(filters: unknown) {
  if (!filters || typeof filters !== "object") return true;
  return Object.keys(filters as Record<string, unknown>).length === 0;
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ExportType | null;
  const format = (url.searchParams.get("format") || "xlsx") as ExportFormat;
  const filtersRaw = url.searchParams.get("filters");
  const filters = parseFilters(filtersRaw);

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
  let rows: Record<string, unknown>[] = [];

  if (type === "vehicles") {
    let query = supabase.from("vehicles").select("*");
    if (filters?.search) {
      const term = `%${String(filters.search)}%`;
      query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term}`);
    }
    if (filters?.is_active === true) query = query.eq("is_active", true);
    if (filters?.is_active === false) query = query.eq("is_active", false);
    const { data, error } = await query.order("vehicle_code", { ascending: true });
    if (error) return NextResponse.json({ error: "Failed to export vehicles" }, { status: 500 });
    rows = data || [];
  }

  if (type === "inspections") {
    const parsed = filters ? inspectionsFilterSchema.safeParse(filters) : null;
    const f = parsed?.success ? parsed.data : {};
    let query = supabase.from("inspections").select("*");
    if (f.vehicle_id) query = query.eq("vehicle_id", f.vehicle_id);
    if (f.date_from) query = query.gte("created_at", f.date_from);
    if (f.date_to) query = query.lte("created_at", f.date_to);
    if (f.odometer_min !== undefined) query = query.gte("odometer_km", f.odometer_min);
    if (f.odometer_max !== undefined) query = query.lte("odometer_km", f.odometer_max);
    if (f.remarks) {
      Object.entries(f.remarks).forEach(([key, value]) => {
        query = query.ilike(`remarks_json->>${key}`, `%${value}%`);
      });
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Failed to export inspections" }, { status: 500 });
    rows = data || [];
  }

  if (type === "maintenance") {
    const parsed = filters ? maintenanceFilterSchema.safeParse(filters) : null;
    const f = parsed?.success ? parsed.data : {};
    let query = supabase.from("maintenance").select("*");
    if (f.vehicle_id) query = query.eq("vehicle_id", f.vehicle_id);
    if (f.date_from) query = query.gte("created_at", f.date_from);
    if (f.date_to) query = query.lte("created_at", f.date_to);
    if (f.odometer_min !== undefined) query = query.gte("odometer_km", f.odometer_min);
    if (f.odometer_max !== undefined) query = query.lte("odometer_km", f.odometer_max);
    if (f.supplier) query = query.ilike("supplier_name", `%${f.supplier}%`);
    if (f.amount_min !== undefined) query = query.gte("amount", f.amount_min);
    if (f.amount_max !== undefined) query = query.lte("amount", f.amount_max);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Failed to export maintenance" }, { status: 500 });
    rows = data || [];
  }

  if (format === "csv") {
    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}.csv"`,
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
      "Content-Disposition": `attachment; filename="${type}.xlsx"`,
    },
  });
}
