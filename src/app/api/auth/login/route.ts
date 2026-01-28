import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, rateLimitPresets, rateLimitHeaders, blockIp } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";

// Track failed attempts for progressive blocking
const failedAttempts = new Map<string, number>();

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rateLimitKey = `login:${ip}`;
  
  // Check rate limit
  const rateLimit = checkRateLimit(
    rateLimitKey,
    rateLimitPresets.login.limit,
    rateLimitPresets.login.windowMs
  );
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { 
        status: 429,
        headers: rateLimitHeaders(rateLimit),
      }
    );
  }
  
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

    if (error) {
      console.error("Failed to query user:", error);
      return NextResponse.json(
        { error: "Login failed" },
        { status: 500, headers: rateLimitHeaders(rateLimit) }
      );
    }

    // Verify password (supports both hashed and plaintext for migration)
    let passwordValid = false;
    if (data) {
      passwordValid = await verifyPassword(input.password, data.password);
    }

    if (!data || !passwordValid) {
      // Track failed attempts
      const attempts = (failedAttempts.get(ip) || 0) + 1;
      failedAttempts.set(ip, attempts);
      
      // Block IP after 10 consecutive failures
      if (attempts >= 10) {
        blockIp(ip, 30 * 60 * 1000); // Block for 30 minutes
        failedAttempts.delete(ip);
        console.warn(`IP ${ip} blocked after ${attempts} failed login attempts`);
      }
      
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401, headers: rateLimitHeaders(rateLimit) }
      );
    }

    // Reset failed attempts on successful login
    failedAttempts.delete(ip);

    return NextResponse.json(
      {
        user: {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          role: data.role,
          createdAt: data.created_at,
        },
      },
      { headers: rateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Bad request" },
      { status: 400, headers: rateLimitHeaders(rateLimit) }
    );
  }
}
