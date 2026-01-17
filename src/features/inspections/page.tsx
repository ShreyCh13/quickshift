"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession } from "@/lib/auth";
import type { Session, InspectionRow, VehicleRow } from "@/lib/types";
import { fetchInspections } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

export default function InspectionsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    loadVehicles();
    loadInspections();
  }, [router]);

  async function loadVehicles() {
    const res = await fetchVehicles({ page: 1, pageSize: 200 });
    setVehicles(res.vehicles || []);
  }

  async function loadInspections() {
    setLoading(true);
    const filters: any = {};
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    const res = await fetchInspections({ filters, page: 1, pageSize: 100 });
    setInspections(res.inspections || []);
    setLoading(false);
  }

  if (!session) return null;

  return (
    <MobileShell title="Inspections">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-24">
        {/* Quick Add Button */}
        <button
          onClick={() => router.push("/inspections/new")}
          className="mb-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl"
        >
          + New Inspection
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-2 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={loadInspections}
            className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white"
          >
            Apply Filters
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : inspections.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-slate-500">No inspections found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((item: any) => (
              <div key={item.id} className="rounded-xl border-2 border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      {item.vehicles?.vehicle_code || "Unknown Vehicle"}
                    </div>
                    <div className="text-sm text-slate-600">
                      {new Date(item.created_at).toLocaleDateString()} • {item.odometer_km} km
                    </div>
                    {item.driver_name && <div className="text-xs text-slate-500">Driver: {item.driver_name}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
