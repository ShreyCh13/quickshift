"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession } from "@/lib/auth";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles } from "./api";

export default function VehiclesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    setSession(sessionData);
  }, [router]);

  async function loadVehicles() {
    setLoading(true);
    const data = await fetchVehicles({ search, page: 1, pageSize: 100 });
    setVehicles(data.vehicles || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    loadVehicles();
  }, [session, search]);

  return (
    <MobileShell title="Vehicles">
      <div className="space-y-3 p-4">
        <input
          type="text"
          list="vehicle-search"
          placeholder="Search vehicle code or plate..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />
        <datalist id="vehicle-search">
          {vehicles.map((v) => (
            <option key={v.id} value={v.vehicle_code}>
              {v.plate_number} - {v.model}
            </option>
          ))}
        </datalist>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-slate-50 px-6 py-12 text-center">
            <p className="text-slate-600 font-medium">No vehicles found</p>
            <p className="mt-1 text-sm text-slate-400">Contact admin to add vehicles</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border-2 border-slate-100 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-slate-900">{v.vehicle_code}</div>
                    <div className="mt-1 text-sm text-slate-600">{v.model || "Model N/A"}</div>
                    {v.plate_number && (
                      <div className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {v.plate_number}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/inspections/new?vehicle=${v.id}`)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() => router.push(`/maintenance/new?vehicle=${v.id}`)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Maintain
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
