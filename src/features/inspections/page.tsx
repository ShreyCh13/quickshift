"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import MobileShell from "@/components/MobileShell";
import Autocomplete from "@/components/Autocomplete";
import { getSessionHeader, loadSession, clearSession } from "@/lib/auth";
import type { Session, ChecklistItem } from "@/lib/types";
import { buildExportUrl, updateInspection } from "./api";
import Skeleton from "@/components/Skeleton";
import { useInspectionsInfinite, useVehicleDropdown, useDeleteInspection, queryKeys } from "@/hooks/useQueries";
import { INSPECTION_CATEGORIES } from "@/lib/constants";

interface InspectionItem {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  driver_name: string | null;
  remarks_json: Record<string, ChecklistItem>;
  created_by?: string;
  vehicles: {
    vehicle_code: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  } | null;
  users?: { id: string; display_name: string } | null;
}

function fetchDriverSuggestions(search: string): Promise<string[]> {
  const params = new URLSearchParams({ active: "true" });
  if (search.trim()) params.set("search", search.trim());
  return fetch(`/api/drivers?${params}`, { headers: getSessionHeader() })
    .then((r) => r.json())
    .then((d) => (d.drivers || []).map((dr: { name: string }) => dr.name))
    .catch(() => []);
}

async function addDriver(name: string) {
  await fetch("/api/drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ name }),
  });
}

export default function InspectionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    odometer_km: number;
    driver_name: string;
    remarks_json: Record<string, ChecklistItem>;
  }>({ odometer_km: 0, driver_name: "", remarks_json: {} });
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user.role === "admin";
  const { data: vehicles = [] } = useVehicleDropdown();

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (appliedFilters.vehicle_id) f.vehicle_id = appliedFilters.vehicle_id;
    if (appliedFilters.vehicle_query) f.vehicle_query = appliedFilters.vehicle_query;
    if (appliedFilters.driver_name) f.driver_name = appliedFilters.driver_name;
    if (appliedFilters.date_from) f.date_from = appliedFilters.date_from;
    if (appliedFilters.date_to) f.date_to = appliedFilters.date_to;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [appliedFilters]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useInspectionsInfinite(filters, 20);

  const deleteMutation = useDeleteInspection();
  const inspections: InspectionItem[] = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/login"); return; }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (isError && error?.message === "Unauthorized") {
      clearSession();
      router.replace("/login");
    }
  }, [isError, error, router]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handleApplyFilters() {
    const f: Record<string, string> = {};
    if (vehicleFilter) f.vehicle_id = vehicleFilter;
    if (vehicleSearch) f.vehicle_query = vehicleSearch;
    if (driverSearch) f.driver_name = driverSearch;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    setAppliedFilters(f);
  }

  function handleClearFilters() {
    setVehicleFilter("");
    setVehicleSearch("");
    setDriverSearch("");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({});
  }

  async function handleExport() {
    const exportUrl = buildExportUrl({
      type: "inspections",
      format: "xlsx",
      filters: Object.keys(appliedFilters).length ? appliedFilters : undefined,
    });
    const res = await fetch(exportUrl, { headers: { ...getSessionHeader() } });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    link.download = match ? match[1].replace(/['"]/g, "") : "inspections.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inspection?")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      alert("Failed to delete: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  function handleStartEdit(item: InspectionItem) {
    setEditId(item.id);
    setEditDraft({
      odometer_km: item.odometer_km,
      driver_name: item.driver_name || "",
      remarks_json: JSON.parse(JSON.stringify(item.remarks_json || {})),
    });
    setExpandedId(item.id);
  }

  async function handleSaveEdit(itemId: string) {
    // Validate remarks required for failed items
    for (const [key, item] of Object.entries(editDraft.remarks_json)) {
      if (!item.ok && !item.remarks.trim()) {
        alert(`Remarks required for failed item: ${key}`);
        return;
      }
    }
    await updateInspection({ id: itemId, ...editDraft });
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all });
  }

  function setEditItem(key: string, patch: Partial<ChecklistItem>) {
    setEditDraft((prev) => ({
      ...prev,
      remarks_json: { ...prev.remarks_json, [key]: { ...prev.remarks_json[key], ...patch } },
    }));
  }

  if (!session) return null;

  return (
    <MobileShell title="Inspections">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-24">
        <button
          onClick={() => router.push("/inspections/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98]"
        >
          + New Inspection
        </button>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Filters</h3>
            {Object.keys(appliedFilters).length > 0 && (
              <button onClick={handleClearFilters} className="text-xs font-medium text-blue-600 active:text-blue-800">
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Vehicle</label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_code} {v.plate_number ? `(${v.plate_number})` : ""} - {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Search (vehicle code / plate)</label>
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search vehicles..."
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Driver Name</label>
            <input
              type="text"
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              placeholder="Search by driver name..."
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={dateFrom ? dateFrom.split("T")[0] : ""}
                onChange={(e) => setDateFrom(e.target.value ? `${e.target.value}T00:00` : "")}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={dateTo ? dateTo.split("T")[0] : ""}
                onChange={(e) => setDateTo(e.target.value ? `${e.target.value}T23:59` : "")}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleApplyFilters}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white active:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={handleExport}
              className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white active:bg-slate-800"
            >
              Export
            </button>
          </div>
        </div>

        {total > 0 && (
          <div className="mb-3 text-sm text-slate-500">
            Showing {inspections.length} of {total} records
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : inspections.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-slate-500">No inspections found</p>
            <p className="mt-2 text-sm text-slate-400">Click &quot;New Inspection&quot; to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((item) => {
              const canEdit = isAdmin || item.created_by === session?.user.id;
              const isExpanded = expandedId === item.id;
              const isEditing = canEdit && editId === item.id;

              // Compute pass/fail counts
              const allItems = Object.values(item.remarks_json || {});
              const failCount = allItems.filter((i) => !i.ok).length;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border-2 border-blue-100 bg-white shadow-sm"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full p-4 text-left active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-slate-900">
                          {item.vehicles?.vehicle_code || `Vehicle ${item.vehicle_id?.substring(0, 8)}`}
                          {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                        </div>
                        {item.vehicles?.brand && item.vehicles?.model && (
                          <div className="mt-0.5 text-sm font-medium text-blue-600">
                            {item.vehicles.brand} {item.vehicles.model}
                          </div>
                        )}
                        <div className="mt-0.5 text-sm text-slate-600">
                          {new Date(item.created_at).toLocaleString()} · {item.odometer_km.toLocaleString()} km
                        </div>
                        {item.driver_name && (
                          <div className="mt-0.5 text-xs text-slate-500">Driver: {item.driver_name}</div>
                        )}
                        {item.users?.display_name && (
                          <div className="mt-0.5 text-xs text-slate-400">By: {item.users.display_name}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {failCount > 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                            {failCount} issue{failCount > 1 ? "s" : ""}
                          </span>
                        ) : allItems.length > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            All OK
                          </span>
                        ) : null}
                        <span className="text-blue-600">{isExpanded ? "▼" : "▶"}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-blue-100 bg-blue-50 p-4">
                      {isEditing ? (
                        /* ---- EDIT MODE ---- */
                        <div className="space-y-4">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Odometer (km)</label>
                            <input
                              type="number"
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                              value={editDraft.odometer_km}
                              onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                            />
                          </div>
                          <Autocomplete
                            label="Driver Name"
                            value={editDraft.driver_name}
                            onChange={(v) => setEditDraft({ ...editDraft, driver_name: v })}
                            onAddNew={addDriver}
                            fetchSuggestions={fetchDriverSuggestions}
                            placeholder="Search or add driver..."
                            accentColor="blue"
                          />
                          {/* Checklist edit by category */}
                          {INSPECTION_CATEGORIES.map((cat) => (
                            <div key={cat.key} className="overflow-hidden rounded-lg bg-white">
                              <div className="bg-blue-600 px-3 py-2">
                                <span className="text-xs font-bold uppercase text-white">{cat.label}</span>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {cat.fields.map((field) => {
                                  const editItem = editDraft.remarks_json[field.key] || { ok: true, remarks: "" };
                                  return (
                                    <div key={field.key} className={`px-3 py-2.5 ${!editItem.ok ? "bg-red-50" : ""}`}>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditItem(field.key, { ok: !editItem.ok })}
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                            editItem.ok
                                              ? "border-emerald-500 bg-emerald-500 text-white"
                                              : "border-red-400 bg-white text-red-400"
                                          }`}
                                        >
                                          {editItem.ok ? "✓" : "✗"}
                                        </button>
                                        <span className={`flex-1 text-xs font-medium ${editItem.ok ? "text-slate-700" : "text-red-700"}`}>
                                          {field.label}
                                        </span>
                                      </div>
                                      {!editItem.ok && (
                                        <div className="mt-1.5 pl-8">
                                          <input
                                            className="w-full rounded border-2 border-red-300 px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none"
                                            value={editItem.remarks}
                                            onChange={(e) => setEditItem(field.key, { remarks: e.target.value })}
                                            placeholder="Describe the issue *"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="flex-1 rounded-lg border-2 border-slate-300 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ---- VIEW MODE ---- */
                        <>
                          {INSPECTION_CATEGORIES.map((cat) => {
                            const catItems = cat.fields.map((f) => ({
                              ...f,
                              item: item.remarks_json[f.key],
                            }));
                            const catFailCount = catItems.filter((c) => c.item && !c.item.ok).length;
                            return (
                              <div key={cat.key} className="mb-3 overflow-hidden rounded-lg bg-white">
                                <div className="flex items-center justify-between bg-slate-100 px-3 py-2">
                                  <span className="text-xs font-bold uppercase text-slate-600">{cat.label}</span>
                                  {catFailCount > 0 ? (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                                      {catFailCount} issue{catFailCount > 1 ? "s" : ""}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-emerald-600">✓ OK</span>
                                  )}
                                </div>
                                <div className="divide-y divide-slate-50 px-3 py-1">
                                  {catItems.map(({ key, label, item: ci }) => (
                                    <div key={key} className="flex items-start gap-2 py-1.5">
                                      <span
                                        className={`mt-0.5 shrink-0 text-sm font-bold ${
                                          ci?.ok !== false ? "text-emerald-500" : "text-red-500"
                                        }`}
                                      >
                                        {ci?.ok !== false ? "✓" : "✗"}
                                      </span>
                                      <div className="flex-1">
                                        <span className="text-xs text-slate-700">{label}</span>
                                        {ci && !ci.ok && ci.remarks && (
                                          <div className="mt-0.5 text-xs italic text-red-600">{ci.remarks}</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {canEdit && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deleteMutation.isPending}
                                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50"
                                >
                                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={loadMoreRef} className="py-4 text-center">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Loading more...
                </div>
              )}
              {!hasNextPage && inspections.length > 0 && (
                <p className="text-sm text-slate-400">All inspections loaded</p>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
