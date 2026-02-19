"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Autocomplete from "@/components/Autocomplete";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";
import { createMaintenance } from "@/features/maintenance/api";

function fetchSupplierSuggestions(search: string): Promise<string[]> {
  const params = new URLSearchParams({ active: "true" });
  if (search.trim()) params.set("search", search.trim());
  return fetch(`/api/suppliers?${params}`, { headers: getSessionHeader() })
    .then((r) => r.json())
    .then((d) => (d.suppliers || []).map((s: { name: string }) => s.name))
    .catch(() => []);
}

async function addSupplier(name: string) {
  await fetch("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getSessionHeader() },
    body: JSON.stringify({ name }),
  });
}

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
    supplier_invoice_number: "",
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
    fetchVehicles({ page: 1, pageSize: 200 }).then((res) => {
      setVehicles(res.vehicles || []);
      if (vehicleParam) setFormData((prev) => ({ ...prev, vehicle_id: vehicleParam }));
    });
  }, [router, vehicleParam]);

  function set(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const { vehicle_id, odometer_km, bill_number, supplier_name, supplier_invoice_number, amount, remarks } = formData;
    if (!vehicle_id || !odometer_km || !bill_number || !supplier_name || !supplier_invoice_number || !amount || !remarks) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createMaintenance({
      vehicle_id,
      odometer_km: Number(odometer_km),
      bill_number: bill_number.trim(),
      supplier_name: supplier_name.trim(),
      supplier_invoice_number: supplier_invoice_number.trim(),
      amount: Number(amount),
      remarks: remarks.trim(),
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
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4 pb-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {error && <Toast message={error} tone="error" />}

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Create Maintenance Record</h2>

            <div className="space-y-4">
              {/* Vehicle */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Vehicle <span className="text-red-500">*</span></span>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => set("vehicle_id", e.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
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
                onChange={(e) => set("odometer_km", e.target.value)}
                placeholder="e.g. 45000"
              />

              <FormField
                label="Bill Number *"
                value={formData.bill_number}
                onChange={(e) => set("bill_number", e.target.value)}
                placeholder="e.g. BILL-2024-001"
              />

              {/* Supplier Name — autocomplete */}
              <Autocomplete
                label="Supplier Name"
                value={formData.supplier_name}
                onChange={(v) => set("supplier_name", v)}
                onAddNew={addSupplier}
                fetchSuggestions={fetchSupplierSuggestions}
                placeholder="Search or add supplier..."
                required
                accentColor="emerald"
              />

              <FormField
                label="Supplier Invoice Number *"
                value={formData.supplier_invoice_number}
                onChange={(e) => set("supplier_invoice_number", e.target.value)}
                placeholder="e.g. INV-2024-5678"
              />

              <FormField
                label="Amount (₹) *"
                type="number"
                value={formData.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="e.g. 5000"
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Remarks <span className="text-red-500">*</span></span>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                  placeholder="Describe the maintenance work done..."
                  rows={4}
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-sm font-semibold text-slate-700">Created By</span>
                <div className="mt-1 flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-3">
                  <span>👤</span>
                  <span className="font-medium text-slate-900">{session.user.displayName}</span>
                  <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Auto-filled</span>
                </div>
              </div>

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
                  className="flex-1 rounded-xl bg-emerald-600 py-3.5 font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>}>
      <NewMaintenanceForm />
    </Suspense>
  );
}
