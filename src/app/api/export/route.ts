import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { inspectionsFilterSchema, maintenanceFilterSchema } from "@/lib/validation";
import { rowsToCsv, rowsToWorkbook, workbookToBuffer } from "@/lib/excel";
import { checkRateLimit, getClientIp, createRateLimitKey, rateLimitPresets, rateLimitHeaders } from "@/lib/rate-limit";

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

function generateFileName(type: ExportType, filters: any): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let parts = [type];
  
  // Add filter information to filename
  if (filters) {
    if (filters.vehicle_query) {
      parts.push(`search-${filters.vehicle_query.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.vehicle_id) {
      parts.push(`vehicle-${filters.vehicle_id.substring(0, 8)}`);
    }
    if (filters.brand) {
      parts.push(`brand-${filters.brand.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.supplier) {
      parts.push(`supplier-${filters.supplier.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? new Date(filters.date_from).toISOString().split('T')[0] : '';
      const to = filters.date_to ? new Date(filters.date_to).toISOString().split('T')[0] : '';
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

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit exports to prevent abuse (heavy operation)
  const clientIp = getClientIp(req);
  const rateLimitKey = createRateLimitKey(clientIp, "export", session.user.id);
  const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitPresets.export.limit, rateLimitPresets.export.windowMs);
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many export requests. Please try again later." },
      { 
        status: 429,
        headers: rateLimitHeaders(rateLimitResult)
      }
    );
  }

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
  
  // Limit exports to prevent memory issues and timeouts
  const EXPORT_LIMIT = 10000;

  if (type === "vehicles") {
    let query = supabase.from("vehicles").select("id, vehicle_code, brand, model, year, notes, is_active, created_at, updated_at");
    if (filters?.search) {
      const term = `%${String(filters.search)}%`;
      query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
    }
    if (filters?.is_active === true) query = query.eq("is_active", true);
    if (filters?.is_active === false) query = query.eq("is_active", false);
    const { data, error } = await query.order("vehicle_code", { ascending: true }).limit(EXPORT_LIMIT);
    if (error) {
      console.error("Failed to export vehicles:", error);
      return NextResponse.json({ error: "Failed to export vehicles" }, { status: 500 });
    }
    rows = data || [];
  }

  if (type === "inspections") {
    const parsed = filters ? inspectionsFilterSchema.safeParse(filters) : null;
    const f = parsed?.success ? parsed.data : {};
    let query = supabase.from("inspections").select("created_at, odometer_km, driver_name, remarks_json, is_deleted, vehicles(vehicle_code, plate_number, brand, model)").eq("is_deleted", false);
    if (f.vehicle_id) {
      query = query.eq("vehicle_id", f.vehicle_id);
    } else if (f.vehicle_query) {
      const term = `%${f.vehicle_query}%`;
      const { data: vehicles, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id")
        .or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
      if (vehicleError) return NextResponse.json({ error: "Failed to filter vehicles" }, { status: 500 });
      const ids = (vehicles || []).map((v) => v.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        query = query.in("vehicle_id", ids);
      }
    } else if (f.brand) {
      const { data: vehicles, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("brand", f.brand);
      if (vehicleError) return NextResponse.json({ error: "Failed to filter vehicles" }, { status: 500 });
      const ids = (vehicles || []).map((v) => v.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        query = query.in("vehicle_id", ids);
      }
    }
    if (f.date_from) query = query.gte("created_at", f.date_from);
    if (f.date_to) query = query.lte("created_at", f.date_to);
    if (f.odometer_min !== undefined) query = query.gte("odometer_km", f.odometer_min);
    if (f.odometer_max !== undefined) query = query.lte("odometer_km", f.odometer_max);
    if (f.remarks) {
      Object.entries(f.remarks).forEach(([key, value]) => {
        query = query.ilike(`remarks_json->>${key}`, `%${value}%`);
      });
    }
    
    if (rows.length === 0 && (f.vehicle_query || f.brand) && (f.vehicle_query ? true : false)) {
      // Already set rows = [] above
    } else {
      const { data, error } = await query.order("created_at", { ascending: false }).limit(EXPORT_LIMIT);
      if (error) {
        console.error("Failed to export inspections:", error);
        return NextResponse.json({ error: "Failed to export inspections" }, { status: 500 });
      }
      
      // Transform data to user-friendly format
      rows = (data || []).map((item: any) => ({
        "Date & Time": item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "",
        "Vehicle Code": item.vehicles?.vehicle_code || "",
        "Plate Number": item.vehicles?.plate_number || "",
        "Vehicle Brand": item.vehicles?.brand || "",
        "Vehicle Model": item.vehicles?.model || "",
        "Odometer (km)": item.odometer_km || 0,
        "Driver Name": item.driver_name || "",
        "Remarks": item.remarks_json ? JSON.stringify(item.remarks_json) : "",
      }));
    }
  }

  if (type === "maintenance") {
    const parsed = filters ? maintenanceFilterSchema.safeParse(filters) : null;
    const f = parsed?.success ? parsed.data : {};
    let query = supabase.from("maintenance").select("created_at, odometer_km, bill_number, supplier_name, amount, remarks, is_deleted, vehicles(vehicle_code, plate_number, brand, model)").eq("is_deleted", false);
    if (f.vehicle_id) {
      query = query.eq("vehicle_id", f.vehicle_id);
    } else if (f.vehicle_query) {
      const term = `%${f.vehicle_query}%`;
      const { data: vehicles, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id")
        .or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
      if (vehicleError) return NextResponse.json({ error: "Failed to filter vehicles" }, { status: 500 });
      const ids = (vehicles || []).map((v) => v.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        query = query.in("vehicle_id", ids);
      }
    } else if (f.brand) {
      const { data: vehicles, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("brand", f.brand);
      if (vehicleError) return NextResponse.json({ error: "Failed to filter vehicles" }, { status: 500 });
      const ids = (vehicles || []).map((v) => v.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        query = query.in("vehicle_id", ids);
      }
    }
    if (f.date_from) query = query.gte("created_at", f.date_from);
    if (f.date_to) query = query.lte("created_at", f.date_to);
    if (f.odometer_min !== undefined) query = query.gte("odometer_km", f.odometer_min);
    if (f.odometer_max !== undefined) query = query.lte("odometer_km", f.odometer_max);
    if (f.supplier) query = query.ilike("supplier_name", `%${f.supplier}%`);
    if (f.amount_min !== undefined) query = query.gte("amount", f.amount_min);
    if (f.amount_max !== undefined) query = query.lte("amount", f.amount_max);
    
    if (rows.length === 0 && (f.vehicle_query || f.brand) && (f.vehicle_query ? true : false)) {
      // Already set rows = [] above
    } else {
      const { data, error } = await query.order("created_at", { ascending: false }).limit(EXPORT_LIMIT);
      if (error) {
        console.error("Failed to export maintenance:", error);
        return NextResponse.json({ error: "Failed to export maintenance" }, { status: 500 });
      }
      
      // Transform data to user-friendly format
      rows = (data || []).map((item: any) => ({
        "Date & Time": item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "",
        "Vehicle Code": item.vehicles?.vehicle_code || "",
        "Plate Number": item.vehicles?.plate_number || "",
        "Vehicle Brand": item.vehicles?.brand || "",
        "Vehicle Model": item.vehicles?.model || "",
        "Odometer (km)": item.odometer_km || 0,
        "Bill Number": item.bill_number || "",
        "Supplier Name": item.supplier_name || "",
        "Amount (₹)": item.amount || 0,
        "Remarks": item.remarks || "",
      }));
    }
  }

  // Generate smart filename based on filters
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
}
