"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession } from "@/lib/auth";
import type { Session, MaintenanceRow, VehicleRow } from "@/lib/types";
import { fetchMaintenance, deleteMaintenance } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

export default function MaintenancePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  async function loadMaintenance() {
    setLoading(true);
    const filters: any = {};
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (supplierFilter) filters.supplier = supplierFilter;

    const res = await fetchMaintenance({ filters, page: 1, pageSize: 100 });
    setMaintenance(res.maintenance || []);
    setLoading(false);
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
                {v.vehicle_code} - {v.brand} {v.model}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            placeholder="Filter by supplier..."
            className="w-full rounded-lg border-2 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
              placeholder="To"
            />
          </div>
          <button
            onClick={loadMaintenance}
            className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white"
          >
            Apply Filters
          </button>
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
                        {item.vehicles?.vehicle_code || "Unknown Vehicle"}
                      </div>
                      <div className="text-sm text-slate-600">
                        {new Date(item.created_at).toLocaleDateString()} • {item.odometer_km} km
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
                    <div className="mb-2 text-xs text-slate-500">Remarks:</div>
                    <div className="mb-3 text-sm text-slate-700">{item.remarks}</div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
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
