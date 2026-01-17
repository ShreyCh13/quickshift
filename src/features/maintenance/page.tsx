"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession } from "@/lib/auth";
import type { Session, MaintenanceRow, VehicleRow } from "@/lib/types";
import { buildExportUrl, fetchMaintenance, deleteMaintenance, updateMaintenance } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

export default function MaintenancePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
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
      loadMaintenance();
    }
  }, [session]);

  async function loadVehicles() {
    const res = await fetchVehicles({ page: 1, pageSize: 200 });
    setVehicles(res.vehicles || []);
  }

  function getFilters() {
    const filters: Record<string, unknown> = {};
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (vehicleSearch) filters.vehicle_query = vehicleSearch;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (supplierFilter) filters.supplier = supplierFilter;
    return filters;
  }

  async function loadMaintenance() {
    setLoading(true);
    const filters = getFilters();
    const res = await fetchMaintenance({ filters, page: 1, pageSize: 100 });
    setMaintenance(res.maintenance || []);
    setLoading(false);
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
    if (!res.error) loadMaintenance();
  }

  if (!session) return null;

  return (
    <MobileShell title="Maintenance">
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4 pb-24">
        {/* Quick Add Button */}
        <button
          onClick={() => router.push("/maintenance/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl"
        >
          + New Maintenance
        </button>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <h3 className="font-bold text-slate-900">Filters</h3>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="w-full rounded-lg border-2 px-3 py-2 text-sm"
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
            className="w-full rounded-lg border-2 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            placeholder="Filter by supplier..."
            className="w-full rounded-lg border-2 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
              placeholder="From"
            />
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
              placeholder="To"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={loadMaintenance}
              className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white"
            >
              Apply Filters
            </button>
            <button
              onClick={handleExport}
              className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white"
            >
              Export
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : maintenance.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-slate-500">No maintenance records found</p>
            <p className="mt-2 text-sm text-slate-400">Click &quot;New Maintenance&quot; to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {maintenance.map((item: any) => (
              <div key={item.id} className="rounded-xl border-2 border-emerald-100 bg-white shadow-sm">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        {item.vehicles?.vehicle_code || `Vehicle ID: ${item.vehicle_id?.substring(0, 8)}`}
                        {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                      </div>
                      <div className="text-sm text-slate-600">
                        {new Date(item.created_at).toLocaleString()} • {item.odometer_km} km
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {item.supplier_name} • Bill: {item.bill_number}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-600">₹{item.amount?.toLocaleString()}</div>
                      <span className="text-emerald-600">{expandedId === item.id ? "▼" : "▶"}</span>
                    </div>
                  </div>
                </button>

                {expandedId === item.id && (
                  <div className="border-t border-emerald-100 bg-emerald-50 p-4">
                    {(() => {
                      const canEdit = isAdmin || item.created_by === session?.user.id;
                      if (canEdit && editId === item.id) {
                        return (
                          <div className="space-y-3">
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.odometer_km || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                          placeholder="Odometer"
                        />
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.bill_number || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, bill_number: e.target.value })}
                          placeholder="Bill Number"
                        />
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.supplier_name || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, supplier_name: e.target.value })}
                          placeholder="Supplier"
                        />
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.amount || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, amount: Number(e.target.value) })}
                          placeholder="Amount"
                        />
                        <textarea
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          rows={3}
                          value={String(editDraft.remarks || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, remarks: e.target.value })}
                          placeholder="Remarks"
                        />
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={async () => {
                              await updateMaintenance({ id: item.id, ...editDraft });
                              setEditId(null);
                              loadMaintenance();
                            }}
                            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                          </div>
                        );
                      }
                      return (
                        <>
                        <div className="mb-2 text-xs text-slate-500">Remarks:</div>
                        <div className="mb-3 text-sm text-slate-700">{item.remarks}</div>
                        {canEdit && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditId(item.id);
                                setEditDraft({
                                  odometer_km: item.odometer_km,
                                  bill_number: item.bill_number,
                                  supplier_name: item.supplier_name,
                                  amount: item.amount,
                                  remarks: item.remarks,
                                });
                              }}
                              className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
