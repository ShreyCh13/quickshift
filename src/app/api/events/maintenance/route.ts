import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import {
  maintenanceCreateSchema,
  maintenanceFilterSchema,
  maintenanceUpdateSchema,
} from "@/lib/validation";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@/lib/constants";
import { invalidateCache } from "@/lib/cache";

function parseFilters(raw: string | null) {
  if (!raw) return {};
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return maintenanceFilterSchema.parse(JSON.parse(decoded));
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = parseFilters(url.searchParams.get("filters"));

  const supabase = getSupabaseAdmin();

  try {
    // Build query with specific field selection for performance
    let query = supabase
      .from("maintenance")
      .select("id, vehicle_id, created_at, updated_at, odometer_km, bill_number, supplier_name, amount, remarks, created_by, updated_by, is_deleted", { count: "exact" })
      .eq("is_deleted", false);

    // Apply filters only if they exist
    if (filters.vehicle_id) {
      query = query.eq("vehicle_id", filters.vehicle_id);
    }
    if (filters.vehicle_query) {
      const term = `%${filters.vehicle_query}%`;
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id")
        .or(`vehicle_code.ilike.${term},plate_number.ilike.${term}`);
      const vehicleIds = (vehicles || []).map((v) => v.id);
      if (vehicleIds.length > 0) {
        query = query.in("vehicle_id", vehicleIds);
      } else {
        return NextResponse.json({ maintenance: [], total: 0, page, pageSize, hasMore: false });
      }
    }
    if (filters.date_from) query = query.gte("created_at", filters.date_from);
    if (filters.date_to) query = query.lte("created_at", filters.date_to);
    if (filters.supplier) query = query.ilike("supplier_name", `%${filters.supplier}%`);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Maintenance GET error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // BATCHED vehicle lookup - fixes N+1 query problem
    // Collect unique vehicle IDs and fetch all vehicles in ONE query
    const vehicleIds = [...new Set((data || []).filter(m => m.vehicle_id).map(m => m.vehicle_id))];
    
    let vehicleMap = new Map<string, { vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null }>();
    
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id, vehicle_code, plate_number, brand, model")
        .in("id", vehicleIds);
      
      if (vehicles) {
        vehicleMap = new Map(vehicles.map(v => [v.id, {
          vehicle_code: v.vehicle_code,
          plate_number: v.plate_number,
          brand: v.brand,
          model: v.model,
        }]));
      }
    }

    // Map vehicle data to maintenance records
    const maintenanceWithVehicles = (data || []).map(m => ({
      ...m,
      vehicles: m.vehicle_id ? vehicleMap.get(m.vehicle_id) || null : null,
    }));

    const total = count || 0;
    const hasMore = from + (data?.length || 0) < total;

    return NextResponse.json({ 
      maintenance: maintenanceWithVehicles, 
      total,
      page,
      pageSize,
      hasMore,
    });
  } catch (err) {
    console.error("Maintenance GET exception:", err);
    return NextResponse.json({ 
      error: "Unexpected error", 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "staff"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = maintenanceCreateSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("maintenance")
      .insert({
        ...input,
        amount: input.amount,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    
    // Invalidate server-side cache for analytics
    invalidateCache("analytics:");
    
    return NextResponse.json({ maintenance: data });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "staff"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = maintenanceUpdateSchema.parse(await req.json());
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    if (session.user.role !== "admin") {
      const { data: existing, error: existingError } = await supabase
        .from("maintenance")
        .select("created_by")
        .eq("id", id)
        .single();
      if (existingError || !existing || existing.created_by !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const { data, error } = await supabase
      .from("maintenance")
      .update({ ...updates, updated_by: session.user.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update maintenance:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Invalidate server-side cache for analytics
    invalidateCache("analytics:");
    
    return NextResponse.json({ maintenance: data });
  } catch (err) {
    console.error("Failed to parse maintenance update:", err);
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
    // Soft delete - set is_deleted flag and track who/when deleted
    const { error } = await supabase
      .from("maintenance")
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString(),
        deleted_by: session.user.id,
        updated_by: session.user.id 
      })
      .eq("id", id);
    if (error) {
      console.error("Failed to delete maintenance:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Invalidate server-side cache for analytics
    invalidateCache("analytics:");
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse maintenance delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
