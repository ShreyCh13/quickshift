import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";
import { hashPassword, validatePasswordStrength } from "@/lib/password";

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  // Don't return passwords to the client - security best practice
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name, role, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load users:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
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
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors.join(", ") }, { status: 400 });
    }
    
    // Hash the password before storing
    const hashedPassword = await hashPassword(input.password);
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .insert({
        ...input,
        password: hashedPassword,
      })
      .select("id, username, display_name, role, created_at")
      .single();
    if (error) {
      console.error("Failed to create user:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("Failed to parse user create:", err);
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
    const { id, password, ...otherUpdates } = input;
    
    // If password is being updated, validate and hash it
    let updates: Record<string, unknown> = { ...otherUpdates };
    if (password) {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return NextResponse.json({ error: passwordValidation.errors.join(", ") }, { status: 400 });
      }
      updates.password = await hashPassword(password);
    }
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select("id, username, display_name, role, created_at")
      .single();
    if (error) {
      console.error("Failed to update user:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("Failed to parse user update:", err);
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
    if (error) {
      console.error("Failed to delete user:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to parse user delete:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
