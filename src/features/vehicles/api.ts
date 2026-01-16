import { getSessionHeader } from "@/lib/auth";

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
  const res = await fetch(`/api/vehicles?${query.toString()}`, {
    headers: { ...getSessionHeader() },
  });
  return res.json();
}

export async function createVehicle(payload: Record<string, unknown>) {
  const res = await fetch("/api/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateVehicle(payload: Record<string, unknown>) {
  const res = await fetch("/api/vehicles", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteVehicle(id: string, soft = true) {
  const res = await fetch("/api/vehicles", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ id, soft }),
  });
  return res.json();
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
