import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import {
  maintenanceCreateSchema,
  maintenanceFilterSchema,
  maintenanceUpdateSchema,
  idSchema,
} from "@/lib/validation";
import { invalidateCache } from "@/lib/cache";
import {
  parseFilters,
  parsePagination,
  getVehicleIdsByFilter,
  enrichWithVehicles,
  softDelete,
  applyDateFilters,
  emptyPaginatedResponse,
  paginatedResponse,
} from "@/lib/query-helpers";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const url = new URL(req.url);
  const pagination = parsePagination(url);
  const filters = parseFilters(url.searchParams.get("filters"), maintenanceFilterSchema);

  const supabase = getSupabaseAdmin();

  try {
    // Build base query
    let query = supabase
      .from("maintenance")
      .select("id, vehicle_id, created_at, updated_at, odometer_km, bill_number, supplier_name, amount, remarks, created_by, updated_by, is_deleted", { count: "exact" })
      .eq("is_deleted", false);

    // Apply vehicle filters using shared helper
    const vehicleResult = await getVehicleIdsByFilter(supabase, {
      vehicle_id: filters.vehicle_id,
      vehicle_query: filters.vehicle_query,
      brand: filters.brand,
    });
    
    if (vehicleResult.noMatch) {
      return NextResponse.json(emptyPaginatedResponse("maintenance", pagination));
    }
    
    if (vehicleResult.ids.length === 1) {
      query = query.eq("vehicle_id", vehicleResult.ids[0]);
    } else if (vehicleResult.ids.length > 1) {
      query = query.in("vehicle_id", vehicleResult.ids);
    }

    // Apply date filters
    query = applyDateFilters(query, filters);
    
    // Apply supplier filter
    if (filters.supplier) {
      query = query.ilike("supplier_name", `%${filters.supplier}%`);
    }

    // Execute query
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(pagination.from, pagination.to);

    if (error) {
      console.error("Maintenance GET error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Enrich with vehicle data using shared helper
    const maintenanceWithVehicles = await enrichWithVehicles(data || [], supabase);

    return NextResponse.json(paginatedResponse("maintenance", maintenanceWithVehicles, count || 0, pagination));
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
        created_by: session.user.id,
      })
      .select("*")
      .single();
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
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
    
    // Non-admins can only edit their own records
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
    // Validate input with Zod schema
    const { id } = idSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    
    // Use shared soft delete helper
    const result = await softDelete(supabase, "maintenance", id, session.user.id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    invalidateCache("analytics:");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse maintenance delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
