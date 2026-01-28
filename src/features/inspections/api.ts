import { getSessionHeader } from "@/lib/auth";
import { buildExportUrl, buildQueryParams } from "@/lib/api-utils";

export { buildExportUrl };

export async function fetchInspections(params: {
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}) {
  const query = buildQueryParams(params);
  const res = await fetch(`/api/events/inspections?${query}`, {
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
