import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { inspectionCreateSchema, inspectionUpdateSchema, inspectionsFilterSchema } from "@/lib/validation";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";

function parseFilters(raw: string | null) {
  if (!raw) return {};
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return inspectionsFilterSchema.parse(JSON.parse(decoded));
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = parseFilters(url.searchParams.get("filters"));

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("inspections")
    .select("*, vehicles(vehicle_code, plate_number, brand, model), users(display_name)", { count: "exact" });

  if (filters.vehicle_id) {
    query = query.eq("vehicle_id", filters.vehicle_id);
  } else if (filters.vehicle_query) {
    const term = `%${filters.vehicle_query}%`;
    const { data: vehicles, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id")
      .or(`vehicle_code.ilike.${term},plate_number.ilike.${term}`);
    if (vehicleError) {
      return NextResponse.json({ error: "Failed to filter vehicles" }, { status: 500 });
    }
    const ids = (vehicles || []).map((v) => v.id);
    if (ids.length === 0) {
      return NextResponse.json({ inspections: [], total: 0 });
    }
    query = query.in("vehicle_id", ids);
  }
  if (filters.date_from) query = query.gte("created_at", filters.date_from);
  if (filters.date_to) query = query.lte("created_at", filters.date_to);
  if (filters.odometer_min !== undefined) query = query.gte("odometer_km", filters.odometer_min);
  if (filters.odometer_max !== undefined) query = query.lte("odometer_km", filters.odometer_max);
  if (filters.remarks) {
    Object.entries(filters.remarks).forEach(([key, value]) => {
      query = query.ilike(`remarks_json->>${key}`, `%${value}%`);
    });
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) {
    console.error("Failed to load inspections:", error);
    return NextResponse.json({ error: error.message || "Failed to load inspections", details: error }, { status: 500 });
  }
  console.log("Loaded inspections:", data?.length || 0, "total:", count);
  return NextResponse.json({ inspections: data, total: count || 0 });
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

    const { data: remarkFields, error: remarkError } = await supabase
      .from("remark_fields")
      .select("key")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (remarkError) return NextResponse.json({ error: "Failed to load remark fields" }, { status: 500 });

    const expectedKeys = remarkFields?.map((r) => r.key) || [];
    const missing = expectedKeys.filter((key) => !input.remarks_json[key]);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing remarks: ${missing.join(", ")}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("inspections")
      .insert({
        ...input,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
    if (session.user.role !== "admin") {
      const { data: existing, error: existingError } = await supabase
        .from("inspections")
        .select("created_by")
        .eq("id", id)
        .single();
      if (existingError || !existing || existing.created_by !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const { data, error } = await supabase
      .from("inspections")
      .update({ ...updates, updated_by: session.user.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update inspection:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    // Soft delete
    const { error } = await supabase
      .from("inspections")
      .delete()
      .eq("id", id)
;
    if (error) {
      console.error("Failed to delete inspection:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse inspection delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
