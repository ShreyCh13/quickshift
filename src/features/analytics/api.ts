import { getSessionHeader } from "@/lib/auth";

function toBase64(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

export async function fetchAnalytics(filters?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (filters) {
    const raw = JSON.stringify(filters);
    query.set("filters", toBase64(raw));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`/api/analytics${suffix}`, { headers: { ...getSessionHeader() } });
  return res.json();
}

export function buildExportUrl(params: {
  type: "inspections" | "maintenance";
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
