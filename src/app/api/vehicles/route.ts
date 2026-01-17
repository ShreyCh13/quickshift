import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { vehicleSchema } from "@/lib/validation";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const session = requireSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const isActive = url.searchParams.get("isActive");
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("vehicles")
      .select("id, vehicle_code, plate_number, brand, model, year, notes, is_active, created_at, updated_at", {
        count: "exact",
      });
    if (typeof search === "string" && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
    }
    if (isActive === "true") query = query.eq("is_active", true);
    if (isActive === "false") query = query.eq("is_active", false);

    const { data, error, count } = await query
      .order("vehicle_code", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("Failed to load vehicles:", error);
      return NextResponse.json({ error: "Failed to load vehicles", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ vehicles: data, total: count || 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("Failed to load vehicles:", err);
    return NextResponse.json({ error: "Failed to load vehicles", details: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = vehicleSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vehicles")
      .insert(input)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to create vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ vehicle: data });
  } catch (err) {
    console.error("Failed to parse vehicle create:", err);
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
    const input = vehicleSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...updates } = input;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vehicles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Failed to update vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ vehicle: data });
  } catch (err) {
    console.error("Failed to parse vehicle update:", err);
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
    const { id, soft } = (await req.json()) as { id?: string; soft?: boolean };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (soft !== false) {
      const { error } = await supabase.from("vehicles").update({ is_active: false }).eq("id", id);
      if (error) {
        console.error("Failed to soft delete vehicle:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, soft: true });
    }
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      console.error("Failed to hard delete vehicle:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, soft: false });
  } catch (err) {
    console.error("Failed to parse vehicle delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
