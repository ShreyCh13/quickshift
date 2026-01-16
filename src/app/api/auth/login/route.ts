import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = loginSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("users")
      .select("id, username, password, display_name, role, created_at")
      .ilike("username", input.username)
      .limit(1)
      .maybeSingle();

    if (error || !data || data.password !== input.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        role: data.role,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
