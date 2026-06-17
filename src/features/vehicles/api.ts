import { getSessionHeader } from "@/lib/auth";
import { fetchWithSession, OFFLINE_QUEUED_ERROR } from "@/lib/api-client";

export async function fetchVehicles(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
  try {
    const res = await fetch(`/api/vehicles?${query.toString()}`, {
      headers: { ...getSessionHeader() },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data && typeof data === "object") return data;
      return { error: "Failed to load vehicles", details: `${res.status} ${res.statusText}` };
    }
    if (!data || typeof data !== "object") {
      return { error: "Failed to load vehicles", details: "Empty response" };
    }
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { error: "Failed to load vehicles", details: message };
  }
}

export async function createVehicle(payload: Record<string, unknown>) {
  try {
    return await fetchWithSession<{ vehicle?: unknown; error?: string }>("/api/vehicles", {
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

export async function updateVehicle(payload: Record<string, unknown>) {
  try {
    return await fetchWithSession<{ vehicle?: unknown; error?: string }>("/api/vehicles", {
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

export async function deleteVehicle(id: string, soft = true) {
  try {
    return await fetchWithSession<{ error?: string }>("/api/vehicles", {
      method: "DELETE",
      body: JSON.stringify({ id, soft }),
    });
  } catch (err) {
    if (err instanceof Error && err.message === OFFLINE_QUEUED_ERROR) {
      return { queued: true } as { queued: true };
    }
    throw err;
  }
}

export async function importVehicles(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/vehicles/import", {
    method: "POST",
    headers: { ...getSessionHeader() },
    body: form,
  });
  return res.json();
}
