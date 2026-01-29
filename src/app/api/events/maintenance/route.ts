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
      return NextResponse.json({ error: "Cannot create maintenance for inactive vehicle" }, { status: 400 });
    }
    
    // Validate required fields
    if (!input.bill_number || !input.bill_number.trim()) {
      return NextResponse.json({ error: "Bill number is required" }, { status: 400 });
    }
    if (!input.supplier_name || !input.supplier_name.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }
    if (input.amount < 0) {
      return NextResponse.json({ error: "Amount cannot be negative" }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from("maintenance")
      .insert({
        ...input,
        bill_number: input.bill_number.trim(),
        supplier_name: input.supplier_name.trim(),
        remarks: input.remarks?.trim() || null,
        created_by: session.user.id,
      })
      .select("*")
      .single();
      
    if (error) {
      console.error("Failed to create maintenance:", error);
      // Handle specific database errors
      if (error.code === "23503") { // Foreign key violation
        return NextResponse.json({ error: "Invalid vehicle reference" }, { status: 400 });
      }
      if (error.code === "23502") { // Not null violation
        return NextResponse.json({ error: "Required fields are missing" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message || "Failed to create maintenance" }, { status: 400 });
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
    
    // Verify maintenance record exists
    const { data: existing, error: existingError } = await supabase
      .from("maintenance")
      .select("id, created_by, is_deleted, vehicle_id")
      .eq("id", id)
      .maybeSingle();
    
    if (existingError) {
      console.error("Failed to check maintenance:", existingError);
      return NextResponse.json({ error: "Failed to verify maintenance record" }, { status: 500 });
    }
    
    if (!existing) {
      return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 });
    }
    
    if (existing.is_deleted) {
      return NextResponse.json({ error: "Cannot edit deleted maintenance record" }, { status: 400 });
    }
    
    // Non-admins can only edit their own records
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
        return NextResponse.json({ error: "Cannot assign maintenance to inactive vehicle" }, { status: 400 });
      }
    }
    
    // Validate fields if being updated
    if (updates.bill_number !== undefined && (!updates.bill_number || !updates.bill_number.trim())) {
      return NextResponse.json({ error: "Bill number cannot be empty" }, { status: 400 });
    }
    if (updates.supplier_name !== undefined && (!updates.supplier_name || !updates.supplier_name.trim())) {
      return NextResponse.json({ error: "Supplier name cannot be empty" }, { status: 400 });
    }
    if (updates.amount !== undefined && updates.amount < 0) {
      return NextResponse.json({ error: "Amount cannot be negative" }, { status: 400 });
    }
    
    // Prepare update data with trimmed values
    const updateData: Record<string, unknown> = { ...updates, updated_by: session.user.id };
    if (updates.bill_number !== undefined) updateData.bill_number = updates.bill_number.trim();
    if (updates.supplier_name !== undefined) updateData.supplier_name = updates.supplier_name.trim();
    if (updates.remarks !== undefined) updateData.remarks = updates.remarks?.trim() || null;
    
    const { data, error } = await supabase
      .from("maintenance")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();
      
    if (error) {
      console.error("Failed to update maintenance:", error);
      // Handle specific database errors
      if (error.code === "23503") { // Foreign key violation
        return NextResponse.json({ error: "Invalid vehicle reference" }, { status: 400 });
      }
      if (error.code === "23502") { // Not null violation
        return NextResponse.json({ error: "Required fields cannot be null" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message || "Failed to update maintenance" }, { status: 400 });
    }
    
    if (!data) {
      return NextResponse.json({ error: "Maintenance record not found after update" }, { status: 404 });
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
