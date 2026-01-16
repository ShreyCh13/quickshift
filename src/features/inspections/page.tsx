"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import DataTable from "@/components/DataTable";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { InspectionRow, RemarkFieldRow, Session, VehicleRow } from "@/lib/types";
import { RemarkFieldsForm } from "./components";
import { fetchInspections, createInspection } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";
import { fetchRemarkFields, buildExportUrl } from "@/features/admin/api";

export default function InspectionsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [remarkFields, setRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersState, setFiltersState] = useState({
    vehicle_id: "",
    date_from: "",
    date_to: "",
    odometer_min: "",
    odometer_max: "",
  });
  const [form, setForm] = useState({
    vehicle_id: "",
    odometer_km: "",
    driver_name: "",
  });
  const [remarks, setRemarks] = useState<Record<string, string>>({});

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
    fetchRemarkFields(true).then((res) => setRemarkFields(res.remarkFields || []));
  }, [session]);

  async function loadInspections() {
    const remarkFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value),
    );
    const filterPayload: Record<string, unknown> = {
      vehicle_id: filtersState.vehicle_id || undefined,
      date_from: filtersState.date_from || undefined,
      date_to: filtersState.date_to || undefined,
      odometer_min: filtersState.odometer_min ? Number(filtersState.odometer_min) : undefined,
      odometer_max: filtersState.odometer_max ? Number(filtersState.odometer_max) : undefined,
      remarks: Object.keys(remarkFilters).length ? remarkFilters : undefined,
    };
    const data = await fetchInspections({ filters: filterPayload, page: 1, pageSize: 50 });
    if (data.error) setError(data.error);
    setInspections(data.inspections || []);
  }

  useEffect(() => {
    if (!session) return;
    loadInspections();
  }, [session, filtersState, filters]);

  async function handleCreate() {
    setError(null);
    const payload = {
      vehicle_id: form.vehicle_id,
      odometer_km: Number(form.odometer_km),
      driver_name: form.driver_name || null,
      remarks_json: remarks,
    };
    const res = await createInspection(payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setForm({ vehicle_id: "", odometer_km: "", driver_name: "" });
    setRemarks({});
    loadInspections();
  }

  const exportUrl = useMemo(() => {
    const remarkFilters = Object.entries(filters).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value) acc[key] = value;
      return acc;
    }, {});
    return buildExportUrl({
      type: "inspections",
      format: "xlsx",
      filters: {
        vehicle_id: filtersState.vehicle_id || undefined,
        date_from: filtersState.date_from || undefined,
        date_to: filtersState.date_to || undefined,
        odometer_min: filtersState.odometer_min ? Number(filtersState.odometer_min) : undefined,
        odometer_max: filtersState.odometer_max ? Number(filtersState.odometer_max) : undefined,
        remarks: Object.keys(remarkFilters).length ? remarkFilters : undefined,
      },
    });
  }, [filtersState, filters]);

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
    link.download = "inspections.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MobileShell title="Inspections">
      <div className="space-y-4">
        {error ? <Toast message={error} tone="error" /> : null}

        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">New Inspection</div>
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
                    {vehicle.vehicle_code} ({vehicle.plate_number || "No plate"})
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
              label="Driver Name"
              value={form.driver_name}
              onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
            />
            <RemarkFieldsForm
              remarkFields={remarkFields}
              values={remarks}
              onChange={(key, value) => setRemarks((prev) => ({ ...prev, [key]: value }))}
            />
            <button
              type="button"
              onClick={handleCreate}
              className="h-12 w-full rounded-md bg-emerald-600 text-base font-semibold text-white"
            >
              Save Inspection
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
                value={filtersState.vehicle_id}
                onChange={(e) => setFiltersState({ ...filtersState, vehicle_id: e.target.value })}
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
              value={filtersState.date_from}
              onChange={(e) => setFiltersState({ ...filtersState, date_from: e.target.value })}
            />
            <FormField
              label="Date To"
              type="date"
              value={filtersState.date_to}
              onChange={(e) => setFiltersState({ ...filtersState, date_to: e.target.value })}
            />
            <FormField
              label="Odometer Min"
              value={filtersState.odometer_min}
              onChange={(e) => setFiltersState({ ...filtersState, odometer_min: e.target.value })}
            />
            <FormField
              label="Odometer Max"
              value={filtersState.odometer_max}
              onChange={(e) => setFiltersState({ ...filtersState, odometer_max: e.target.value })}
            />
            {remarkFields.map((field) => (
              <FormField
                key={field.key}
                label={`Remark contains (${field.label})`}
                value={filters[field.key] || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            ))}
          </div>
        </div>

        <DataTable
          columns={[
            { key: "created_at", label: "Date", render: (row) => new Date(row.created_at).toLocaleDateString() },
            { key: "odometer_km", label: "Odometer" },
            { key: "driver_name", label: "Driver" },
          ]}
          rows={inspections}
          renderExpanded={(row) => (
            <div className="space-y-1 text-sm">
              {Object.entries(row.remarks_json || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-slate-500">{key}</span>
                  <span className="text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          )}
        />
      </div>
    </MobileShell>
  );
}
