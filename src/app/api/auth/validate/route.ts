import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/auth/validate
 * Checks if the current session is still valid (password hasn't changed since login).
 * Called on app load to detect stale sessions after password changes.
 */
export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) {
    return NextResponse.json({ valid: false, reason: "session_expired" });
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, password_changed_at")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ valid: false, reason: "user_not_found" });
  }

  // If password was changed AFTER this session was created, invalidate
  if (user.password_changed_at) {
    const changedAt = new Date(user.password_changed_at).getTime();
    if (changedAt > session.loginAt) {
      return NextResponse.json({ valid: false, reason: "password_changed" });
    }
  }

  return NextResponse.json({ valid: true });
}
