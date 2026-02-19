"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import MobileShell from "@/components/MobileShell";
import Autocomplete from "@/components/Autocomplete";
import { getSessionHeader, loadSession, clearSession } from "@/lib/auth";
import type { Session } from "@/lib/types";
import { buildExportUrl, updateMaintenance } from "./api";
import Skeleton from "@/components/Skeleton";
import { useMaintenanceInfinite, useVehicleDropdown, useDeleteMaintenance, queryKeys } from "@/hooks/useQueries";

interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  supplier_invoice_number: string;
  amount: number;
  remarks: string;
  created_by?: string;
  vehicles: {
    vehicle_code: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  } | null;
  users?: { id: string; display_name: string } | null;
}

function fetchSupplierSuggestions(search: string): Promise<string[]> {
  const params = new URLSearchParams({ active: "true" });
  if (search.trim()) params.set("search", search.trim());
  return fetch(`/api/suppliers?${params}`, { headers: getSessionHeader() })
    .then((r) => r.json())
    .then((d) => (d.suppliers || []).map((s: { name: string }) => s.name))
    .catch(() => []);
}

async function addSupplier(name: string) {
  await fetch("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ name }),
  });
}

export default function MaintenancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    odometer_km: number;
    bill_number: string;
    supplier_name: string;
    supplier_invoice_number: string;
    amount: number;
    remarks: string;
  }>({ odometer_km: 0, bill_number: "", supplier_name: "", supplier_invoice_number: "", amount: 0, remarks: "" });
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user.role === "admin";
  const { data: vehicles = [] } = useVehicleDropdown();

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (appliedFilters.vehicle_id) f.vehicle_id = appliedFilters.vehicle_id;
    if (appliedFilters.vehicle_query) f.vehicle_query = appliedFilters.vehicle_query;
    if (appliedFilters.date_from) f.date_from = appliedFilters.date_from;
    if (appliedFilters.date_to) f.date_to = appliedFilters.date_to;
    if (appliedFilters.supplier) f.supplier = appliedFilters.supplier;
    if (appliedFilters.supplier_invoice_number) f.supplier_invoice_number = appliedFilters.supplier_invoice_number;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [appliedFilters]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } =
    useMaintenanceInfinite(filters, 20);

  const deleteMutation = useDeleteMaintenance();
  const maintenance: MaintenanceItem[] = data?.pages.flatMap((page) => page.data) ?? [];
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
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (supplierFilter) f.supplier = supplierFilter;
    if (invoiceFilter) f.supplier_invoice_number = invoiceFilter;
    setAppliedFilters(f);
  }

  function handleClearFilters() {
    setVehicleFilter(""); setVehicleSearch(""); setSupplierFilter(""); setInvoiceFilter("");
    setDateFrom(""); setDateTo("");
    setAppliedFilters({});
  }

  async function handleExport() {
    const exportUrl = buildExportUrl({
      type: "maintenance",
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
    link.download = match ? match[1].replace(/['"]/g, "") : "maintenance.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this maintenance record?")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      alert("Failed to delete: " + (err instanceof Error ? err.message : "Unknown"));
    }
  }

  function handleStartEdit(item: MaintenanceItem) {
    setEditId(item.id);
    setEditDraft({
      odometer_km: item.odometer_km,
      bill_number: item.bill_number,
      supplier_name: item.supplier_name,
      supplier_invoice_number: item.supplier_invoice_number || "",
      amount: item.amount,
      remarks: item.remarks,
    });
    setExpandedId(item.id);
  }

  async function handleSaveEdit(itemId: string) {
    if (!editDraft.bill_number.trim() || !editDraft.supplier_name.trim() || !editDraft.supplier_invoice_number.trim()) {
      alert("Bill number, supplier name, and supplier invoice number are required");
      return;
    }
    await updateMaintenance({ id: itemId, ...editDraft });
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
  }

  if (!session) return null;

  return (
    <MobileShell title="Maintenance">
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4 pb-24">
        <button
          onClick={() => router.push("/maintenance/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98]"
        >
          + New Maintenance
        </button>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Filters</h3>
            {Object.keys(appliedFilters).length > 0 && (
              <button onClick={handleClearFilters} className="text-xs font-medium text-emerald-600 active:text-emerald-800">
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Vehicle</label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
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
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Supplier</label>
            <input
              type="text"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              placeholder="Filter by supplier..."
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Supplier Invoice No.</label>
            <input
              type="text"
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value)}
              placeholder="Filter by invoice number..."
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={dateFrom ? dateFrom.split("T")[0] : ""}
                onChange={(e) => setDateFrom(e.target.value ? `${e.target.value}T00:00` : "")}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={dateTo ? dateTo.split("T")[0] : ""}
                onChange={(e) => setDateTo(e.target.value ? `${e.target.value}T23:59` : "")}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>
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

        {total > 0 && (
          <div className="mb-3 text-sm text-slate-500">
            Showing {maintenance.length} of {total} records
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
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
                          {item.vehicles?.vehicle_code || `Vehicle ${item.vehicle_id?.substring(0, 8)}`}
                          {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                        </div>
                        {item.vehicles?.brand && item.vehicles?.model && (
                          <div className="mt-0.5 text-sm font-medium text-emerald-600">
                            {item.vehicles.brand} {item.vehicles.model}
                          </div>
                        )}
                        <div className="mt-0.5 text-sm text-slate-600">
                          {new Date(item.created_at).toLocaleString()} · {item.odometer_km.toLocaleString()} km
                        </div>
                        <div className="mt-0.5 text-sm text-slate-600">
                          {item.supplier_name} · Bill: {item.bill_number}
                        </div>
                        {item.supplier_invoice_number && (
                          <div className="mt-0.5 text-xs text-slate-500">Invoice: {item.supplier_invoice_number}</div>
                        )}
                        {item.users?.display_name && (
                          <div className="mt-0.5 text-xs text-slate-400">By: {item.users.display_name}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
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
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Odometer (km)</label>
                            <input
                              type="number"
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                              value={editDraft.odometer_km}
                              onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Bill Number</label>
                            <input
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                              value={editDraft.bill_number}
                              onChange={(e) => setEditDraft({ ...editDraft, bill_number: e.target.value })}
                            />
                          </div>
                          <Autocomplete
                            label="Supplier Name"
                            value={editDraft.supplier_name}
                            onChange={(v) => setEditDraft({ ...editDraft, supplier_name: v })}
                            onAddNew={addSupplier}
                            fetchSuggestions={fetchSupplierSuggestions}
                            placeholder="Search or add supplier..."
                            accentColor="emerald"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Supplier Invoice No.</label>
                            <input
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                              value={editDraft.supplier_invoice_number}
                              onChange={(e) => setEditDraft({ ...editDraft, supplier_invoice_number: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Amount (₹)</label>
                            <input
                              type="number"
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                              value={editDraft.amount}
                              onChange={(e) => setEditDraft({ ...editDraft, amount: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Remarks</label>
                            <textarea
                              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                              rows={3}
                              value={editDraft.remarks}
                              onChange={(e) => setEditDraft({ ...editDraft, remarks: e.target.value })}
                            />
                          </div>
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
                          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Bill Number</div>
                              <div className="text-slate-800">{item.bill_number}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Supplier Invoice</div>
                              <div className="text-slate-800">{item.supplier_invoice_number || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Supplier</div>
                              <div className="text-slate-800">{item.supplier_name}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Amount</div>
                              <div className="font-bold text-emerald-700">₹{Number(item.amount).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="mb-3">
                            <div className="mb-1 text-xs font-semibold text-slate-500">Remarks</div>
                            <div className="text-sm text-slate-700">{item.remarks || "No remarks"}</div>
                          </div>
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
