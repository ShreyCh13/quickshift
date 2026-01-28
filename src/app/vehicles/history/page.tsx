"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { clearSession, loadSession, getSessionHeader } from "@/lib/auth";
import type { Session, VehicleRow, InspectionRow, MaintenanceRow } from "@/lib/types";
import Toast from "@/components/Toast";
import * as XLSX from "xlsx";

type InspectionWithVehicle = InspectionRow & {
  vehicles?: { vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null };
};

type MaintenanceWithVehicle = MaintenanceRow & {
  vehicles?: { vehicle_code: string; plate_number: string | null; brand: string | null; model: string | null };
};

type HistoryItem = {
  type: "inspection" | "maintenance";
  date: string;
  data: InspectionWithVehicle | MaintenanceWithVehicle;
};

export default function VehicleHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get("vehicle");

  const [session, setSession] = useState<Session | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [inspections, setInspections] = useState<InspectionWithVehicle[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "inspections" | "maintenance">("all");

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    setSession(sessionData);
  }, [router]);

  const loadVehicleData = useCallback(async () => {
    if (!vehicleId) {
      setError("No vehicle specified");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch vehicle info
      const vehicleRes = await fetch(`/api/vehicles?search=${vehicleId}`, {
        headers: { ...getSessionHeader() },
      });
      const vehicleData = await vehicleRes.json();
      
      if (vehicleData.error) {
        if (vehicleData.error === "Unauthorized") {
          clearSession();
          router.replace("/login");
          return;
        }
        setError(vehicleData.error);
        setLoading(false);
        return;
      }

      // Find the specific vehicle
      const foundVehicle = vehicleData.vehicles?.find((v: VehicleRow) => v.id === vehicleId);
      if (foundVehicle) {
        setVehicle(foundVehicle);
      }

      // Fetch inspections for this vehicle
      const inspFilters = btoa(JSON.stringify({ vehicle_id: vehicleId }));
      const inspRes = await fetch(`/api/events/inspections?filters=${inspFilters}&pageSize=1000`, {
        headers: { ...getSessionHeader() },
      });
      const inspData = await inspRes.json();
      
      if (!inspData.error) {
        setInspections(inspData.inspections || []);
      }

      // Fetch maintenance for this vehicle
      const maintFilters = btoa(JSON.stringify({ vehicle_id: vehicleId }));
      const maintRes = await fetch(`/api/events/maintenance?filters=${maintFilters}&pageSize=1000`, {
        headers: { ...getSessionHeader() },
      });
      const maintData = await maintRes.json();
      
      if (!maintData.error) {
        setMaintenance(maintData.maintenance || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }

    setLoading(false);
  }, [vehicleId, router]);

  useEffect(() => {
    if (session && vehicleId) {
      loadVehicleData();
    }
  }, [session, vehicleId, loadVehicleData]);

  // Combine and sort history items
  const historyItems: HistoryItem[] = [
    ...inspections.map((i) => ({ type: "inspection" as const, date: i.created_at, data: i })),
    ...maintenance.map((m) => ({ type: "maintenance" as const, date: m.created_at, data: m })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredItems = activeTab === "all" 
    ? historyItems 
    : historyItems.filter((item) => item.type === (activeTab === "inspections" ? "inspection" : "maintenance"));

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleExport() {
    if (!vehicle) return;

    // Prepare inspections data
    const inspectionRows = inspections.map((i) => ({
      Type: "Inspection",
      Date: formatDate(i.created_at),
      "Odometer (km)": i.odometer_km,
      Driver: i.driver_name || "-",
      ...Object.entries(i.remarks_json || {}).reduce((acc, [key, value]) => {
        acc[`Remark: ${key}`] = value;
        return acc;
      }, {} as Record<string, string>),
    }));

    // Prepare maintenance data
    const maintenanceRows = maintenance.map((m) => ({
      Type: "Maintenance",
      Date: formatDate(m.created_at),
      "Odometer (km)": m.odometer_km,
      "Bill Number": m.bill_number,
      Supplier: m.supplier_name,
      Amount: m.amount,
      Remarks: m.remarks,
    }));

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      { Field: "Vehicle Code", Value: vehicle.vehicle_code },
      { Field: "Plate Number", Value: vehicle.plate_number || "-" },
      { Field: "Brand", Value: vehicle.brand || "-" },
      { Field: "Model", Value: vehicle.model || "-" },
      { Field: "Year", Value: vehicle.year || "-" },
      { Field: "Total Inspections", Value: inspections.length },
      { Field: "Total Maintenance Records", Value: maintenance.length },
      { Field: "Total Maintenance Cost", Value: maintenance.reduce((sum, m) => sum + (m.amount || 0), 0) },
      { Field: "Export Date", Value: new Date().toLocaleString() },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // Inspections sheet
    if (inspectionRows.length > 0) {
      const inspWs = XLSX.utils.json_to_sheet(inspectionRows);
      XLSX.utils.book_append_sheet(wb, inspWs, "Inspections");
    }

    // Maintenance sheet
    if (maintenanceRows.length > 0) {
      const maintWs = XLSX.utils.json_to_sheet(maintenanceRows);
      XLSX.utils.book_append_sheet(wb, maintWs, "Maintenance");
    }

    // Download
    const fileName = `${vehicle.vehicle_code}_history_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  return (
    <MobileShell title="Vehicle History" backHref="/vehicles">
      <div className="space-y-4 p-4 pb-24">
        {error && <Toast message={error} tone="error" />}

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : !vehicle ? (
          <div className="rounded-xl border-2 border-dashed bg-slate-50 px-6 py-12 text-center">
            <p className="font-medium text-slate-600">Vehicle not found</p>
            <button
              onClick={() => router.push("/vehicles")}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Back to Vehicles
            </button>
          </div>
        ) : (
          <>
            {/* Vehicle Info Header */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xl font-bold text-slate-900">{vehicle.vehicle_code}</div>
                  {vehicle.plate_number && (
                    <div className="text-xs font-medium text-slate-500">Plate: {vehicle.plate_number}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    {vehicle.brand && <span className="font-medium text-blue-700">{vehicle.brand}</span>}
                    {vehicle.model && <span>{vehicle.model}</span>}
                    {vehicle.year && <span className="text-slate-400">({vehicle.year})</span>}
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white active:bg-green-700"
                >
                  Export
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{inspections.length}</div>
                <div className="text-xs text-blue-600">Inspections</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">{maintenance.length}</div>
                <div className="text-xs text-emerald-600">Maintenance</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {maintenance.reduce((sum, m) => sum + (m.amount || 0), 0).toLocaleString()}
                </div>
                <div className="text-xs text-purple-600">Total Cost</div>
              </div>
            </div>

            {/* Tab Filters */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  activeTab === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 active:bg-slate-200"
                }`}
              >
                All ({historyItems.length})
              </button>
              <button
                onClick={() => setActiveTab("inspections")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  activeTab === "inspections"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 active:bg-slate-200"
                }`}
              >
                Inspections ({inspections.length})
              </button>
              <button
                onClick={() => setActiveTab("maintenance")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  activeTab === "maintenance"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 active:bg-slate-200"
                }`}
              >
                Maintenance ({maintenance.length})
              </button>
            </div>

            {/* History Timeline */}
            {filteredItems.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed bg-slate-50 px-6 py-12 text-center">
                <p className="font-medium text-slate-600">No records found</p>
                <p className="mt-1 text-sm text-slate-400">
                  Start by creating an inspection or maintenance record
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={`${item.type}-${item.data.id}`}
                    className={`rounded-xl border-2 bg-white p-4 shadow-sm ${
                      item.type === "inspection" ? "border-blue-100" : "border-emerald-100"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              item.type === "inspection"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {item.type === "inspection" ? "INSPECTION" : "MAINTENANCE"}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
                        </div>

                        {item.type === "inspection" ? (
                          <div className="mt-2">
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Odometer:</span>{" "}
                              {(item.data as InspectionWithVehicle).odometer_km?.toLocaleString()} km
                            </div>
                            {(item.data as InspectionWithVehicle).driver_name && (
                              <div className="text-sm text-slate-600">
                                <span className="font-medium">Driver:</span>{" "}
                                {(item.data as InspectionWithVehicle).driver_name}
                              </div>
                            )}
                            {(item.data as InspectionWithVehicle).remarks_json && (
                              <div className="mt-2 space-y-1">
                                {Object.entries((item.data as InspectionWithVehicle).remarks_json || {}).map(
                                  ([key, value]) => (
                                    <div key={key} className="text-xs text-slate-500">
                                      <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                                      {value}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2">
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Odometer:</span>{" "}
                              {(item.data as MaintenanceWithVehicle).odometer_km?.toLocaleString()} km
                            </div>
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Bill:</span>{" "}
                              {(item.data as MaintenanceWithVehicle).bill_number}
                            </div>
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Supplier:</span>{" "}
                              {(item.data as MaintenanceWithVehicle).supplier_name}
                            </div>
                            <div className="mt-1 text-base font-bold text-emerald-700">
                              ₹{(item.data as MaintenanceWithVehicle).amount?.toLocaleString()}
                            </div>
                            {(item.data as MaintenanceWithVehicle).remarks && (
                              <div className="mt-1 text-xs text-slate-500">
                                {(item.data as MaintenanceWithVehicle).remarks}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
