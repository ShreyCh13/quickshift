import { SESSION_STORAGE_KEY, SESSION_TTL_MS } from "./constants";
import type { Role, Session } from "./types";

export function parseSessionFromRequest(req: Request): Session | null {
  const headerSession = req.headers.get("x-qs-session");
  if (headerSession) {
    return parseSessionJson(headerSession);
  }
  return null;
}

export function isSessionValid(session: Session | null): session is Session {
  if (!session?.loginAt || !session.user) return false;
  return Date.now() - session.loginAt <= SESSION_TTL_MS;
}

export function requireSession(req: Request) {
  const session = parseSessionFromRequest(req);
  if (!isSessionValid(session)) return null;
  return session;
}

export function requireRole(session: Session, roles: Role[]) {
  return roles.includes(session.user.role);
}

function parseSessionJson(raw: string): Session | null {
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}


export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  const session = parseSessionJson(raw);
  if (!isSessionValid(session)) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  return session;
}

export function saveSession(session: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getSessionHeader(): Record<string, string> {
  const session = loadSession();
  if (!session) return {};
  return { "x-qs-session": JSON.stringify(session) };
}
