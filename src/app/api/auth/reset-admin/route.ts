import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { DEFAULT_USERS } from "@/lib/constants";

/**
 * Emergency admin password reset endpoint.
 * Resets the admin account to default credentials and clears all rate limits.
 * Finds admin by role (not username) so it works even if username was changed.
 * Only use when locked out of the system.
 */
export async function POST() {
  const adminDefault = DEFAULT_USERS.find((u) => u.role === "admin");
  if (!adminDefault) {
    return NextResponse.json({ error: "No default admin found" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Find the admin user by role (handles username changes)
  const { data: adminUser, error: fetchError } = await supabase
    .from("users")
    .select("id, username")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (fetchError || !adminUser) {
    console.error("Failed to find admin user:", fetchError);
    return NextResponse.json({ error: "No admin user found in database" }, { status: 404 });
  }

  // Reset username back to default AND reset password
  const { error: updateError } = await supabase
    .from("users")
    .update({
      username: adminDefault.username,
      password: adminDefault.password,
      password_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", adminUser.id);

  if (updateError) {
    console.error("Failed to reset admin credentials:", updateError);
    return NextResponse.json({ error: "Failed to reset credentials" }, { status: 500 });
  }

  // Clear all in-memory rate limits and IP blocks
  clearAllRateLimits();

  return NextResponse.json({
    success: true,
    message: `Admin reset successful. Log in with username "${adminDefault.username}" and password "${adminDefault.password}".`,
    previousUsername: adminUser.username,
  });
}
