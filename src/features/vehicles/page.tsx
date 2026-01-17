"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles, createVehicle, deleteVehicle } from "./api";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";

export default function VehiclesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newVehicle, setNewVehicle] = useState({
    vehicle_code: "",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
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
    const data = await fetchVehicles({ search, page: 1, pageSize: 200 });
    setVehicles(data.vehicles || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    loadVehicles();
  }, [session, search]);

  async function handleCreate() {
    if (!newVehicle.vehicle_code.trim()) {
      setError("Vehicle code is required");
      return;
    }
    setError(null);
    const payload = {
      vehicle_code: newVehicle.vehicle_code,
      plate_number: newVehicle.plate_number || null,
      brand: newVehicle.brand || null,
      model: newVehicle.model || null,
      year: newVehicle.year ? Number(newVehicle.year) : null,
      notes: newVehicle.notes || null,
    };
    const res = await createVehicle(payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewVehicle({ vehicle_code: "", plate_number: "", brand: "", model: "", year: "", notes: "" });
    setShowAddForm(false);
    loadVehicles();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Deactivate vehicle ${code}?`)) return;
    setError(null);
    const res = await deleteVehicle(id, true);
    if (res.error) {
      setError(res.error);
      return;
    }
    loadVehicles();
  }

  return (
    <MobileShell title="Vehicles">
      <div className="space-y-4 p-4">
        {error && <Toast message={error} tone="error" />}

        <input
          type="text"
          list="vehicle-search"
          placeholder="Search vehicle code or plate..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />
        <datalist id="vehicle-search">
          {vehicles.map((v) => (
            <option key={v.id} value={v.vehicle_code}>
              {v.plate_number ? `${v.plate_number} • ` : ""}{v.brand} {v.model}
            </option>
          ))}
        </datalist>

        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            {showAddForm ? "Cancel" : "+ Add Vehicle"}
          </button>
        )}

        {showAddForm && isAdmin && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Add New Vehicle</h3>
            <div className="space-y-3">
              <FormField
                label="Vehicle Code *"
                value={newVehicle.vehicle_code}
                onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_code: e.target.value })}
                placeholder="e.g. HR38AF-4440"
                required
              />
              <FormField
                label="Plate Number"
                value={newVehicle.plate_number}
                onChange={(e) => setNewVehicle({ ...newVehicle, plate_number: e.target.value })}
                placeholder="e.g. HR38AF-4440"
              />
              <FormField
                label="Brand"
                value={newVehicle.brand}
                onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                placeholder="e.g. TOYOTA"
              />
              <FormField
                label="Model"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                placeholder="e.g. INNOVA CRYSTA"
              />
              <FormField
                label="Year"
                value={newVehicle.year}
                onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                placeholder="e.g. 2023"
                type="number"
              />
              <FormField
                label="Notes"
                value={newVehicle.notes}
                onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                placeholder="Optional notes..."
              />
              <button
                onClick={handleCreate}
                className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                Add Vehicle
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-slate-50 px-6 py-12 text-center">
            <p className="font-medium text-slate-600">No vehicles found</p>
            <p className="mt-1 text-sm text-slate-400">
              {isAdmin ? "Click 'Add Vehicle' to get started" : "Contact admin to add vehicles"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className={`rounded-xl border-2 bg-white p-4 shadow-sm transition ${
                  v.is_active ? "border-slate-100 hover:border-blue-300 hover:shadow" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xl font-bold text-slate-900">{v.vehicle_code}</div>
                    {v.plate_number && (
                      <div className="mt-1 text-xs font-medium text-slate-500">Plate: {v.plate_number}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      {v.brand && <span className="font-medium text-blue-700">{v.brand}</span>}
                      {v.model && <span>{v.model}</span>}
                    </div>
                    {v.year && <div className="mt-1 text-xs text-slate-500">Year: {v.year}</div>}
                    {!v.is_active && (
                      <div className="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        INACTIVE
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {v.is_active && (
                      <>
                        <button
                          onClick={() => router.push(`/inspections/new?vehicle=${v.id}`)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => router.push(`/maintenance/new?vehicle=${v.id}`)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          Maintain
                        </button>
                      </>
                    )}
                    {isAdmin && v.is_active && (
                      <button
                        onClick={() => handleDelete(v.id, v.vehicle_code)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
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
