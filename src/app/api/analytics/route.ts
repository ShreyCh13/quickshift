import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Fetch all data (only non-deleted records)
  const [
    { data: maintenance, error: maintenanceError },
    { data: inspections, error: inspectionsError },
    { data: vehicles, error: vehiclesError },
    { count: totalInspections },
    { count: totalMaintenance },
  ] = await Promise.all([
    supabase.from("maintenance").select("amount, supplier_name, vehicle_id, created_at"),
    supabase.from("inspections").select("vehicle_id, created_at"),
    supabase.from("vehicles").select("id, vehicle_code").eq("is_active", true),
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("maintenance").select("*", { count: "exact", head: true }),
  ]);

  if (maintenanceError || inspectionsError || vehiclesError) {
    console.error("Failed to load analytics:", { maintenanceError, inspectionsError, vehiclesError });
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }

  // Monthly totals
  const monthlyTotals: Record<string, number> = {};
  maintenance?.forEach((row) => {
    const date = new Date(row.created_at);
    const monthKey = date.toLocaleString("default", { month: "short", year: "numeric" });
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(row.amount || 0);
  });

  // Supplier aggregation
  const supplierData: Record<string, { total: number; count: number }> = {};
  maintenance?.forEach((row) => {
    const supplier = row.supplier_name;
    if (!supplierData[supplier]) supplierData[supplier] = { total: 0, count: 0 };
    supplierData[supplier].total += Number(row.amount || 0);
    supplierData[supplier].count += 1;
  });

  // Vehicle aggregation
  const vehicleData: Record<
    string,
    { maintenance_count: number; inspection_count: number; total: number; vehicle_code: string }
  > = {};

  vehicles?.forEach((v) => {
    vehicleData[v.id] = { maintenance_count: 0, inspection_count: 0, total: 0, vehicle_code: v.vehicle_code };
  });

  maintenance?.forEach((m) => {
    if (vehicleData[m.vehicle_id]) {
      vehicleData[m.vehicle_id].maintenance_count += 1;
      vehicleData[m.vehicle_id].total += Number(m.amount || 0);
    }
  });

  inspections?.forEach((i) => {
    if (vehicleData[i.vehicle_id]) {
      vehicleData[i.vehicle_id].inspection_count += 1;
    }
  });

  const monthly = Object.entries(monthlyTotals)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month > b.month ? -1 : 1))
    .slice(0, 12);

  const topSuppliers = Object.entries(supplierData)
    .map(([supplier, data]) => ({ supplier, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topVehicles = Object.values(vehicleData)
    .filter((v) => v.total > 0 || v.inspection_count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    monthly,
    topSuppliers,
    topVehicles,
    totalInspections: totalInspections || 0,
    totalMaintenance: totalMaintenance || 0,
  });
}
