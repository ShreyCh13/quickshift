"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession, clearSession, getSessionHeader } from "@/lib/auth";
import type { InspectionRow, MaintenanceRow, Session, VehicleRow } from "@/lib/types";
import { VehicleCard } from "./components";
import { createVehicle, deleteVehicle, fetchVehicles, importVehicles, updateVehicle } from "./api";
import { fetchInspections } from "@/features/inspections/api";
import { fetchMaintenance } from "@/features/maintenance/api";
import { buildExportUrl } from "@/features/admin/api";

export default function VehiclesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [selected, setSelected] = useState<VehicleRow | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);

  const [newVehicle, setNewVehicle] = useState({
    vehicle_code: "",
    make: "",
    model: "",
    year: "",
    plate_number: "",
    notes: "",
  });

  const isAdmin = session?.user.role === "admin";

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    setSession(sessionData);
  }, [router]);

  async function loadVehicles() {
    setLoading(true);
    setError(null);
    const data = await fetchVehicles({ search, page: 1, pageSize: 50 });
    if (data.error) setError(data.error);
    setVehicles(data.vehicles || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    loadVehicles();
  }, [session, search]);

  async function handleCreate() {
    setError(null);
    const payload = {
      vehicle_code: newVehicle.vehicle_code,
      make: newVehicle.make || null,
      model: newVehicle.model || null,
      year: newVehicle.year ? Number(newVehicle.year) : null,
      plate_number: newVehicle.plate_number || null,
      notes: newVehicle.notes || null,
    };
    const res = await createVehicle(payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewVehicle({ vehicle_code: "", make: "", model: "", year: "", plate_number: "", notes: "" });
    loadVehicles();
  }

  async function handleUpdate(vehicle: VehicleRow) {
    setError(null);
    const res = await updateVehicle(vehicle);
    if (res.error) {
      setError(res.error);
      return;
    }
    loadVehicles();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await deleteVehicle(id, true);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSelected(null);
    loadVehicles();
  }

  async function handleSelect(vehicle: VehicleRow) {
    setSelected(vehicle);
    const [inspectionsData, maintenanceData] = await Promise.all([
      fetchInspections({ filters: { vehicle_id: vehicle.id }, page: 1, pageSize: 10 }),
      fetchMaintenance({ filters: { vehicle_id: vehicle.id }, page: 1, pageSize: 10 }),
    ]);
    setInspections(inspectionsData.inspections || []);
    setMaintenance(maintenanceData.maintenance || []);
  }

  async function handleImport(file: File) {
    setImporting(true);
    const res = await importVehicles(file);
    setImporting(false);
    if (res.error) {
      setError(res.error);
    } else {
      loadVehicles();
    }
  }

  const exportUrl = useMemo(
    () =>
      buildExportUrl({
        type: "vehicles",
        format: "xlsx",
        filters: { search: search || undefined },
      }),
    [search],
  );

  async function downloadExport() {
    const res = await fetch(exportUrl, { headers: { ...getSessionHeader() } });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vehicles.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MobileShell title="Vehicles">
      <div className="space-y-4">
        {error ? <Toast message={error} tone="error" /> : null}
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle code or plate"
            className="h-11 flex-1 rounded-md border border-slate-300 px-3 text-base"
          />
          <button
            type="button"
            onClick={downloadExport}
            className="h-11 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white"
          >
            Export
          </button>
        </div>

        {isAdmin ? (
          <div className="space-y-2 rounded-lg border bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">Add Vehicle</div>
            <div className="grid grid-cols-1 gap-2">
              <FormField
                label="Vehicle Code"
                value={newVehicle.vehicle_code}
                onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_code: e.target.value })}
                required
              />
              <FormField
                label="Make"
                value={newVehicle.make}
                onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
              />
              <FormField
                label="Model"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
              />
              <FormField
                label="Year"
                value={newVehicle.year}
                onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
              />
              <FormField
                label="Plate Number"
                value={newVehicle.plate_number}
                onChange={(e) => setNewVehicle({ ...newVehicle, plate_number: e.target.value })}
              />
              <FormField
                label="Notes"
                value={newVehicle.notes}
                onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="h-12 w-full rounded-md bg-emerald-600 text-base font-semibold text-white"
            >
              Add Vehicle
            </button>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Import Excel</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
              {importing ? <div className="text-xs text-slate-500">Importing...</div> : null}
            </label>
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
          {vehicles.map((vehicle) =>
            isAdmin ? (
              <div key={vehicle.id} className="rounded-lg border bg-white p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500">
                    Code
                    <input
                      className="mt-1 h-10 w-full rounded-md border px-2 text-sm"
                      value={vehicle.vehicle_code}
                      onChange={(e) =>
                        setVehicles((prev) =>
                          prev.map((v) =>
                            v.id === vehicle.id ? { ...v, vehicle_code: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Plate
                    <input
                      className="mt-1 h-10 w-full rounded-md border px-2 text-sm"
                      value={vehicle.plate_number || ""}
                      onChange={(e) =>
                        setVehicles((prev) =>
                          prev.map((v) =>
                            v.id === vehicle.id ? { ...v, plate_number: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Make
                    <input
                      className="mt-1 h-10 w-full rounded-md border px-2 text-sm"
                      value={vehicle.make || ""}
                      onChange={(e) =>
                        setVehicles((prev) =>
                          prev.map((v) => (v.id === vehicle.id ? { ...v, make: e.target.value } : v)),
                        )
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Model
                    <input
                      className="mt-1 h-10 w-full rounded-md border px-2 text-sm"
                      value={vehicle.model || ""}
                      onChange={(e) =>
                        setVehicles((prev) =>
                          prev.map((v) => (v.id === vehicle.id ? { ...v, model: e.target.value } : v)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(vehicle)}
                    className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vehicle.id)}
                    className="h-10 flex-1 rounded-md bg-red-600 text-sm font-semibold text-white"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            ) : (
              <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={handleSelect} />
            ),
          )}
        </div>

        {selected ? (
          <div className="space-y-3 rounded-lg border bg-white p-3">
            <div className="text-base font-semibold text-slate-900">
              {selected.vehicle_code} Details
            </div>
            <div className="text-sm text-slate-600">
              {selected.make} {selected.model} {selected.year ? `(${selected.year})` : ""}
            </div>
            <div className="text-sm text-slate-600">Plate: {selected.plate_number || "N/A"}</div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Latest Inspections</div>
              {inspections.map((item) => (
                <div key={item.id} className="text-sm text-slate-700">
                  {new Date(item.created_at).toLocaleDateString()} • {item.odometer_km} km
                </div>
              ))}
              <div className="text-sm font-semibold text-slate-900">Latest Maintenance</div>
              {maintenance.map((item) => (
                <div key={item.id} className="text-sm text-slate-700">
                  {new Date(item.created_at).toLocaleDateString()} • {item.supplier_name} • {item.amount}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
          className="h-11 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700"
        >
          Log out
        </button>
      </div>
    </MobileShell>
  );
}
