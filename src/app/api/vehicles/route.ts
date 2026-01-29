import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { vehicleSchema } from "@/lib/validation";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";
import { invalidateCache } from "@/lib/cache";

export async function GET(req: Request) {
  try {
    const session = requireSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const isActive = url.searchParams.get("isActive");
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabaseAdmin();
    
    // Check if search is a valid UUID (for direct ID lookup)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuidSearch = typeof search === "string" && uuidRegex.test(search.trim());
    
    async function runQuery(includePlate: boolean) {
      let query = supabase
        .from("vehicles")
        .select(
          includePlate
            ? "id, vehicle_code, plate_number, brand, model, year, notes, is_active, created_at, updated_at"
            : "id, vehicle_code, brand, model, year, notes, is_active, created_at, updated_at",
          { count: "exact" },
        );
      if (typeof search === "string" && search.trim()) {
        if (isUuidSearch) {
          // Direct ID lookup when search is a UUID
          query = query.eq("id", search.trim());
        } else {
          // Text search on vehicle fields
          const term = `%${search.trim()}%`;
          query = query.or(
            includePlate
              ? `vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`
              : `vehicle_code.ilike.${term},brand.ilike.${term},model.ilike.${term}`,
          );
        }
      }
      if (isActive === "true") query = query.eq("is_active", true);
      if (isActive === "false") query = query.eq("is_active", false);
      return query.order("updated_at", { ascending: false }).range(from, to);
    }

    let { data, error, count } = await runQuery(true);
    if (error && error.message?.includes("column vehicles.plate_number")) {
      const fallback = await runQuery(false);
      data = fallback.data;
      error = fallback.error;
      count = fallback.count;
    }
    if (error) {
      console.error("Failed to load vehicles:", error);
      return NextResponse.json({ error: "Failed to load vehicles", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ vehicles: data, total: count || 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("Failed to load vehicles:", err);
    return NextResponse.json({ error: "Failed to load vehicles", details: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = vehicleSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vehicles")
      .insert(input)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to create vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Invalidate server-side cache for vehicles and analytics
    invalidateCache("vehicles:");
    invalidateCache("analytics:");
    
    return NextResponse.json({ vehicle: data });
  } catch (err) {
    console.error("Failed to parse vehicle create:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = vehicleSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vehicles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Invalidate server-side cache for vehicles and analytics
    invalidateCache("vehicles:");
    invalidateCache("analytics:");
    
    return NextResponse.json({ vehicle: data });
  } catch (err) {
    console.error("Failed to parse vehicle update:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    
    const supabase = getSupabaseAdmin();
    
    // Check for related records (inspections and maintenance for this vehicle)
    const [inspectionsCheck, maintenanceCheck] = await Promise.all([
      supabase.from("inspections").select("id", { count: "exact", head: true }).eq("vehicle_id", id).eq("is_deleted", false),
      supabase.from("maintenance").select("id", { count: "exact", head: true }).eq("vehicle_id", id).eq("is_deleted", false),
    ]);
    
    const inspectionCount = inspectionsCheck.count || 0;
    const maintenanceCount = maintenanceCheck.count || 0;
    
    // Always soft delete - never hard delete vehicles to preserve data integrity
    // This prevents accidental data loss and maintains referential integrity
    const { error } = await supabase.from("vehicles").update({ is_active: false }).eq("id", id);
    if (error) {
      console.error("Failed to soft delete vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Invalidate server-side cache for vehicles and analytics
    invalidateCache("vehicles:");
    invalidateCache("analytics:");
    
    return NextResponse.json({ 
      success: true, 
      soft: true,
      relatedRecords: { inspectionCount, maintenanceCount }
    });
  } catch (err) {
    console.error("Failed to parse vehicle delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
