import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";

function parseFilters(url: URL) {
  const raw = url.searchParams.get("filters");
  if (!raw) return {};
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const filters = parseFilters(url);

  const brand = filters.brand as string | undefined;
  const vehicleId = filters.vehicle_id as string | undefined;
  const dateFrom = filters.date_from as string | undefined;
  const dateTo = filters.date_to as string | undefined;
  const supplier = filters.supplier as string | undefined;
  const type = (filters.type as string | undefined) || "all";

  let vehiclesQuery = supabase.from("vehicles").select("id, vehicle_code, plate_number, brand, model");
  if (brand) vehiclesQuery = vehiclesQuery.eq("brand", brand);
  if (vehicleId) vehiclesQuery = vehiclesQuery.eq("id", vehicleId);
  const { data: vehicles, error: vehiclesError } = await vehiclesQuery;
  if (vehiclesError) return NextResponse.json({ error: "Failed to load vehicles" }, { status: 500 });

  const vehicleIds = new Set((vehicles || []).map((v) => v.id));
  const ids = Array.from(vehicleIds);

  let maintenanceQuery = supabase
    .from("maintenance")
    .select("id, vehicle_id, created_at, odometer_km, bill_number, supplier_name, amount, remarks, vehicles(vehicle_code, plate_number, brand, model)");
  let inspectionsQuery = supabase
    .from("inspections")
    .select("id, vehicle_id, created_at, odometer_km, driver_name, remarks_json, vehicles(vehicle_code, plate_number, brand, model)");

  if (ids.length > 0 && (brand || vehicleId)) {
    maintenanceQuery = maintenanceQuery.in("vehicle_id", ids);
    inspectionsQuery = inspectionsQuery.in("vehicle_id", ids);
  }
  if (dateFrom) {
    maintenanceQuery = maintenanceQuery.gte("created_at", dateFrom);
    inspectionsQuery = inspectionsQuery.gte("created_at", dateFrom);
  }
  if (dateTo) {
    maintenanceQuery = maintenanceQuery.lte("created_at", dateTo);
    inspectionsQuery = inspectionsQuery.lte("created_at", dateTo);
  }
  if (supplier) {
    maintenanceQuery = maintenanceQuery.ilike("supplier_name", `%${supplier}%`);
  }

  // Add soft-delete filter and limit to prevent memory issues with large datasets
  const ANALYTICS_LIMIT = 1000;
  
  maintenanceQuery = maintenanceQuery.eq("is_deleted", false);
  inspectionsQuery = inspectionsQuery.eq("is_deleted", false);

  const [maintenanceRes, inspectionsRes] = await Promise.all([
    type === "inspections" 
      ? Promise.resolve({ data: [] }) 
      : maintenanceQuery.order("created_at", { ascending: false }).limit(ANALYTICS_LIMIT),
    type === "maintenance" 
      ? Promise.resolve({ data: [] }) 
      : inspectionsQuery.order("created_at", { ascending: false }).limit(ANALYTICS_LIMIT),
  ]);

  const maintenance = maintenanceRes.data || [];
  const inspections = inspectionsRes.data || [];

  const monthlyTotals: Record<string, number> = {};
  maintenance.forEach((row) => {
    const date = new Date(row.created_at);
    const monthKey = date.toLocaleString("default", { month: "short", year: "numeric" });
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(row.amount || 0);
  });

  const supplierData: Record<string, { total: number; count: number }> = {};
  maintenance.forEach((row) => {
    const key = row.supplier_name || "Unknown";
    if (!supplierData[key]) supplierData[key] = { total: 0, count: 0 };
    supplierData[key].total += Number(row.amount || 0);
    supplierData[key].count += 1;
  });

  const vehicleData: Record<
    string,
    { maintenance_count: number; inspection_count: number; total: number; vehicle_code: string; plate_number: string | null }
  > = {};
  (vehicles || []).forEach((v) => {
    vehicleData[v.id] = {
      maintenance_count: 0,
      inspection_count: 0,
      total: 0,
      vehicle_code: v.vehicle_code,
      plate_number: v.plate_number || null,
    };
  });
  maintenance.forEach((m) => {
    if (vehicleData[m.vehicle_id]) {
      vehicleData[m.vehicle_id].maintenance_count += 1;
      vehicleData[m.vehicle_id].total += Number(m.amount || 0);
    }
  });
  inspections.forEach((i) => {
    if (vehicleData[i.vehicle_id]) {
      vehicleData[i.vehicle_id].inspection_count += 1;
    }
  });

  const monthly = Object.entries(monthlyTotals)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month > b.month ? -1 : 1))
    .slice(0, 12);

  const topSuppliers = Object.entries(supplierData)
    .map(([supplierName, data]) => ({ supplier: supplierName, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topVehicles = Object.values(vehicleData)
    .filter((v) => v.total > 0 || v.inspection_count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    filters,
    inspections,
    maintenance,
    monthly,
    topSuppliers,
    topVehicles,
    totalInspections: inspections.length,
    totalMaintenance: maintenance.length,
  });
}
