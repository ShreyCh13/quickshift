"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { buildExportUrl } from "./api";
import { useVehicles, useAnalytics } from "@/hooks/useQueries";
import * as XLSX from "xlsx";

export default function AnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  // Filters - stored in state so we can build the query
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "inspections" | "maintenance">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  
  // Applied filters - only update when user clicks Apply
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({});

  // React Query hooks - data is cached automatically
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles(undefined, 1, 200);
  const vehicles = (vehiclesData as any)?.vehicles || [];
  
  // Analytics data with applied filters
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalytics(appliedFilters);
  const data = analyticsData;

  const loading = vehiclesLoading || analyticsLoading;

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  // Apply filters - triggers analytics refetch
  function applyFilters() {
    const filters: Record<string, unknown> = {};
    if (brandFilter) filters.brand = brandFilter;
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (typeFilter !== "all") filters.type = typeFilter;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (supplierFilter) filters.supplier = supplierFilter;
    setAppliedFilters(filters);
  }

  // Build initial filters on mount
  useEffect(() => {
    applyFilters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getExportFilters(type: "inspections" | "maintenance") {
    const filters: Record<string, unknown> = {};
    if (vehicleFilter) filters.vehicle_id = vehicleFilter;
    if (brandFilter) filters.brand = brandFilter;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (type === "maintenance" && supplierFilter) filters.supplier = supplierFilter;
    return filters;
  }

  async function handleExport() {
    // If exporting both types, combine into one Excel file with multiple sheets
    if (typeFilter === "all") {
      try {
        const inspFilters = getExportFilters("inspections");
        const maintFilters = getExportFilters("maintenance");
        
        const [inspRes, maintRes] = await Promise.all([
          fetch(buildExportUrl({
            type: "inspections",
            format: "xlsx",
            filters: Object.keys(inspFilters).length ? inspFilters : undefined,
          }), { headers: { ...getSessionHeader() } }),
          fetch(buildExportUrl({
            type: "maintenance",
            format: "xlsx",
            filters: Object.keys(maintFilters).length ? maintFilters : undefined,
          }), { headers: { ...getSessionHeader() } })
        ]);

        if (!inspRes.ok || !maintRes.ok) {
          alert("Export failed");
          return;
        }

        const [inspBlob, maintBlob] = await Promise.all([
          inspRes.arrayBuffer(),
          maintRes.arrayBuffer()
        ]);

        const inspWb = XLSX.read(inspBlob, { type: 'array' });
        const maintWb = XLSX.read(maintBlob, { type: 'array' });

        const combinedWb = XLSX.utils.book_new();
        
        if (inspWb.SheetNames.length > 0) {
          const inspSheet = inspWb.Sheets[inspWb.SheetNames[0]];
          XLSX.utils.book_append_sheet(combinedWb, inspSheet, "Inspections");
        }
        
        if (maintWb.SheetNames.length > 0) {
          const maintSheet = maintWb.Sheets[maintWb.SheetNames[0]];
          XLSX.utils.book_append_sheet(combinedWb, maintSheet, "Maintenance");
        }

        const timestamp = new Date().toISOString().split('T')[0];
        let filenameParts = ["analytics"];
        
        if (vehicleFilter || brandFilter) {
          const vehicleName = vehicles.find(v => v.id === vehicleFilter)?.vehicle_code || 
                              (brandFilter ? `brand-${brandFilter}` : '');
          if (vehicleName) filenameParts.push(vehicleName.replace(/[^a-zA-Z0-9]/g, '_'));
        }
        
        if (dateFrom || dateTo) {
          const from = dateFrom ? new Date(dateFrom).toISOString().split('T')[0] : '';
          const to = dateTo ? new Date(dateTo).toISOString().split('T')[0] : '';
          if (from && to) {
            filenameParts.push(`${from}_to_${to}`);
          } else if (from) {
            filenameParts.push(`from-${from}`);
          } else if (to) {
            filenameParts.push(`until-${to}`);
          }
        }
        
        filenameParts.push(timestamp);
        const filename = `${filenameParts.join('_')}.xlsx`;

        XLSX.writeFile(combinedWb, filename);
      } catch (error) {
        console.error("Export error:", error);
        alert("Export failed");
      }
    } else {
      const filters = getExportFilters(typeFilter);
      const exportUrl = buildExportUrl({
        type: typeFilter,
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
      
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "") : `${typeFilter}.xlsx`;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }
  }

  if (!session) return null;

  const filteredMonthly = data?.monthly || [];
  const filteredSuppliers = data?.topSuppliers || [];
  const filteredVehicles = data?.topVehicles || [];

  return (
    <MobileShell title="Analytics Dashboard">
      <div className="space-y-6 bg-slate-50 p-4">
        {/* Filters Panel */}
        <form
          className="rounded-xl bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
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
                    {v.vehicle_code} {v.plate_number ? `(${v.plate_number})` : ""} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "inspections" | "maintenance")}
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
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">To Date</span>
                <input
                  type="datetime-local"
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

            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-800"
              >
                Export
              </button>
            </div>
          </div>
        </form>

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
                  {filteredMonthly.map((item: { month: string; total: number }, idx: number) => (
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
                  {filteredSuppliers.map((item: { supplier: string; total: number; count: number }, idx: number) => (
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
                  {filteredVehicles.map((item: { vehicle_code: string; brand?: string | null; model?: string | null; inspection_count: number; maintenance_count: number; total: number }, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.vehicle_code}</div>
                        {item.brand && item.model && (
                          <div className="text-sm text-purple-600 font-medium">
                            {item.brand} {item.model}
                          </div>
                        )}
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

            {/* Filtered Results */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Filtered Results</h3>

              {typeFilter !== "maintenance" && (
                <div className="mb-6">
                  <h4 className="mb-2 text-sm font-semibold text-blue-700">Inspections</h4>
                  {(data?.inspections || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No inspections match these filters.</p>
                  ) : (
                    <div className="space-y-2">
                      {data?.inspections.map((item: { id: string; vehicles?: { vehicle_code: string; plate_number?: string | null; brand?: string | null; model?: string | null } | null; vehicle_id?: string; created_at: string; odometer_km: number; driver_name?: string | null }) => (
                        <div key={item.id} className="rounded-md border border-blue-100 p-3 text-sm">
                          <div className="font-semibold text-slate-900">
                            {item.vehicles?.vehicle_code || item.vehicle_id?.substring(0, 8)}
                            {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                          </div>
                          {item.vehicles?.brand && item.vehicles?.model && (
                            <div className="text-sm text-blue-600 font-medium">
                              {item.vehicles.brand} {item.vehicles.model}
                            </div>
                          )}
                          <div className="text-slate-600">
                            {new Date(item.created_at).toLocaleString()} • {item.odometer_km} km
                          </div>
                          {item.driver_name && (
                            <div className="text-xs text-slate-500">Driver: {item.driver_name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {typeFilter !== "inspections" && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-emerald-700">Maintenance</h4>
                  {(data?.maintenance || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No maintenance entries match these filters.</p>
                  ) : (
                    <div className="space-y-2">
                      {data?.maintenance.map((item: { id: string; vehicles?: { vehicle_code: string; plate_number?: string | null; brand?: string | null; model?: string | null } | null; vehicle_id?: string; created_at: string; odometer_km: number; supplier_name: string; amount: number }) => (
                        <div key={item.id} className="rounded-md border border-emerald-100 p-3 text-sm">
                          <div className="font-semibold text-slate-900">
                            {item.vehicles?.vehicle_code || item.vehicle_id?.substring(0, 8)}
                            {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                          </div>
                          {item.vehicles?.brand && item.vehicles?.model && (
                            <div className="text-sm text-emerald-600 font-medium">
                              {item.vehicles.brand} {item.vehicles.model}
                            </div>
                          )}
                          <div className="text-slate-600">
                            {new Date(item.created_at).toLocaleString()} • {item.odometer_km} km
                          </div>
                          <div className="text-slate-600">
                            {item.supplier_name} • ₹{item.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
