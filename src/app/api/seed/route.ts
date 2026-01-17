import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { DEFAULT_REMARK_FIELDS, DEFAULT_USERS } from "@/lib/constants";

let seeded = false;

export async function POST() {
  if (seeded) {
    return NextResponse.json({ seeded: true, cached: true });
  }

  const supabase = getSupabaseAdmin();

  try {
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

    seeded = true;
    return NextResponse.json({ seeded: true });
  } catch (err) {
    console.error("Failed to seed database:", err);
    return NextResponse.json({ error: "Seeding failed" }, { status: 500 });
  }
}
