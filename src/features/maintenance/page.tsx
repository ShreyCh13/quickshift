"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession, clearSession } from "@/lib/auth";
import type { Session } from "@/lib/types";
import { buildExportUrl, updateMaintenance } from "./api";
import Skeleton from "@/components/Skeleton";
import { useMaintenanceInfinite, useVehicleDropdown, useDeleteMaintenance, queryKeys } from "@/hooks/useQueries";

// Type matching what the hook returns (not full MaintenanceRow)
interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  amount: number;
  remarks: string;
  created_by?: string;
  vehicles: {
    vehicle_code: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  } | null;
}

export default function MaintenancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
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
    if (appliedFilters.supplier) f.supplier = appliedFilters.supplier;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [appliedFilters]);

  // React Query infinite query for maintenance
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useMaintenanceInfinite(filters, 20);

  // Delete mutation
  const deleteMutation = useDeleteMaintenance();

  // Flatten paginated data
  const maintenance: MaintenanceItem[] = data?.pages.flatMap((page) => page.data) ?? [];
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
    if (supplierFilter) f.supplier = supplierFilter;
    setAppliedFilters(f);
  }

  async function handleExport() {
    const exportUrl = buildExportUrl({
      type: "maintenance",
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
    const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "") : "maintenance.xlsx";
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this maintenance record?")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      alert("Failed to delete: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleSaveEdit(itemId: string) {
    await updateMaintenance({ id: itemId, ...editDraft });
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
  }

  function handleStartEdit(item: MaintenanceItem) {
    setEditId(item.id);
    setEditDraft({
      vehicle_id: item.vehicle_id,
      odometer_km: item.odometer_km,
      bill_number: item.bill_number,
      supplier_name: item.supplier_name,
      amount: item.amount,
      remarks: item.remarks,
    });
  }

  if (!session) return null;

  return (
    <MobileShell title="Maintenance">
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4 pb-24">
        {/* Quick Add Button */}
        <button
          onClick={() => router.push("/maintenance/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98]"
        >
          + New Maintenance
        </button>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <h3 className="font-bold text-slate-900">Filters</h3>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
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
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="text"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            placeholder="Filter by supplier..."
            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleApplyFilters}
              className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white active:bg-emerald-700"
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
            Showing {maintenance.length} of {total} records
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : maintenance.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-slate-500">No maintenance records found</p>
            <p className="mt-2 text-sm text-slate-400">Click &quot;New Maintenance&quot; to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {maintenance.map((item) => {
              const canEdit = isAdmin || item.created_by === session?.user.id;
              const isExpanded = expandedId === item.id;
              const isEditing = canEdit && editId === item.id;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border-2 border-emerald-100 bg-white shadow-sm"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full p-4 text-left active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-slate-900">
                          {item.vehicles?.vehicle_code || `Vehicle ID: ${item.vehicle_id?.substring(0, 8)}`}
                          {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                        </div>
                        {item.vehicles?.brand && item.vehicles?.model && (
                          <div className="mt-0.5 text-sm text-emerald-600 font-medium">
                            {item.vehicles.brand} {item.vehicles.model}
                          </div>
                        )}
                        <div className="mt-0.5 text-sm text-slate-600">
                          {new Date(item.created_at).toLocaleString()} - {item.odometer_km} km
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {item.supplier_name} - Bill: {item.bill_number}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-600">
                          ₹{Number(item.amount).toLocaleString()}
                        </div>
                        <span className="text-emerald-600">{isExpanded ? "▼" : "▶"}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-emerald-100 bg-emerald-50 p-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="number"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                            value={String(editDraft.odometer_km || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                            placeholder="Odometer (km)"
                          />
                          <input
                            type="text"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                            value={String(editDraft.bill_number || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, bill_number: e.target.value })}
                            placeholder="Bill Number"
                          />
                          <input
                            type="text"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                            value={String(editDraft.supplier_name || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, supplier_name: e.target.value })}
                            placeholder="Supplier"
                          />
                          <input
                            type="number"
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                            value={String(editDraft.amount || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, amount: Number(e.target.value) })}
                            placeholder="Amount"
                          />
                          <textarea
                            className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                            rows={3}
                            value={String(editDraft.remarks || "")}
                            onChange={(e) => setEditDraft({ ...editDraft, remarks: e.target.value })}
                            placeholder="Remarks"
                          />
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white active:bg-emerald-700"
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
                          <div className="mb-2 text-xs font-medium text-slate-500">Remarks:</div>
                          <div className="mb-3 text-sm text-slate-700">{item.remarks || "No remarks"}</div>
                          {canEdit && (
                            <div className="flex gap-2">
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
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  Loading more...
                </div>
              )}
              {!hasNextPage && maintenance.length > 0 && (
                <p className="text-sm text-slate-400">All maintenance records loaded</p>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
