import { getSessionHeader } from "@/lib/auth";
import { buildExportUrl, buildQueryParams } from "@/lib/api-utils";

export { buildExportUrl };

export async function fetchMaintenance(params: {
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}) {
  const query = buildQueryParams(params);
  const res = await fetch(`/api/events/maintenance?${query}`, {
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

export async function updateMaintenance(payload: Record<string, unknown>) {
  const res = await fetch("/api/events/maintenance", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteMaintenance(id: string) {
  const res = await fetch("/api/events/maintenance", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ id }),
  });
  return res.json();
}
