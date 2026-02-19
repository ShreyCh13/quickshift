import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { analyticsFilterSchema } from "@/lib/validation";
import { parseFilters, applyDateFilters } from "@/lib/query-helpers";

// ============================================================================
// Types
// ============================================================================

type VehicleStats = {
  maintenance_count: number;
  inspection_count: number;
  total: number;
  vehicle_code: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type SupplierStats = {
  total: number;
  count: number;
};

// ============================================================================
// Aggregation Helpers
// ============================================================================

function aggregateMonthlyTotals(maintenance: Array<{ created_at: string; amount: number }>) {
  const monthlyTotals: Record<string, number> = {};
  
  for (const row of maintenance) {
    const date = new Date(row.created_at);
    const monthKey = date.toLocaleString("default", { month: "short", year: "numeric" });
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(row.amount || 0);
  }
  
  return Object.entries(monthlyTotals)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month > b.month ? -1 : 1))
    .slice(0, 12);
}

function aggregateSupplierStats(maintenance: Array<{ supplier_name: string; amount: number }>) {
  const supplierData: Record<string, SupplierStats> = {};
  
  for (const row of maintenance) {
    const key = row.supplier_name || "Unknown";
    if (!supplierData[key]) supplierData[key] = { total: 0, count: 0 };
    supplierData[key].total += Number(row.amount || 0);
    supplierData[key].count += 1;
  }
  
  return Object.entries(supplierData)
    .map(([supplier, data]) => ({ supplier, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function aggregateVehicleStats(
  vehicles: Array<{ id: string; vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null }>,
  maintenance: Array<{ vehicle_id: string; amount: number }>,
  inspections: Array<{ vehicle_id: string }>
) {
  const vehicleData: Record<string, VehicleStats> = {};
  
  // Initialize with vehicle info
  for (const v of vehicles) {
    vehicleData[v.id] = {
      maintenance_count: 0,
      inspection_count: 0,
      total: 0,
      vehicle_code: v.vehicle_code,
      plate_number: v.plate_number,
      brand: v.brand,
      model: v.model,
    };
  }
  
  // Aggregate maintenance
  for (const m of maintenance) {
    if (vehicleData[m.vehicle_id]) {
      vehicleData[m.vehicle_id].maintenance_count += 1;
      vehicleData[m.vehicle_id].total += Number(m.amount || 0);
    }
  }
  
  // Aggregate inspections
  for (const i of inspections) {
    if (vehicleData[i.vehicle_id]) {
      vehicleData[i.vehicle_id].inspection_count += 1;
    }
  }
  
  return Object.values(vehicleData)
    .filter((v) => v.total > 0 || v.inspection_count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const filters = parseFilters(url.searchParams.get("filters"), analyticsFilterSchema);

  const {
    brand,
    vehicle_id: vehicleId,
    vehicle_ids: vehicleIds,
    date_from: dateFrom,
    date_to: dateTo,
    supplier,
    supplier_names: supplierNames,
    type = "all",
  } = filters;

  try {
    // Build vehicle query — multi-select takes priority over single
    let vehiclesQuery = supabase.from("vehicles").select("id, vehicle_code, plate_number, brand, model");
    if (vehicleIds && vehicleIds.length > 0) {
      vehiclesQuery = vehiclesQuery.in("id", vehicleIds);
    } else {
      if (brand) vehiclesQuery = vehiclesQuery.ilike("brand", brand);
      if (vehicleId) vehiclesQuery = vehiclesQuery.eq("id", vehicleId);
    }

    const { data: vehicles, error: vehiclesError } = await vehiclesQuery;
    if (vehiclesError) {
      console.error("Failed to load vehicles:", vehiclesError);
      return NextResponse.json({ error: "Failed to load vehicles" }, { status: 500 });
    }

    const resolvedVehicleIds = (vehicles || []).map((v) => v.id);

    // Build maintenance query
    let maintenanceQuery = supabase
      .from("maintenance")
      .select("id, vehicle_id, created_at, odometer_km, bill_number, supplier_name, amount, remarks, vehicles(vehicle_code, plate_number, brand, model)")
      .eq("is_deleted", false);

    // Build inspections query
    let inspectionsQuery = supabase
      .from("inspections")
      .select("id, vehicle_id, created_at, odometer_km, driver_name, remarks_json, vehicles(vehicle_code, plate_number, brand, model)")
      .eq("is_deleted", false);

    // Apply vehicle filters
    const hasVehicleFilter = (vehicleIds && vehicleIds.length > 0) || brand || vehicleId;
    if (resolvedVehicleIds.length > 0 && hasVehicleFilter) {
      maintenanceQuery = maintenanceQuery.in("vehicle_id", resolvedVehicleIds);
      inspectionsQuery = inspectionsQuery.in("vehicle_id", resolvedVehicleIds);
    }

    // Apply date filters using shared helper
    maintenanceQuery = applyDateFilters(maintenanceQuery, { date_from: dateFrom, date_to: dateTo });
    inspectionsQuery = applyDateFilters(inspectionsQuery, { date_from: dateFrom, date_to: dateTo });

    // Apply supplier filter — multi-select takes priority
    if (supplierNames && supplierNames.length > 0) {
      maintenanceQuery = maintenanceQuery.in("supplier_name", supplierNames);
    } else if (supplier) {
      maintenanceQuery = maintenanceQuery.ilike("supplier_name", `%${supplier}%`);
    }

    // Limit to prevent memory issues
    const ANALYTICS_LIMIT = 1000;

    // Execute queries based on type filter
    const [maintenanceRes, inspectionsRes] = await Promise.all([
      type === "inspections" 
        ? Promise.resolve({ data: [], error: null }) 
        : maintenanceQuery.order("created_at", { ascending: false }).limit(ANALYTICS_LIMIT),
      type === "maintenance" 
        ? Promise.resolve({ data: [], error: null }) 
        : inspectionsQuery.order("created_at", { ascending: false }).limit(ANALYTICS_LIMIT),
    ]);

    if (maintenanceRes.error) {
      console.error("Failed to load maintenance:", maintenanceRes.error);
      return NextResponse.json({ error: "Failed to load maintenance" }, { status: 500 });
    }
    if (inspectionsRes.error) {
      console.error("Failed to load inspections:", inspectionsRes.error);
      return NextResponse.json({ error: "Failed to load inspections" }, { status: 500 });
    }

    const maintenance = maintenanceRes.data || [];
    const inspections = inspectionsRes.data || [];

    // Aggregate data using helper functions
    const monthly = aggregateMonthlyTotals(maintenance);
    const topSuppliers = aggregateSupplierStats(maintenance);
    const topVehicles = aggregateVehicleStats(vehicles || [], maintenance as Array<{ vehicle_id: string; amount: number }>, inspections as Array<{ vehicle_id: string }>);

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
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ 
      error: "Failed to load analytics",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
