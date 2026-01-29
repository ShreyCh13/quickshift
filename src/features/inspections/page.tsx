"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession, clearSession } from "@/lib/auth";
import type { Session } from "@/lib/types";
import { buildExportUrl, updateInspection } from "./api";
import Skeleton from "@/components/Skeleton";
import { useInspectionsInfinite, useVehicleDropdown, useDeleteInspection, queryKeys } from "@/hooks/useQueries";

// Type matching what the hook returns (not full InspectionRow)
interface InspectionItem {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  driver_name: string | null;
  remarks_json: Record<string, string>;
  created_by?: string;
  vehicles: {
    vehicle_code: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  } | null;
  users?: {
    id: string;
    display_name: string;
  } | null;
}

export default function InspectionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user.role === "admin";

  // Get vehicles for dropdown
  const { data: vehicles = [] } = useVehicleDropdown();

  // Build filters for the query
  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (appliedFilters.vehicle_id) f.vehicle_id = appliedFilters.vehicle_id;
    if (appliedFilters.vehicle_query) f.vehicle_query = appliedFilters.vehicle_query;
    if (appliedFilters.date_from) f.date_from = appliedFilters.date_from;
    if (appliedFilters.date_to) f.date_to = appliedFilters.date_to;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [appliedFilters]);

  // React Query infinite query for inspections
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInspectionsInfinite(filters, 20);

  // Delete mutation
  const deleteMutation = useDeleteInspection();

  // Flatten paginated data
  const inspections: InspectionItem[] = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  // Handle unauthorized errors
  useEffect(() => {
    if (isError && error?.message === "Unauthorized") {
      clearSession();
      router.replace("/login");
    }
  }, [isError, error, router]);

  // Infinite scroll - load more when reaching bottom
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handleApplyFilters() {
    const f: Record<string, string> = {};
    if (vehicleFilter) f.vehicle_id = vehicleFilter;
    if (vehicleSearch) f.vehicle_query = vehicleSearch;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    setAppliedFilters(f);
  }

  async function handleExport() {
    const exportUrl = buildExportUrl({
      type: "inspections",
      format: "xlsx",
      filters: Object.keys(appliedFilters).length ? appliedFilters : undefined,
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
    
    // Extract filename from Content-Disposition header, fallback to default
    const disposition = res.headers.get("Content-Disposition");
    const filenameMatch = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "") : "inspections.xlsx";
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this inspection?")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      alert("Failed to delete: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleSaveEdit(itemId: string) {
    await updateInspection({ id: itemId, ...editDraft });
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all });
  }

  function handleStartEdit(item: InspectionItem) {
    setEditId(item.id);
    setEditDraft({
      vehicle_id: item.vehicle_id,
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
            <label className="text-xs font-medium text-slate-600">Search</label>
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search by vehicle code, plate, or name..."
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">From Date</label>
              <input
                type="date"
                value={dateFrom ? dateFrom.split('T')[0] : ''}
                onChange={(e) => setDateFrom(e.target.value ? `${e.target.value}T00:00` : '')}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
                placeholder="Start date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">To Date</label>
              <input
                type="date"
                value={dateTo ? dateTo.split('T')[0] : ''}
                onChange={(e) => setDateTo(e.target.value ? `${e.target.value}T23:59` : '')}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
                placeholder="End date"
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

        {/* Results count */}
        {total > 0 && (
          <div className="mb-3 text-sm text-slate-500">
            Showing {inspections.length} of {total} records
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
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
                        {item.vehicles?.brand && item.vehicles?.model && (
                          <div className="mt-0.5 text-sm text-blue-600 font-medium">
                            {item.vehicles.brand} {item.vehicles.model}
                          </div>
                        )}
                        <div className="mt-0.5 text-sm text-slate-600">
                          {new Date(item.created_at).toLocaleString()} - {item.odometer_km} km
                        </div>
                        {item.driver_name && (
                          <div className="mt-0.5 text-xs text-slate-500">Driver: {item.driver_name}</div>
                        )}
                        {item.users?.display_name && (
                          <div className="mt-0.5 text-xs text-slate-500">Added by: {item.users.display_name}</div>
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

            {/* Infinite scroll trigger */}
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
