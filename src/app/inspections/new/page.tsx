"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow, RemarkFieldRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";
import { createInspection } from "@/features/inspections/api";

function NewInspectionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleParam = searchParams.get("vehicle");

  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [remarkFields, setRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicleParam || "",
    odometer_km: "",
    driver_name: "",
    remarks: {} as Record<string, string>,
  });

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    loadData();
  }, [router]);

  async function loadData() {
    const [vehiclesRes, remarksRes] = await Promise.all([
      fetchVehicles({ page: 1, pageSize: 200 }),
      fetch("/api/config/remarks", { headers: { "x-qs-session": JSON.stringify(loadSession()) } }).then((r) =>
        r.json(),
      ),
    ]);

    setVehicles(vehiclesRes.vehicles || []);
    const fields = remarksRes.remarkFields || [];
    setRemarkFields(fields);

    const initialRemarks: Record<string, string> = {};
    fields.forEach((f: RemarkFieldRow) => {
      initialRemarks[f.key] = "";
    });
    setFormData((prev) => ({ ...prev, remarks: initialRemarks, vehicle_id: vehicleParam || prev.vehicle_id }));
  }

  async function handleSubmit() {
    if (!formData.vehicle_id || !formData.odometer_km) {
      setError("Vehicle and odometer are required");
      return;
    }

    const allFilled = Object.values(formData.remarks).every((v) => v.trim().length > 0);
    if (!allFilled) {
      setError("All inspection fields are required (use N/A if not applicable)");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createInspection({
      vehicle_id: formData.vehicle_id,
      odometer_km: Number(formData.odometer_km),
      driver_name: formData.driver_name || null,
      remarks_json: formData.remarks,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    router.push("/inspections");
  }

  if (!session) return null;

  return (
    <MobileShell title="New Inspection">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {error && <Toast message={error} tone="error" />}

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-slate-900">Create Inspection</h2>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Vehicle *</span>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_code} - {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </label>

              <FormField
                label="Odometer (km) *"
                type="number"
                value={formData.odometer_km}
                onChange={(e) => setFormData({ ...formData, odometer_km: e.target.value })}
                required
              />

              <FormField
                label="Driver Name"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-lg font-semibold text-slate-900">Inspection Checklist</h3>
                {remarkFields.map((field) => (
                  <FormField
                    key={field.key}
                    label={`${field.label} *`}
                    value={formData.remarks[field.key] || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        remarks: { ...formData.remarks, [field.key]: e.target.value },
                      })
                    }
                    placeholder="Enter status or N/A"
                    required
                  />
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => router.back()}
                  className="flex-1 rounded-lg border-2 border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Inspection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewInspectionForm />
    </Suspense>
  );
}
