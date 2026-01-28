import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { DEFAULT_REMARK_FIELDS, DEFAULT_USERS, DEFAULT_VEHICLES } from "@/lib/constants";

let seeded = false;

export async function POST() {
  if (seeded) {
    return NextResponse.json({ seeded: true, cached: true });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Seed users if empty
    const { count: userCount } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (!userCount || userCount === 0) {
      await supabase.from("users").insert(DEFAULT_USERS);
    }

    // Seed remark fields if empty
    const { count: remarkCount } = await supabase
      .from("remark_fields")
      .select("*", { count: "exact", head: true });
    if (!remarkCount || remarkCount === 0) {
      await supabase.from("remark_fields").insert(DEFAULT_REMARK_FIELDS);
    }

    // Seed vehicles if empty
    const { count: vehicleCount } = await supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true });
    if (!vehicleCount || vehicleCount === 0) {
      // Insert vehicles in batches to avoid payload size issues
      const batchSize = 20;
      for (let i = 0; i < DEFAULT_VEHICLES.length; i += batchSize) {
        const batch = DEFAULT_VEHICLES.slice(i, i + batchSize);
        const { error } = await supabase.from("vehicles").insert(batch);
        if (error) {
          console.error("Failed to seed vehicles batch:", error);
        }
      }
    }

    seeded = true;
    return NextResponse.json({ seeded: true });
  } catch (err) {
    console.error("Failed to seed database:", err);
    return NextResponse.json({ error: "Seeding failed" }, { status: 500 });
  }
}
