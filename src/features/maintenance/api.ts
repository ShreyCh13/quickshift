import { getSessionHeader } from "@/lib/auth";
import { fetchWithSession, OFFLINE_QUEUED_ERROR } from "@/lib/api-client";
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
  try {
    return await fetchWithSession<{ maintenance?: unknown; error?: string }>("/api/events/maintenance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof Error && err.message === OFFLINE_QUEUED_ERROR) {
      return { queued: true } as { queued: true };
    }
    throw err;
  }
}

export async function updateMaintenance(payload: Record<string, unknown>) {
  try {
    return await fetchWithSession<{ maintenance?: unknown; error?: string }>("/api/events/maintenance", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof Error && err.message === OFFLINE_QUEUED_ERROR) {
      return { queued: true } as { queued: true };
    }
    throw err;
  }
}

export async function deleteMaintenance(id: string) {
  try {
    return await fetchWithSession<{ error?: string }>("/api/events/maintenance", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  } catch (err) {
    if (err instanceof Error && err.message === OFFLINE_QUEUED_ERROR) {
      return { queued: true } as { queued: true };
    }
    throw err;
  }
}
