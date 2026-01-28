"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { clearSession, loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles, createVehicle, deleteVehicle } from "./api";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";

export default function VehiclesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const [newVehicle, setNewVehicle] = useState({
    vehicle_code: "",
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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset and reload when search changes
  useEffect(() => {
    if (session) {
      setPage(1);
      loadVehicles(1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, debouncedSearch]);

  const loadVehicles = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    setLoading(true);
    const data = await fetchVehicles({ search: debouncedSearch, page: pageNum, pageSize: PAGE_SIZE });
    
    if (!data || typeof data !== "object") {
      setError("Failed to load vehicles: Empty response");
      setVehicles([]);
      setLoading(false);
      return;
    }
    
    if ("error" in data && data.error) {
      if (data.error === "Unauthorized") {
        clearSession();
        router.replace("/login");
        return;
      }
      setError("details" in data && data.details ? `${data.error}: ${data.details}` : data.error);
      setVehicles([]);
    } else {
      setError(null);
      const newVehicles = "vehicles" in data && Array.isArray(data.vehicles) ? data.vehicles : [];
      
      if (reset) {
        setVehicles(newVehicles);
      } else {
        setVehicles(prev => [...prev, ...newVehicles]);
      }
      
      setTotal("total" in data ? (data.total as number) : 0);
      setHasMore(newVehicles.length === PAGE_SIZE);
    }
    
    setPage(pageNum);
    setLoading(false);
  }, [debouncedSearch, router]);

  function handleLoadMore() {
    if (!loading && hasMore) {
      loadVehicles(page + 1, false);
    }
  }

  async function handleCreate() {
    if (!newVehicle.vehicle_code.trim()) {
      setError("Vehicle code is required");
      return;
    }
    if (!newVehicle.brand.trim()) {
      setError("Brand is required");
      return;
    }
    if (!newVehicle.model.trim()) {
      setError("Model is required");
      return;
    }
    setError(null);
    const payload = {
      vehicle_code: newVehicle.vehicle_code.trim(),
      brand: newVehicle.brand.trim(),
      model: newVehicle.model.trim(),
      year: newVehicle.year ? Number(newVehicle.year) : null,
      notes: newVehicle.notes || null,
    };
    const res = await createVehicle(payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewVehicle({ vehicle_code: "", brand: "", model: "", year: "", notes: "" });
    setShowAddForm(false);
    loadVehicles(1, true);
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Deactivate vehicle ${code}?`)) return;
    setError(null);
    const res = await deleteVehicle(id, true);
    if (res.error) {
      setError(res.error);
      return;
    }
    loadVehicles(1, true);
  }

  return (
    <MobileShell title="Vehicles">
      <div className="space-y-4 p-4 pb-24">
        {error && (
          <div className="space-y-2">
            <Toast message={error} tone="error" />
            <button
              onClick={() => loadVehicles(1, true)}
              className="w-full rounded-lg border-2 border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
            >
              Retry Load
            </button>
          </div>
        )}

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
              {v.plate_number ? `${v.plate_number} - ` : ""}{v.brand} {v.model}
            </option>
          ))}
        </datalist>

        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white active:bg-blue-700"
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
                label="Brand *"
                value={newVehicle.brand}
                onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                placeholder="e.g. TOYOTA"
                required
              />
              <FormField
                label="Model *"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                placeholder="e.g. INNOVA CRYSTA"
                required
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
                className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700"
              >
                Add Vehicle
              </button>
            </div>
          </div>
        )}

        {/* Results count */}
        {total > 0 && (
          <div className="text-sm text-slate-500">
            Showing {vehicles.length} of {total} vehicles
          </div>
        )}

        {loading && vehicles.length === 0 ? (
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
                  v.is_active ? "border-slate-100 active:border-blue-300" : "border-red-200 bg-red-50"
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
                  <div className="flex flex-col gap-2">
                    {v.is_active && (
                      <>
                        <button
                          onClick={() => router.push(`/inspections/new?vehicle=${v.id}`)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white active:bg-blue-700"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => router.push(`/maintenance/new?vehicle=${v.id}`)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700"
                        >
                          Maintain
                        </button>
                      </>
                    )}
                    {isAdmin && v.is_active && (
                      <button
                        onClick={() => handleDelete(v.id, v.vehicle_code)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full rounded-xl border-2 border-blue-200 bg-white py-3 font-semibold text-blue-600 active:bg-blue-50 disabled:opacity-50"
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
