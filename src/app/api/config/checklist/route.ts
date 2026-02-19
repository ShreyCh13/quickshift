import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { checklistItemConfigSchema as checklistItemSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const supabase = getSupabaseAdmin();
  let query = supabase.from("checklist_items").select("*");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load checklist items:", error);
    return NextResponse.json({ error: "Failed to load checklist items" }, { status: 500 });
  }
  return NextResponse.json({ checklistItems: data });
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "dev"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = checklistItemSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ ...input, created_by: session.user.id })
      .select("*")
      .single();
    if (error) {
      console.error("Failed to create checklist item:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ checklistItem: data });
  } catch (err) {
    console.error("Failed to parse checklist item create:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "dev"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = checklistItemSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ ...updates, updated_by: session.user.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update checklist item:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ checklistItem: data });
  } catch (err) {
    console.error("Failed to parse checklist item update:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "dev"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    // Soft-delete to preserve historical inspection data
    const { error } = await supabase
      .from("checklist_items")
      .update({ is_active: false, updated_by: session.user.id })
      .eq("id", id);
    if (error) {
      console.error("Failed to deactivate checklist item:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse checklist item delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
