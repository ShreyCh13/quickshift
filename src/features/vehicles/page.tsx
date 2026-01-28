"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import MobileShell from "@/components/MobileShell";
import { clearSession, loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { createVehicle, updateVehicle, deleteVehicle } from "./api";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import Skeleton from "@/components/Skeleton";
import { useVehiclesInfinite, queryKeys } from "@/hooks/useQueries";
import { useDebounce } from "@/hooks/useDebounce";

export default function VehiclesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [newVehicle, setNewVehicle] = useState({
    vehicle_code: "",
    brand: "",
    model: "",
    year: "",
    notes: "",
  });

  // Edit state
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);
  const [editForm, setEditForm] = useState({
    vehicle_code: "",
    brand: "",
    model: "",
    year: "",
    notes: "",
  });

  const isAdmin = session?.user.role === "admin";

  // React Query infinite query for vehicles
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useVehiclesInfinite(
    debouncedSearch ? { search: debouncedSearch } : undefined,
    20
  );

  // Flatten paginated data
  const vehicles = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    setSession(sessionData);
  }, [router]);

  // Infinite scroll - load more when reaching bottom
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle unauthorized errors
  useEffect(() => {
    if (isError && error?.message === "Unauthorized") {
      clearSession();
      router.replace("/login");
    }
  }, [isError, error, router]);

  const invalidateAndRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
  }, [queryClient]);

  async function handleCreate() {
    if (!newVehicle.vehicle_code.trim()) {
      setLocalError("Vehicle code is required");
      return;
    }
    if (!newVehicle.brand.trim()) {
      setLocalError("Brand is required");
      return;
    }
    if (!newVehicle.model.trim()) {
      setLocalError("Model is required");
      return;
    }
    setLocalError(null);
    const payload = {
      vehicle_code: newVehicle.vehicle_code.trim(),
      brand: newVehicle.brand.trim(),
      model: newVehicle.model.trim(),
      year: newVehicle.year ? Number(newVehicle.year) : null,
      notes: newVehicle.notes || null,
    };
    const res = await createVehicle(payload);
    if (res.error) {
      setLocalError(res.error);
      return;
    }
    setNewVehicle({ vehicle_code: "", brand: "", model: "", year: "", notes: "" });
    setShowAddForm(false);
    invalidateAndRefetch();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Deactivate vehicle ${code}?`)) return;
    setLocalError(null);
    const res = await deleteVehicle(id, true);
    if (res.error) {
      setLocalError(res.error);
      return;
    }
    invalidateAndRefetch();
  }

  function startEdit(vehicle: VehicleRow) {
    setEditingVehicle(vehicle);
    setEditForm({
      vehicle_code: vehicle.vehicle_code || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year ? String(vehicle.year) : "",
      notes: vehicle.notes || "",
    });
  }

  function cancelEdit() {
    setEditingVehicle(null);
    setEditForm({ vehicle_code: "", brand: "", model: "", year: "", notes: "" });
  }

  async function handleUpdate() {
    if (!editingVehicle) return;
    if (!editForm.vehicle_code.trim()) {
      setLocalError("Vehicle code is required");
      return;
    }
    if (!editForm.brand.trim()) {
      setLocalError("Brand is required");
      return;
    }
    if (!editForm.model.trim()) {
      setLocalError("Model is required");
      return;
    }
    setLocalError(null);
    const payload = {
      id: editingVehicle.id,
      vehicle_code: editForm.vehicle_code.trim(),
      brand: editForm.brand.trim(),
      model: editForm.model.trim(),
      year: editForm.year ? Number(editForm.year) : null,
      notes: editForm.notes || null,
    };
    const res = await updateVehicle(payload);
    if (res.error) {
      setLocalError(res.error);
      return;
    }
    cancelEdit();
    invalidateAndRefetch();
  }

  const displayError = localError || (isError ? error?.message : null);

  return (
    <MobileShell title="Vehicles">
      <div className="space-y-4 p-4 pb-24">
        {displayError && (
          <div className="space-y-2">
            <Toast message={displayError} tone="error" />
            <button
              onClick={() => {
                setLocalError(null);
                refetch();
              }}
              className="w-full rounded-lg border-2 border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
            >
              Retry Load
            </button>
          </div>
        )}

        <input
          type="text"
          list="vehicle-search"
          placeholder="Search by code, plate, or name..."
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

        {editingVehicle && isAdmin && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Edit Vehicle</h3>
            <div className="space-y-3">
              <FormField
                label="Vehicle Code *"
                value={editForm.vehicle_code}
                onChange={(e) => setEditForm({ ...editForm, vehicle_code: e.target.value })}
                placeholder="e.g. HR38AF-4440"
                required
              />
              <FormField
                label="Brand *"
                value={editForm.brand}
                onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                placeholder="e.g. TOYOTA"
                required
              />
              <FormField
                label="Model *"
                value={editForm.model}
                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                placeholder="e.g. INNOVA CRYSTA"
                required
              />
              <FormField
                label="Year"
                value={editForm.year}
                onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                placeholder="e.g. 2023"
                type="number"
              />
              <FormField
                label="Notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex-1 rounded-lg border-2 border-slate-300 bg-white py-3 font-semibold text-slate-700 active:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="flex-1 rounded-lg bg-amber-500 py-3 font-semibold text-white active:bg-amber-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        {total > 0 && (
          <div className="text-sm text-slate-500">
            Showing {vehicles.length} of {total} vehicles
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
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
                        <button
                          onClick={() => router.push(`/vehicles/history?vehicle=${v.id}`)}
                          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white active:bg-purple-700"
                        >
                          History
                        </button>
                      </>
                    )}
                    {isAdmin && v.is_active && (
                      <>
                        <button
                          onClick={() => startEdit(v)}
                          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white active:bg-amber-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.vehicle_code)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="py-4 text-center">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Loading more...
                </div>
              )}
              {!hasNextPage && vehicles.length > 0 && (
                <p className="text-sm text-slate-400">All vehicles loaded</p>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
