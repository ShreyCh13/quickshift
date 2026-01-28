"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession } from "@/lib/auth";
import type { Session, MaintenanceRow, VehicleRow } from "@/lib/types";
import { buildExportUrl, fetchMaintenance, deleteMaintenance, updateMaintenance } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

interface MaintenanceItemWithVehicle extends MaintenanceRow {
  vehicles?: {
    vehicle_code: string;
    plate_number?: string;
    brand?: string;
    model?: string;
  };
}

export default function MaintenancePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceItemWithVehicle[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
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
      loadMaintenance(1, true);
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
    if (supplierFilter) filters.supplier = supplierFilter;
    return filters;
  }, [vehicleFilter, vehicleSearch, dateFrom, dateTo, supplierFilter]);

  async function loadMaintenance(pageNum: number = 1, reset: boolean = false) {
    setLoading(true);
    const filters = getFilters();
    const res = await fetchMaintenance({ filters, page: pageNum, pageSize: PAGE_SIZE });
    
    if (reset) {
      setMaintenance(res.maintenance || []);
    } else {
      setMaintenance(prev => [...prev, ...(res.maintenance || [])]);
    }
    
    setTotal(res.total || 0);
    setHasMore((res.maintenance || []).length === PAGE_SIZE);
    setPage(pageNum);
    setLoading(false);
  }

  function handleApplyFilters() {
    setPage(1);
    loadMaintenance(1, true);
  }

  function handleLoadMore() {
    if (!loading && hasMore) {
      loadMaintenance(page + 1, false);
    }
  }

  async function handleExport() {
    const filters = getFilters();
    const exportUrl = buildExportUrl({
      type: "maintenance",
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
    link.download = "maintenance.xlsx";
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this maintenance record?")) return;
    const res = await deleteMaintenance(id);
    if (!res.error) loadMaintenance(1, true);
  }

  async function handleSaveEdit(itemId: string) {
    await updateMaintenance({ id: itemId, ...editDraft });
    setEditId(null);
    loadMaintenance(1, true);
  }

  function handleStartEdit(item: MaintenanceItemWithVehicle) {
    setEditId(item.id);
    setEditDraft({
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
        {loading && maintenance.length === 0 ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
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
                className="w-full rounded-xl border-2 border-emerald-200 bg-white py-3 font-semibold text-emerald-600 active:bg-emerald-50 disabled:opacity-50"
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
