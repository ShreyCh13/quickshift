import { getSessionHeader } from "@/lib/auth";

function toBase64(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

export async function fetchMaintenance(params: {
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.filters) {
    const raw = JSON.stringify(params.filters);
    query.set("filters", toBase64(raw));
  }
  const res = await fetch(`/api/events/maintenance?${query.toString()}`, {
    headers: { ...getSessionHeader() },
  });
  return res.json();
}

export async function createMaintenance(payload: Record<string, unknown>) {
  const res = await fetch("/api/events/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}
