import { getSessionHeader } from "@/lib/auth";
import { buildExportUrl, toBase64 } from "@/lib/api-utils";

export { buildExportUrl };

export async function fetchAnalytics(filters?: Record<string, unknown>) {
  const query = new URLSearchParams();
  if (filters && Object.keys(filters).length > 0) {
    const raw = JSON.stringify(filters);
    query.set("filters", toBase64(raw));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`/api/analytics${suffix}`, { headers: { ...getSessionHeader() } });
  return res.json();
}
