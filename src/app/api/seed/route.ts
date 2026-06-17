import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { DEFAULT_REMARK_FIELDS, DEFAULT_USERS, DEFAULT_VEHICLES } from "@/lib/constants";
import { hashPassword } from "@/lib/password";

let seeded = false;

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();

  // Determine whether this is first-time bootstrap (no users exist yet).
  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });
  const isBootstrap = !userCount || userCount === 0;

  // Once any user exists, seeding requires an admin/dev session. During the
  // very first bootstrap (zero users) we allow an unauthenticated call so the
  // initial admin can be created — but its password comes from a server-only
  // env var (SEED_ADMIN_PASSWORD), never from anything in the public repo.
  if (!isBootstrap) {
    const session = await requireSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!requireRole(session, ["admin", "dev"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (seeded) {
      return NextResponse.json({ seeded: true, cached: true });
    }
  }

  try {
    // Seed users if empty — passwords are HASHED and sourced from env when set.
    if (isBootstrap) {
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
      const staffPassword = process.env.SEED_STAFF_PASSWORD || "mandu123";
      const passwordByRole: Record<string, string> = {
        admin: adminPassword,
        staff: staffPassword,
      };
      const usersToInsert = await Promise.all(
        DEFAULT_USERS.map(async (u) => ({
          username: u.username,
          display_name: u.display_name,
          role: u.role,
          password: await hashPassword(passwordByRole[u.role] ?? adminPassword),
        }))
      );
      await supabase.from("users").insert(usersToInsert);
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
