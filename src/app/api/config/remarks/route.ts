import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { remarkFieldSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const supabase = getSupabaseAdmin();
  let query = supabase.from("remark_fields").select("*");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) {
    console.error("Failed to load remark fields:", error);
    return NextResponse.json({ error: "Failed to load remark fields" }, { status: 500 });
  }
  return NextResponse.json({ remarkFields: data });
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin", "dev"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = remarkFieldSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("remark_fields").insert(input).select("*").single();
    if (error) {
      console.error("Failed to create remark field:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ remarkField: data });
  } catch (err) {
    console.error("Failed to parse remark field create:", err);
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
    const input = remarkFieldSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("remark_fields")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update remark field:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ remarkField: data });
  } catch (err) {
    console.error("Failed to parse remark field update:", err);
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
    
    // Get the remark field to check its field_key
    const { data: remarkField, error: fetchError } = await supabase
      .from("remark_fields")
      .select("field_key")
      .eq("id", id)
      .single();
    
    if (fetchError || !remarkField) {
      return NextResponse.json({ error: "Remark field not found" }, { status: 404 });
    }
    
    // Check if this remark field is used in any inspections
    // We search for the field_key in the remarks_json JSONB column
    const { count: usageCount, error: usageError } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .not("remarks_json", "is", null)
      .eq("is_deleted", false);
    
    // Note: A full JSONB key check would require a raw query, but for safety
    // we'll just deactivate rather than delete if there are any inspections
    if (usageError) {
      console.error("Failed to check remark field usage:", usageError);
    }
    
    // Soft delete by setting is_active to false instead of hard delete
    // This preserves data integrity and historical references
    const { error } = await supabase
      .from("remark_fields")
      .update({ is_active: false })
      .eq("id", id);
    
    if (error) {
      console.error("Failed to deactivate remark field:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      soft: true,
      message: "Remark field deactivated. It will no longer appear in new inspections but historical data is preserved."
    });
  } catch (err) {
    console.error("Failed to parse remark field delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
