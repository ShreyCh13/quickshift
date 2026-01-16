"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import Toast from "@/components/Toast";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchAnalytics } from "./api";
import { fetchVehicles } from "@/features/vehicles/api";
import { MetricCard } from "./components";

type AnalyticsResponse = {
  monthly?: Array<{ month: string; total: number }>;
  topSuppliers?: Array<{ name: string; total: number }>;
  topVehicles?: Array<{ vehicle_id: string; total: number }>;
  error?: string;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [data, setData] = useState<AnalyticsResponse>({});
  const [error, setError] = useState<string | null>(null);

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
    fetchVehicles({ page: 1, pageSize: 500 }).then((res) => setVehicles(res.vehicles || []));
    fetchAnalytics().then((res) => {
      if (res.error) setError(res.error);
      setData(res);
    });
  }, [session]);

  const vehicleMap = useMemo(() => {
    const map: Record<string, string> = {};
    vehicles.forEach((v) => {
      map[v.id] = v.vehicle_code;
    });
    return map;
  }, [vehicles]);

  return (
    <MobileShell title="Analytics">
      <div className="space-y-4">
        {error ? <Toast message={error} tone="error" /> : null}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Months" value={String(data.monthly?.length || 0)} />
          <MetricCard label="Suppliers" value={String(data.topSuppliers?.length || 0)} />
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">Monthly Maintenance Total</div>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {(data.monthly || []).map((row) => (
              <div key={row.month} className="flex justify-between">
                <span>{row.month}</span>
                <span>{row.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">Top Suppliers</div>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {(data.topSuppliers || []).map((row) => (
              <div key={row.name} className="flex justify-between">
                <span>{row.name}</span>
                <span>{row.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-semibold text-slate-900">Top Vehicles</div>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {(data.topVehicles || []).map((row) => (
              <div key={row.vehicle_id} className="flex justify-between">
                <span>{vehicleMap[row.vehicle_id] || row.vehicle_id}</span>
                <span>{row.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
