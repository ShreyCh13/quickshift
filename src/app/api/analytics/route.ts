import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: maintenance, error } = await supabase
    .from("maintenance")
    .select("amount, supplier_name, vehicle_id, created_at");
  if (error) return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });

  const monthlyTotals: Record<string, number> = {};
  const bySupplier: Record<string, number> = {};
  const byVehicle: Record<string, number> = {};

  maintenance?.forEach((row) => {
    const created = new Date(row.created_at);
    const monthKey = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, "0")}`;
    const amount = Number(row.amount || 0);
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
    if (row.supplier_name) {
      bySupplier[row.supplier_name] = (bySupplier[row.supplier_name] || 0) + amount;
    }
    if (row.vehicle_id) {
      byVehicle[row.vehicle_id] = (byVehicle[row.vehicle_id] || 0) + amount;
    }
  });

  const topSuppliers = Object.entries(bySupplier)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topVehicles = Object.entries(byVehicle)
    .map(([vehicle_id, total]) => ({ vehicle_id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const monthly = Object.entries(monthlyTotals)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  return NextResponse.json({ monthly, topSuppliers, topVehicles });
}
