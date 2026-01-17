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
