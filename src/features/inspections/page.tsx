"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession } from "@/lib/auth";
import type { Session, InspectionRow, VehicleRow } from "@/lib/types";
import { buildExportUrl, fetchInspections, deleteInspection, updateInspection } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

interface InspectionItemWithVehicle extends InspectionRow {
  vehicles?: {
    vehicle_code: string;
    plate_number?: string;
    brand?: string;
    model?: string;
  };
}

export default function InspectionsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [inspections, setInspections] = useState<InspectionItemWithVehicle[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const isAdmin = session?.user.role === "admin";

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (session) {
      loadVehicles();
      loadInspections(1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function loadVehicles() {
    const res = await fetchVehicles({ page: 1, pageSize: 200 });
    setVehicles(res.vehicles || []);
  }

  const getFilters = useCallback(() => {
    const filters: Record<string, unknown> = {};
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (vehicleSearch) filters.vehicle_query = vehicleSearch;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    return filters;
  }, [vehicleFilter, vehicleSearch, dateFrom, dateTo]);

  async function loadInspections(pageNum: number = 1, reset: boolean = false) {
    setLoading(true);
    const filters = getFilters();
    const res = await fetchInspections({ filters, page: pageNum, pageSize: PAGE_SIZE });

    if (reset) {
      setInspections(res.inspections || []);
    } else {
      setInspections((prev) => [...prev, ...(res.inspections || [])]);
    }

    setTotal(res.total || 0);
    setHasMore((res.inspections || []).length === PAGE_SIZE);
    setPage(pageNum);
    setLoading(false);
  }

  function handleApplyFilters() {
    setPage(1);
    loadInspections(1, true);
  }

  function handleLoadMore() {
    if (!loading && hasMore) {
      loadInspections(page + 1, false);
    }
  }

  async function handleExport() {
    const filters = getFilters();
    const exportUrl = buildExportUrl({
      type: "inspections",
      format: "xlsx",
      filters: Object.keys(filters).length ? filters : undefined,
    });
    const res = await fetch(exportUrl, { headers: { ...getSessionHeader() } });
    if (!res.ok) {
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "inspections.xlsx";
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inspection?")) return;
    const res = await deleteInspection(id);
    if (!res.error) loadInspections(1, true);
  }

  async function handleSaveEdit(itemId: string) {
    await updateInspection({ id: itemId, ...editDraft });
    setEditId(null);
    loadInspections(1, true);
  }

  function handleStartEdit(item: InspectionItemWithVehicle) {
    setEditId(item.id);
    setEditDraft({
      odometer_km: item.odometer_km,
      driver_name: item.driver_name || "",
      remarks_json: item.remarks_json || {},
    });
  }

  if (!session) return null;

  return (
    <MobileShell title="Inspections">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-24">
        {/* Quick Add Button */}
        <button
          onClick={() => router.push("/inspections/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98]"
        >
          + New Inspection
        </button>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <h3 className="font-bold text-slate-900">Filters</h3>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicle_code} {v.plate_number ? `(${v.plate_number})` : ""} - {v.brand} {v.model}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            placeholder="Search by vehicle code or plate..."
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
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

        {/* Results count */}
        {total > 0 && (
          <div className="mb-3 text-sm text-slate-500">
            Showing {inspections.length} of {total} records
          </div>
        )}

        {/* List */}
        {loading && inspections.length === 0 ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
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
                          {item.vehicles?.vehicle_code || `Vehicle ID: ${item.vehicle_id?.substring(0, 8) || "Unknown"}`}
                          {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-600">
                          {new Date(item.created_at).toLocaleString()} - {item.odometer_km} km
                        </div>
                        {item.driver_name && (
                          <div className="mt-0.5 text-xs text-slate-500">Driver: {item.driver_name}</div>
                        )}
                      </div>
                      <span className="text-blue-600">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-blue-100 bg-blue-50 p-4">
                      <h4 className="mb-2 font-semibold text-slate-900">Inspection Details:</h4>
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="number"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                            value={String(editDraft.odometer_km || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                            placeholder="Odometer (km)"
                          />
                          <input
                            type="text"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                            value={String(editDraft.driver_name || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, driver_name: e.target.value })}
                            placeholder="Driver Name"
                          />
                          <div className="space-y-2">
                            {Object.entries((editDraft.remarks_json as Record<string, string>) || {}).map(
                              ([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <span className="w-28 text-xs font-semibold text-slate-600">{key}</span>
                                  <input
                                    className="flex-1 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                    value={value}
                                    onChange={(e) =>
                                      setEditDraft({
                                        ...editDraft,
                                        remarks_json: {
                                          ...(editDraft.remarks_json as Record<string, string>),
                                          [key]: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                </div>
                              )
                            )}
                          </div>
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
                        <>
                          <div className="space-y-1 text-sm">
                            {Object.entries(item.remarks_json || {}).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium text-slate-700">{key}:</span>
                                <span className="text-slate-600">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                          {canEdit && (
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white active:bg-red-700"
                                >
                                  Delete
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

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full rounded-xl border-2 border-blue-200 bg-white py-3 font-semibold text-blue-600 active:bg-blue-50 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
