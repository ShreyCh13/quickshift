"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import Autocomplete from "@/components/Autocomplete";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { Session, VehicleRow, ChecklistItem, ChecklistItemRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";
import { createInspection } from "@/features/inspections/api";
import { INSPECTION_CATEGORIES } from "@/lib/constants";

type ChecklistState = Record<string, ChecklistItem>;
type DynamicCategory = { key: string; label: string; fields: { key: string; label: string }[] };

function buildCategories(dbItems: ChecklistItemRow[]): DynamicCategory[] {
  const map = new Map<string, DynamicCategory>();
  for (const item of dbItems) {
    if (!map.has(item.category_key)) {
      map.set(item.category_key, { key: item.category_key, label: item.category_label, fields: [] });
    }
    map.get(item.category_key)!.fields.push({ key: item.item_key, label: item.item_label });
  }
  return Array.from(map.values());
}

function buildInitialChecklist(categories: DynamicCategory[]): ChecklistState {
  const state: ChecklistState = {};
  for (const cat of categories) {
    for (const field of cat.fields) {
      state[field.key] = { ok: false, remarks: "" };
    }
  }
  return state;
}

/** Fallback static categories when DB is unavailable */
const FALLBACK_CATEGORIES: DynamicCategory[] = INSPECTION_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.label,
  fields: c.fields.map((f) => ({ key: f.key, label: f.label })),
}));

function fetchDriverSuggestions(search: string): Promise<string[]> {
  const params = new URLSearchParams({ active: "true" });
  if (search.trim()) params.set("search", search.trim());
  return fetch(`/api/drivers?${params}`, { headers: getSessionHeader() })
    .then((r) => r.json())
    .then((d) => (d.drivers || []).map((dr: { name: string }) => dr.name))
    .catch(() => []);
}

async function addDriver(name: string) {
  await fetch("/api/drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ name }),
  });
}

function NewInspectionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleParam = searchParams.get("vehicle");

  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<DynamicCategory[]>(FALLBACK_CATEGORIES);

  const [vehicleId, setVehicleId] = useState(vehicleParam || "");
  const [odometerKm, setOdometerKm] = useState("");
  const [driverName, setDriverName] = useState("");
  const [checklist, setChecklist] = useState<ChecklistState>(() => buildInitialChecklist(FALLBACK_CATEGORIES));
  const [touched, setTouched] = useState<Set<string>>(new Set());

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    fetchVehicles({ page: 1, pageSize: 200 }).then((res) => setVehicles(res.vehicles || []));

    // Fetch DB checklist items; fall back to constants if unavailable
    fetch("/api/config/checklist?activeOnly=1", { headers: getSessionHeader() })
      .then((r) => r.json())
      .then((d: { checklistItems?: ChecklistItemRow[] }) => {
        if (d.checklistItems && d.checklistItems.length > 0) {
          const cats = buildCategories(d.checklistItems);
          setCategories(cats);
          setChecklist(buildInitialChecklist(cats));
        }
      })
      .catch(() => {
        // Keep fallback categories already set
      });
  }, [router]);

  function setItem(key: string, patch: Partial<ChecklistItem>) {
    setChecklist((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function touchItem(key: string) {
    setTouched((prev) => new Set(prev).add(key));
  }

  async function handleSubmit() {
    if (!vehicleId || !odometerKm) {
      setError("Vehicle and odometer are required");
      return;
    }

    if (!driverName.trim()) {
      setError("Driver name is required");
      return;
    }

    // Validate: failed items must have remarks
    const missingRemarks = categories.flatMap((cat) =>
      cat.fields.filter((f) => {
        const item = checklist[f.key];
        return !item.ok && !item.remarks.trim();
      })
    ).map((f) => f.label);

    if (missingRemarks.length > 0) {
      setError(`Remarks required for: ${missingRemarks.slice(0, 3).join(", ")}${missingRemarks.length > 3 ? "..." : ""}`);
      return;
    }

    setLoading(true);
    setError(null);

    // Auto-add driver to list if they typed a new name not already saved
    const trimmedDriver = driverName.trim();
    try {
      const existing = await fetchDriverSuggestions(trimmedDriver);
      const alreadyExists = existing.some((n) => n.toLowerCase() === trimmedDriver.toLowerCase());
      if (!alreadyExists) {
        await addDriver(trimmedDriver);
      }
    } catch {
      // Non-fatal — driver name still saved on the inspection record
    }

    const res = await createInspection({
      vehicle_id: vehicleId,
      odometer_km: Number(odometerKm),
      driver_name: trimmedDriver,
      remarks_json: checklist,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    router.push("/inspections");
  }

  if (!session) return null;

  const passCount = Object.values(checklist).filter((i) => i.ok).length;
  const totalCount = categories.flatMap((c) => c.fields).length;

  return (
    <MobileShell title="New Inspection">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {error && <Toast message={error} tone="error" />}

          {/* Vehicle & Basic Info */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Vehicle Details</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Vehicle <span className="text-red-500">*</span></span>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_code} - {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Odometer (km) <span className="text-red-500">*</span></span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                />
              </label>

              <Autocomplete
                label="Driver Name"
                value={driverName}
                onChange={setDriverName}
                onAddNew={addDriver}
                fetchSuggestions={fetchDriverSuggestions}
                placeholder="Search or add driver..."
                accentColor="blue"
                required
              />

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-sm font-semibold text-slate-700">Created By</span>
                <div className="mt-1 flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-3">
                  <span>👤</span>
                  <span className="font-medium text-slate-900">{session.user.displayName}</span>
                  <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Auto-filled</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-sm">
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                <span>Checklist Progress</span>
                <span>{passCount}/{totalCount} OK</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(passCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist by category */}
          {categories.map((cat) => (
            <div key={cat.key} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="bg-blue-600 px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">{cat.label}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {cat.fields.map((field) => {
                  const item = checklist[field.key];
                  return (
                    <div key={field.key} className={`px-4 py-3 transition-colors ${!item.ok ? "bg-red-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.ok && !touched.has(field.key)) {
                              // First tap on a ✗ item: open remarks textarea, stay ✗
                              touchItem(field.key);
                            } else if (!item.ok && touched.has(field.key)) {
                              // Second tap: mark as ✓ OK, clear remarks
                              setItem(field.key, { ok: true, remarks: "" });
                              setTouched((prev) => { const n = new Set(prev); n.delete(field.key); return n; });
                            } else {
                              // Currently ✓: toggle to ✗ and open remarks
                              setItem(field.key, { ok: false, remarks: "" });
                              touchItem(field.key);
                            }
                          }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                            item.ok
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-red-400 bg-white text-red-400"
                          }`}
                        >
                          {item.ok ? "✓" : "✗"}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${item.ok ? "text-slate-700" : "text-red-700"}`}>
                            {field.label}
                          </span>
                          {!item.ok && !touched.has(field.key) && (
                            <span className="ml-2 text-xs text-red-400">tap ✗ to add issue / tap ✓ to pass</span>
                          )}
                        </div>
                      </div>

                      {/* Remarks field — shown after first tap on a ✗ item */}
                      {!item.ok && touched.has(field.key) && (
                        <div className="mt-2 pl-10">
                          <textarea
                            value={item.remarks}
                            onChange={(e) => setItem(field.key, { remarks: e.target.value })}
                            placeholder="Describe the issue (required) *"
                            rows={2}
                            className="w-full rounded-lg border-2 border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                            autoFocus
                          />
                          <p className="mt-1 text-xs text-slate-400">Tap ✗ again to mark as ✓ OK instead</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-xl border-2 border-slate-300 py-3.5 font-semibold text-slate-700 active:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 py-3.5 font-semibold text-white active:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Inspection"}
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <NewInspectionForm />
    </Suspense>
  );
}
