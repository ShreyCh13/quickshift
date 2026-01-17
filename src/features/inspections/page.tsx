"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { getSessionHeader, loadSession } from "@/lib/auth";
import type { Session, InspectionRow, VehicleRow } from "@/lib/types";
import { buildExportUrl, fetchInspections, deleteInspection, updateInspection } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";

export default function InspectionsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
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
      loadInspections();
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
    return filters;
  }

  async function loadInspections() {
    setLoading(true);
    const filters = getFilters();
    const res = await fetchInspections({ filters, page: 1, pageSize: 100 });
    console.log("Inspections API response:", res);
    if (res.error) {
      console.error("API error:", res.error);
    }
    setInspections(res.inspections || []);
    setLoading(false);
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
    if (!res.error) loadInspections();
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
              onClick={loadInspections}
              className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white"
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
        ) : inspections.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-slate-500">No inspections found</p>
            <p className="mt-2 text-sm text-slate-400">Click &quot;New Inspection&quot; to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((item: any) => (
              <div key={item.id} className="rounded-xl border-2 border-blue-100 bg-white shadow-sm">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                    <div className="font-bold text-slate-900">
                      {item.vehicles?.vehicle_code || `Vehicle ID: ${item.vehicle_id?.substring(0, 8) || "Unknown"}`}
                      {item.vehicles?.plate_number ? ` (${item.vehicles.plate_number})` : ""}
                    </div>
                      <div className="text-sm text-slate-600">
                      {new Date(item.created_at).toLocaleString()} • {item.odometer_km} km
                      </div>
                      {item.driver_name && <div className="text-xs text-slate-500">Driver: {item.driver_name}</div>}
                    </div>
                    <span className="text-blue-600">{expandedId === item.id ? "▼" : "▶"}</span>
                  </div>
                </button>

                {expandedId === item.id && (
                  <div className="border-t border-blue-100 bg-blue-50 p-4">
                    <h4 className="mb-2 font-semibold text-slate-900">Inspection Details:</h4>
                    {isAdmin && editId === item.id ? (
                      <div className="space-y-3">
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.odometer_km || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, odometer_km: Number(e.target.value) })}
                          placeholder="Odometer"
                        />
                        <input
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={String(editDraft.driver_name || "")}
                          onChange={(e) => setEditDraft({ ...editDraft, driver_name: e.target.value })}
                          placeholder="Driver Name"
                        />
                        <div className="space-y-2">
                          {Object.entries((editDraft.remarks_json as Record<string, string>) || {}).map(
                            ([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="w-32 text-xs font-semibold text-slate-600">{key}</span>
                                <input
                                  className="flex-1 rounded-md border px-2 py-1 text-sm"
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
                            ),
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={async () => {
                              await updateInspection({ id: item.id, ...editDraft });
                              setEditId(null);
                              loadInspections();
                            }}
                            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white"
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
                        {isAdmin && (
                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => {
                                setEditId(item.id);
                                setEditDraft({
                                  odometer_km: item.odometer_km,
                                  driver_name: item.driver_name || "",
                                  remarks_json: item.remarks_json || {},
                                });
                              }}
                              className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
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
