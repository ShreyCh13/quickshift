import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { parseSessionFromRequest, isSessionValid } from "@/lib/auth";

export async function GET(req: Request) {
  // Check session but don't block - we want to see the debug info either way
  const session = parseSessionFromRequest(req);
  const sessionValid = isSessionValid(session);
  
  const supabase = getSupabaseAdmin();
  
  // Count all tables
  const [vehicles, inspections, maintenance, users] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("inspections").select("id", { count: "exact", head: true }),
    supabase.from("maintenance").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
  ]);

  // Get latest 5 inspections
  const { data: latestInspections, error: inspError } = await supabase
    .from("inspections")
    .select("id, vehicle_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Get latest 5 maintenance
  const { data: latestMaintenance, error: maintError } = await supabase
    .from("maintenance")
    .select("id, vehicle_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Test the actual API endpoints (simulating what the frontend does)
  let maintenanceApiTest = null;
  let inspectionsApiTest = null;
  
  try {
    // Direct query without any filters - what the main page does
    const { data: mData, error: mErr, count: mCount } = await supabase
      .from("maintenance")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, 19);
    maintenanceApiTest = { success: !mErr, count: mCount, error: mErr?.message, firstRecord: mData?.[0] ? "exists" : "none" };
  } catch (e) {
    maintenanceApiTest = { success: false, error: e instanceof Error ? e.message : "unknown" };
  }

  try {
    const { data: iData, error: iErr, count: iCount } = await supabase
      .from("inspections")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, 19);
    inspectionsApiTest = { success: !iErr, count: iCount, error: iErr?.message, firstRecord: iData?.[0] ? "exists" : "none" };
  } catch (e) {
    inspectionsApiTest = { success: false, error: e instanceof Error ? e.message : "unknown" };
  }

  return NextResponse.json({
    message: "Database Debug Info",
    sessionInfo: {
      hasSession: !!session,
      isValid: sessionValid,
      userId: session?.user?.id || null,
      userName: session?.user?.displayName || null,
    },
    counts: {
      vehicles: vehicles.count || 0,
      inspections: inspections.count || 0,
      maintenance: maintenance.count || 0,
      users: users.count || 0,
    },
    errors: {
      vehicles: vehicles.error?.message || null,
      inspections: inspections.error?.message || null,
      maintenance: maintenance.error?.message || null,
      users: users.error?.message || null,
      latestInspections: inspError?.message || null,
      latestMaintenance: maintError?.message || null,
    },
    latestInspections: latestInspections || [],
    latestMaintenance: latestMaintenance || [],
    apiTests: {
      maintenance: maintenanceApiTest,
      inspections: inspectionsApiTest,
    },
  }, { status: 200 });
}
