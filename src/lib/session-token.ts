/**
 * Server-side session signing/verification (HMAC-SHA256).
 *
 * Sessions are stamped with a cryptographic signature the browser cannot
 * forge. The server verifies the signature on every request, so a client can
 * no longer fabricate a session or change its own role to "admin".
 *
 * The signing key is a dedicated SESSION_SECRET if provided, otherwise it
 * falls back to the already-present server-only SUPABASE_SERVICE_ROLE_KEY so
 * this works without any extra configuration. Neither value is ever exposed
 * to the browser (they are not NEXT_PUBLIC_*).
 *
 * This module is only ever invoked from server code (API routes). The
 * verification helpers fail closed: any tampering, bad signature, or missing
 * key yields `null` (treated as "not authenticated").
 */
import type { Session } from "./types";

function getSecret(): string {
  const secret =
    process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Missing SESSION_SECRET / SUPABASE_SERVICE_ROLE_KEY for session signing"
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(payloadB64: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return new Uint8Array(sig);
}

/** Build a signed token string: `<base64url(payload)>.<base64url(signature)>`. */
export async function signSession(session: Session): Promise<string> {
  const enc = new TextEncoder();
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(session)));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

/** Verify the signature and return the session, or `null` if invalid/tampered. */
export async function verifySessionToken(
  token: string | null | undefined
): Promise<Session | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  let expected: Uint8Array;
  let provided: Uint8Array;
  try {
    expected = await hmac(payloadB64);
    provided = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  // Constant-time comparison
  if (expected.length !== provided.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  if (diff !== 0) return null;

  try {
    const json = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const parsed = JSON.parse(json) as Session;
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
