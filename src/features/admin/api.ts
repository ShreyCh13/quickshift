import { getSessionHeader } from "@/lib/auth";

function toBase64(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

export async function fetchUsers() {
  const res = await fetch("/api/users", { headers: { ...getSessionHeader() } });
  return res.json();
}

export async function createUser(payload: Record<string, unknown>) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateUser(payload: Record<string, unknown>) {
  const res = await fetch("/api/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch("/api/users", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export async function fetchRemarkFields(activeOnly = false) {
  const query = activeOnly ? "?activeOnly=1" : "";
  const res = await fetch(`/api/config/remarks${query}`, { headers: { ...getSessionHeader() } });
  return res.json();
}

export async function createRemarkField(payload: Record<string, unknown>) {
  const res = await fetch("/api/config/remarks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateRemarkField(payload: Record<string, unknown>) {
  const res = await fetch("/api/config/remarks", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteRemarkField(id: string) {
  const res = await fetch("/api/config/remarks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export function buildExportUrl(params: {
  type: "vehicles" | "inspections" | "maintenance";
  format: "xlsx" | "csv";
  filters?: Record<string, unknown>;
}) {
  const query = new URLSearchParams();
  query.set("type", params.type);
  query.set("format", params.format);
  if (params.filters) {
    const raw = JSON.stringify(params.filters);
    query.set("filters", toBase64(raw));
  }
  return `/api/export?${query.toString()}`;
}
