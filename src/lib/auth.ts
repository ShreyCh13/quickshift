import { SESSION_STORAGE_KEY, SESSION_TTL_MS } from "./constants";
import type { Role, Session } from "./types";
import { verifySessionToken } from "./session-token";

export function isSessionValid(session: Session | null): session is Session {
  if (!session?.loginAt || !session.user) return false;
  return Date.now() - session.loginAt <= SESSION_TTL_MS;
}

// ============================================================
// SERVER-SIDE — verify the cryptographically signed token
// ============================================================

/**
 * Validate the request's session by VERIFYING the signature on the
 * `x-sf-session` token. A forged or tampered token fails verification and
 * yields `null`, so the role inside a verified session can be trusted.
 */
export async function requireSession(req: Request): Promise<Session | null> {
  const token = req.headers.get("x-sf-session");
  const session = await verifySessionToken(token);
  if (!isSessionValid(session)) return null;
  return session;
}

export function requireRole(session: Session, roles: Role[]) {
  return roles.includes(session.user.role);
}

// ============================================================
// CLIENT-SIDE — store the opaque token; decode (NOT verify) for UI display.
// The browser cannot verify the signature (no secret); the server re-verifies
// on every request, so client-side decoding is for display only.
// ============================================================

function base64UrlToString(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  // decodeURIComponent(escape(...)) decodes UTF-8 bytes back into a JS string
  return decodeURIComponent(escape(atob(b64 + pad)));
}

export function decodeSessionPayload(token: string): Session | null {
  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const parsed = JSON.parse(base64UrlToString(payloadB64)) as Session;
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) return null;
  const session = decodeSessionPayload(token);
  if (!isSessionValid(session)) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  return session;
}

/** Persist the signed token returned by the login endpoint. */
export function saveSessionToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getSessionHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) return {};
  return { "x-sf-session": token };
}
