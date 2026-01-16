import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import {
  maintenanceCreateSchema,
  maintenanceFilterSchema,
  maintenanceUpdateSchema,
} from "@/lib/validation";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";

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
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = parseFilters(url.searchParams.get("filters"));

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("maintenance")
    .select("*, vehicles(vehicle_code, plate_number), users(display_name)", { count: "exact" });

  if (filters.vehicle_id) query = query.eq("vehicle_id", filters.vehicle_id);
  if (filters.date_from) query = query.gte("created_at", filters.date_from);
  if (filters.date_to) query = query.lte("created_at", filters.date_to);
  if (filters.odometer_min !== undefined) query = query.gte("odometer_km", filters.odometer_min);
  if (filters.odometer_max !== undefined) query = query.lte("odometer_km", filters.odometer_max);
  if (filters.supplier) query = query.ilike("supplier_name", `%${filters.supplier}%`);
  if (filters.amount_min !== undefined) query = query.gte("amount", filters.amount_min);
  if (filters.amount_max !== undefined) query = query.lte("amount", filters.amount_max);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: "Failed to load maintenance" }, { status: 500 });
  return NextResponse.json({ maintenance: data, total: count || 0 });
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
    return NextResponse.json({ maintenance: data });
  } catch {
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
    const input = maintenanceUpdateSchema.parse(await req.json());
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("maintenance")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ maintenance: data });
  } catch {
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
    const { error } = await supabase.from("maintenance").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
