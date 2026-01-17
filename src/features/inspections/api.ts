import { getSessionHeader } from "@/lib/auth";

function toBase64(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

export async function fetchInspections(params: {
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
  const res = await fetch(`/api/events/inspections?${query.toString()}`, {
    headers: { ...getSessionHeader() },
  });
  return res.json();
}

export async function createInspection(payload: Record<string, unknown>) {
  const res = await fetch("/api/events/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateInspection(payload: Record<string, unknown>) {
  const res = await fetch("/api/events/inspections", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteInspection(id: string) {
  const res = await fetch("/api/events/inspections", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ id }),
  });
  return res.json();
}
