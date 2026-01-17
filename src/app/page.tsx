"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/auth";
import MobileShell from "@/components/MobileShell";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");

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
    const data = await fetchVehicles({ page: 1, pageSize: 100 });
    setVehicles(data.vehicles || []);
  }

  if (!session) return null;

  return (
    <MobileShell title="QuickShift">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-slate-900">Quick Actions</h2>

            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Select Vehicle</span>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base font-medium focus:border-blue-500 focus:outline-none"
              >
                <option value="">Choose vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_code} - {v.plate_number || v.model}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  selectedVehicle
                    ? router.push(`/inspections/new?vehicle=${selectedVehicle}`)
                    : alert("Select a vehicle first")
                }
                className="flex h-32 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md transition hover:shadow-xl"
              >
                <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span className="text-lg font-bold">Inspection</span>
              </button>

              <button
                onClick={() =>
                  selectedVehicle
                    ? router.push(`/maintenance/new?vehicle=${selectedVehicle}`)
                    : alert("Select a vehicle first")
                }
                className="flex h-32 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md transition hover:shadow-xl"
              >
                <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-lg font-bold">Maintenance</span>
              </button>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => router.push("/inspections")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-xs font-semibold text-slate-600">View</span>
              <span className="mt-1 text-sm font-bold text-blue-600">Inspections</span>
            </button>
            <button
              onClick={() => router.push("/maintenance")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-xs font-semibold text-slate-600">View</span>
              <span className="mt-1 text-sm font-bold text-emerald-600">Maintenance</span>
            </button>
            <button
              onClick={() => router.push("/analytics")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-xs font-semibold text-slate-600">View</span>
              <span className="mt-1 text-sm font-bold text-purple-600">Analytics</span>
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
