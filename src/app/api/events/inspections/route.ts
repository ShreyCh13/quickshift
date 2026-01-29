import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { 
  inspectionCreateSchema, 
  inspectionUpdateSchema, 
  inspectionsFilterSchema,
  idSchema 
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
  const filters = parseFilters(url.searchParams.get("filters"), inspectionsFilterSchema);

  const supabase = getSupabaseAdmin();

  try {
    // Build base query
    let query = supabase
      .from("inspections")
      .select("id, vehicle_id, created_at, updated_at, odometer_km, driver_name, remarks_json, created_by, updated_by, is_deleted", { count: "exact" })
      .eq("is_deleted", false);

    // Apply vehicle filters using shared helper
    const vehicleResult = await getVehicleIdsByFilter(supabase, {
      vehicle_id: filters.vehicle_id,
      vehicle_query: filters.vehicle_query,
      brand: filters.brand,
    });
    
    if (vehicleResult.noMatch) {
      return NextResponse.json(emptyPaginatedResponse("inspections", pagination));
    }
    
    if (vehicleResult.ids.length === 1) {
      query = query.eq("vehicle_id", vehicleResult.ids[0]);
    } else if (vehicleResult.ids.length > 1) {
      query = query.in("vehicle_id", vehicleResult.ids);
    }

    // Apply date filters
    query = applyDateFilters(query, filters);

    // Execute query
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(pagination.from, pagination.to);

    if (error) {
      console.error("Inspections GET error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Enrich with vehicle data using shared helper
    const inspectionsWithVehicles = await enrichWithVehicles(data || [], supabase);

    return NextResponse.json(paginatedResponse("inspections", inspectionsWithVehicles, count || 0, pagination));
  } catch (err) {
    console.error("Inspections GET exception:", err);
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
    const input = inspectionCreateSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    // Validate all required remark fields are provided
    const { data: remarkFields, error: remarkError } = await supabase
      .from("remark_fields")
      .select("key")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
      
    if (remarkError) {
      return NextResponse.json({ error: "Failed to load remark fields" }, { status: 500 });
    }

    const expectedKeys = remarkFields?.map((r) => r.key) || [];
    const missing = expectedKeys.filter((key) => !input.remarks_json[key]);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing remarks: ${missing.join(", ")}` }, { status: 400 });
    }

    // Verify vehicle exists to prevent foreign key violations
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, is_active")
      .eq("id", input.vehicle_id)
      .maybeSingle();
    
    if (vehicleError) {
      console.error("Failed to verify vehicle:", vehicleError);
      return NextResponse.json({ error: "Failed to verify vehicle" }, { status: 500 });
    }
    
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    
    if (!vehicle.is_active) {
      return NextResponse.json({ error: "Cannot create inspection for inactive vehicle" }, { status: 400 });
    }

    // Insert inspection
    const { data, error } = await supabase
      .from("inspections")
      .insert({
        ...input,
        created_by: session.user.id,
      })
      .select("*")
      .single();
      
    if (error) {
      console.error("Failed to create inspection:", error);
      // Handle specific database errors
      if (error.code === "23503") { // Foreign key violation
        return NextResponse.json({ error: "Invalid vehicle reference" }, { status: 400 });
      }
      if (error.code === "23502") { // Not null violation
        return NextResponse.json({ error: "Required fields are missing" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message || "Failed to create inspection" }, { status: 400 });
    }
    
    invalidateCache("analytics:");
    return NextResponse.json({ inspection: data });
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
    const input = inspectionUpdateSchema.parse(await req.json());
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    
    // Verify inspection exists
    const { data: existing, error: existingError } = await supabase
      .from("inspections")
      .select("id, created_by, is_deleted")
      .eq("id", id)
      .maybeSingle();
    
    if (existingError) {
      console.error("Failed to check inspection:", existingError);
      return NextResponse.json({ error: "Failed to verify inspection" }, { status: 500 });
    }
    
    if (!existing) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }
    
    if (existing.is_deleted) {
      return NextResponse.json({ error: "Cannot edit deleted inspection" }, { status: 400 });
    }
    
    // Non-admins can only edit their own inspections
    if (session.user.role !== "admin" && existing.created_by !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Verify vehicle exists if vehicle_id is being updated
    if (updates.vehicle_id && updates.vehicle_id !== existing.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id, is_active")
        .eq("id", updates.vehicle_id)
        .maybeSingle();
      
      if (vehicleError) {
        console.error("Failed to verify vehicle:", vehicleError);
        return NextResponse.json({ error: "Failed to verify vehicle" }, { status: 500 });
      }
      
      if (!vehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      
      if (!vehicle.is_active) {
        return NextResponse.json({ error: "Cannot assign inspection to inactive vehicle" }, { status: 400 });
      }
    }
    
    // Update inspection
    const { data, error } = await supabase
      .from("inspections")
      .update({ ...updates, updated_by: session.user.id })
      .eq("id", id)
      .select("*")
      .single();
      
    if (error) {
      console.error("Failed to update inspection:", error);
      // Handle specific database errors
      if (error.code === "23503") { // Foreign key violation
        return NextResponse.json({ error: "Invalid vehicle reference" }, { status: 400 });
      }
      if (error.code === "23502") { // Not null violation
        return NextResponse.json({ error: "Required fields cannot be null" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message || "Failed to update inspection" }, { status: 400 });
    }
    
    if (!data) {
      return NextResponse.json({ error: "Inspection not found after update" }, { status: 404 });
    }
    
    invalidateCache("analytics:");
    return NextResponse.json({ inspection: data });
  } catch (err) {
    console.error("Failed to parse inspection update:", err);
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
    const result = await softDelete(supabase, "inspections", id, session.user.id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    invalidateCache("analytics:");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse inspection delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
