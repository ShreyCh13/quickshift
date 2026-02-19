import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { driverCreateSchema, driverUpdateSchema, idSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const activeOnly = url.searchParams.get("active") !== "false";

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("drivers")
    .select("id, name, is_active, created_at", { count: "exact" })
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);
  if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);

  const { data, error, count } = await query.limit(100);

  if (error) {
    console.error("Drivers GET error:", error);
    return NextResponse.json({ error: "Failed to load drivers" }, { status: 500 });
  }

  return NextResponse.json({ drivers: data || [], total: count || 0 });
}

export async function POST(req: Request) {
  // Both admin and staff can add new drivers
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const input = driverCreateSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("drivers")
      .insert({ name: input.name, created_by: session.user.id })
      .select("id, name, is_active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Driver name already exists" }, { status: 409 });
      }
      console.error("Driver POST error:", error);
      return NextResponse.json({ error: "Failed to create driver" }, { status: 500 });
    }

    return NextResponse.json({ driver: data });
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
    const input = driverUpdateSchema.parse(await req.json());
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("drivers")
      .update(updates)
      .eq("id", id)
      .select("id, name, is_active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Driver name already exists" }, { status: 409 });
      }
      console.error("Driver PUT error:", error);
      return NextResponse.json({ error: "Failed to update driver" }, { status: 500 });
    }

    return NextResponse.json({ driver: data });
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
    const { id } = idSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("drivers").delete().eq("id", id);

    if (error) {
      console.error("Driver DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
