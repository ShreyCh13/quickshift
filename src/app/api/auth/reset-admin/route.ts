import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { DEFAULT_USERS } from "@/lib/constants";

/**
 * Emergency admin password reset endpoint.
 * Resets the admin account to default credentials and clears all rate limits.
 * Only use when locked out of the system.
 */
export async function POST() {
  const adminDefault = DEFAULT_USERS.find((u) => u.role === "admin");
  if (!adminDefault) {
    return NextResponse.json({ error: "No default admin found" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("users")
    .update({
      password: adminDefault.password,
      password_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("username", adminDefault.username);

  if (error) {
    console.error("Failed to reset admin password:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }

  // Clear all in-memory rate limits and IP blocks
  clearAllRateLimits();

  return NextResponse.json({
    success: true,
    message: `Admin password reset to default. You can now log in with username "${adminDefault.username}" and password "${adminDefault.password}".`,
  });
}
