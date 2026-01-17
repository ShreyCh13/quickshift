"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchAnalytics } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

export default function AnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "inspections" | "maintenance">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    loadInitial();
  }, [router]);

  async function loadInitial() {
    const vehiclesData = await fetchVehicles({ page: 1, pageSize: 200 });
    setVehicles(vehiclesData.vehicles || []);
    loadAnalytics();
  }

  async function loadAnalytics() {
    setLoading(true);
    const result = await fetchAnalytics();
    setData(result);
    setLoading(false);
  }

  if (!session) return null;

  const filteredMonthly = data?.monthly || [];
  const filteredSuppliers = data?.topSuppliers || [];
  const filteredVehicles = data?.topVehicles || [];

  return (
    <MobileShell title="Analytics Dashboard">
      <div className="space-y-6 bg-slate-50 p-4">
        {/* Filters Panel */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Filters</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Brand</span>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              >
                <option value="">All Brands</option>
                {Array.from(new Set(vehicles.map((v) => v.brand).filter(Boolean))).map((brand) => (
                  <option key={brand} value={brand || ""}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Vehicle</span>
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              >
                <option value="">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_code} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              >
                <option value="all">All (Inspection + Maintenance)</option>
                <option value="inspections">Inspections Only</option>
                <option value="maintenance">Maintenance Only</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">From Date</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">To Date</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Supplier</span>
              <input
                type="text"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                placeholder="Filter by supplier..."
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              />
            </label>

            <button
              onClick={loadAnalytics}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : (
          <>
            {/* Monthly Spend */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Monthly Maintenance Spend</h3>
              {filteredMonthly.length === 0 ? (
                <p className="text-sm text-slate-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {filteredMonthly.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border-b pb-2">
                      <span className="font-medium text-slate-700">{item.month}</span>
                      <span className="text-lg font-bold text-emerald-600">₹{item.total?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Suppliers */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Top Suppliers by Spend</h3>
              {filteredSuppliers.length === 0 ? (
                <p className="text-sm text-slate-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {filteredSuppliers.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.supplier}</div>
                        <div className="text-xs text-slate-500">{item.count} transactions</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">₹{item.total?.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Vehicles */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Top Vehicles by Spend</h3>
              {filteredVehicles.length === 0 ? (
                <p className="text-sm text-slate-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {filteredVehicles.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.vehicle_code}</div>
                        <div className="text-xs text-slate-500">
                          {item.inspection_count} inspections • {item.maintenance_count} maintenance
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-600">₹{item.total?.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-md">
                <div className="text-xs font-semibold opacity-90">Total Inspections</div>
                <div className="mt-1 text-3xl font-bold">{data?.totalInspections || 0}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-md">
                <div className="text-xs font-semibold opacity-90">Total Maintenance</div>
                <div className="mt-1 text-3xl font-bold">{data?.totalMaintenance || 0}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
