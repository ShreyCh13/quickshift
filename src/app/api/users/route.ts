import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { DEFAULT_REMARK_FIELDS, DEFAULT_USERS } from "@/lib/constants";
import { requireRole, requireSession } from "@/lib/auth";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seedCheck = url.searchParams.get("seedCheck");
  const supabase = getSupabaseAdmin();

  if (seedCheck === "1") {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (!count || count === 0) {
      await supabase.from("users").insert(DEFAULT_USERS);
    }
    const { count: remarkCount } = await supabase
      .from("remark_fields")
      .select("*", { count: "exact", head: true });
    if (!remarkCount || remarkCount === 0) {
      await supabase.from("remark_fields").insert(DEFAULT_REMARK_FIELDS);
    }
    return NextResponse.json({ seeded: true });
  }

  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, role, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = userCreateSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .insert(input)
      .select("id, username, display_name, role, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data });
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
    const input = userUpdateSchema.parse(await req.json());
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select("id, username, display_name, role, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data });
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
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
