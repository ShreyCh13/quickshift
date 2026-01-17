"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";
import { createMaintenance } from "@/features/maintenance/api";

function NewMaintenanceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleParam = searchParams.get("vehicle");

  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicleParam || "",
    odometer_km: "",
    bill_number: "",
    supplier_name: "",
    amount: "",
    remarks: "",
  });

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    loadVehicles();
  }, [router]);

  async function loadVehicles() {
    const res = await fetchVehicles({ page: 1, pageSize: 200 });
    setVehicles(res.vehicles || []);
    if (vehicleParam) {
      setFormData((prev) => ({ ...prev, vehicle_id: vehicleParam }));
    }
  }

  async function handleSubmit() {
    if (!formData.vehicle_id || !formData.odometer_km || !formData.bill_number || !formData.supplier_name || !formData.amount || !formData.remarks) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createMaintenance({
      vehicle_id: formData.vehicle_id,
      odometer_km: Number(formData.odometer_km),
      bill_number: formData.bill_number,
      supplier_name: formData.supplier_name,
      amount: Number(formData.amount),
      remarks: formData.remarks,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    router.push("/maintenance");
  }

  if (!session) return null;

  return (
    <MobileShell title="New Maintenance">
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {error && <Toast message={error} tone="error" />}

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-slate-900">Create Maintenance Record</h2>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Vehicle *</span>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
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
                label="Bill Number *"
                value={formData.bill_number}
                onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                placeholder="e.g. INV-2024-001"
                required
              />

              <FormField
                label="Supplier Name *"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="e.g. ABC Motors"
                required
              />

              <FormField
                label="Amount (₹) *"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="e.g. 5000"
                required
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Remarks *</span>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter maintenance details or N/A"
                  rows={4}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
                  required
                />
              </label>

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
                  className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Maintenance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

export default function NewMaintenancePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewMaintenanceForm />
    </Suspense>
  );
}
