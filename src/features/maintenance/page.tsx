"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import DataTable from "@/components/DataTable";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { MaintenanceRow, Session, VehicleRow } from "@/lib/types";
import { fetchMaintenance, createMaintenance } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";
import { buildExportUrl } from "@/features/admin/api";
import { StatCard } from "./components";

export default function MaintenancePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [items, setItems] = useState<MaintenanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    vehicle_id: "",
    date_from: "",
    date_to: "",
    odometer_min: "",
    odometer_max: "",
    supplier: "",
    amount_min: "",
    amount_max: "",
  });
  const [form, setForm] = useState({
    vehicle_id: "",
    odometer_km: "",
    bill_number: "",
    supplier_name: "",
    amount: "",
    remarks: "",
  });

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    setSession(sessionData);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetchVehicles({ page: 1, pageSize: 200, isActive: true }).then((res) =>
      setVehicles(res.vehicles || []),
    );
  }, [session]);

  async function loadMaintenance() {
    const filterPayload: Record<string, unknown> = {
      vehicle_id: filters.vehicle_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      odometer_min: filters.odometer_min ? Number(filters.odometer_min) : undefined,
      odometer_max: filters.odometer_max ? Number(filters.odometer_max) : undefined,
      supplier: filters.supplier || undefined,
      amount_min: filters.amount_min ? Number(filters.amount_min) : undefined,
      amount_max: filters.amount_max ? Number(filters.amount_max) : undefined,
    };
    const data = await fetchMaintenance({ filters: filterPayload, page: 1, pageSize: 50 });
    if (data.error) setError(data.error);
    setItems(data.maintenance || []);
  }

  useEffect(() => {
    if (!session) return;
    loadMaintenance();
  }, [session, filters]);

  async function handleCreate() {
    setError(null);
    const payload = {
      vehicle_id: form.vehicle_id,
      odometer_km: Number(form.odometer_km),
      bill_number: form.bill_number,
      supplier_name: form.supplier_name,
      amount: Number(form.amount),
      remarks: form.remarks,
    };
    const res = await createMaintenance(payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setForm({
      vehicle_id: "",
      odometer_km: "",
      bill_number: "",
      supplier_name: "",
      amount: "",
      remarks: "",
    });
    loadMaintenance();
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const exportUrl = useMemo(
    () =>
      buildExportUrl({
        type: "maintenance",
        format: "xlsx",
        filters: {
          vehicle_id: filters.vehicle_id || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          odometer_min: filters.odometer_min ? Number(filters.odometer_min) : undefined,
          odometer_max: filters.odometer_max ? Number(filters.odometer_max) : undefined,
          supplier: filters.supplier || undefined,
          amount_min: filters.amount_min ? Number(filters.amount_min) : undefined,
          amount_max: filters.amount_max ? Number(filters.amount_max) : undefined,
        },
      }),
    [filters],
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
    link.download = "maintenance.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MobileShell title="Maintenance">
      <div className="space-y-4">
        {error ? <Toast message={error} tone="error" /> : null}
        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">New Maintenance</div>
          <div className="space-y-3 pt-2">
            <label className="block text-sm">
              <span className="mb-1 block text-sm font-medium text-slate-700">Vehicle</span>
              <select
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-base"
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                required
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_code}
                  </option>
                ))}
              </select>
            </label>
            <FormField
              label="Odometer (km)"
              value={form.odometer_km}
              onChange={(e) => setForm({ ...form, odometer_km: e.target.value })}
              required
            />
            <FormField
              label="Bill Number"
              value={form.bill_number}
              onChange={(e) => setForm({ ...form, bill_number: e.target.value })}
              required
            />
            <FormField
              label="Supplier"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              required
            />
            <FormField
              label="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <FormField
              label="Remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={handleCreate}
              className="h-12 w-full rounded-md bg-emerald-600 text-base font-semibold text-white"
            >
              Save Maintenance
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Filters</div>
            <button
              type="button"
              onClick={downloadExport}
              className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white"
            >
              Export
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-sm font-medium text-slate-700">Vehicle</span>
              <select
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-base"
                value={filters.vehicle_id}
                onChange={(e) => setFilters({ ...filters, vehicle_id: e.target.value })}
              >
                <option value="">All vehicles</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_code}
                  </option>
                ))}
              </select>
            </label>
            <FormField
              label="Date From"
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
            <FormField
              label="Date To"
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
            <FormField
              label="Odometer Min"
              value={filters.odometer_min}
              onChange={(e) => setFilters({ ...filters, odometer_min: e.target.value })}
            />
            <FormField
              label="Odometer Max"
              value={filters.odometer_max}
              onChange={(e) => setFilters({ ...filters, odometer_max: e.target.value })}
            />
            <FormField
              label="Supplier"
              value={filters.supplier}
              onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
            />
            <FormField
              label="Amount Min"
              value={filters.amount_min}
              onChange={(e) => setFilters({ ...filters, amount_min: e.target.value })}
            />
            <FormField
              label="Amount Max"
              value={filters.amount_max}
              onChange={(e) => setFilters({ ...filters, amount_max: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total on page" value={totalAmount.toFixed(2)} />
          <StatCard label="Entries" value={String(items.length)} />
        </div>

        <DataTable
          columns={[
            { key: "created_at", label: "Date", render: (row) => new Date(row.created_at).toLocaleDateString() },
            { key: "supplier_name", label: "Supplier" },
            { key: "amount", label: "Amount" },
          ]}
          rows={items}
          renderExpanded={(row) => (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Bill</span>
                <span className="text-slate-900">{row.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Odometer</span>
                <span className="text-slate-900">{row.odometer_km}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remarks</span>
                <span className="text-slate-900">{row.remarks}</span>
              </div>
            </div>
          )}
        />
      </div>
    </MobileShell>
  );
}
