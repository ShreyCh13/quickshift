"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, getSessionHeader } from "@/lib/auth";
import MobileShell from "@/components/MobileShell";
import type { Session, VehicleRow } from "@/lib/types";
import { fetchVehicles } from "@/features/vehicles/api";

const LIVE_SHEET_URL = "https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit?usp=sharing";

type AlertSummary = { critical: number; warning: number; info: number; total: number };

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [showLiveSheetConfirm, setShowLiveSheetConfirm] = useState(false);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    loadVehicles();
    loadAlertSummary();
  }, [router]);

  async function loadVehicles() {
    const data = await fetchVehicles({ page: 1, pageSize: 100 });
    setVehicles(data.vehicles || []);
  }

  async function loadAlertSummary() {
    try {
      const res = await fetch("/api/alerts", { headers: getSessionHeader() });
      if (res.ok) {
        const data = await res.json();
        setAlertSummary(data.summary ?? null);
      }
    } catch {
      // Non-critical — alerts banner is optional on homepage
    }
  }

  if (!session) return null;

  return (
    <MobileShell title="State Fleet">
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Dashboard header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Welcome back</p>
              <h1 className="text-lg font-bold text-slate-800">{session?.user.displayName}</h1>
            </div>
            <button
              onClick={() => setShowLiveSheetConfirm(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
              </svg>
              Live Sheet
            </button>
          </div>

          {/* Alert banner */}
          {alertSummary && (alertSummary.critical > 0 || alertSummary.warning > 0) && (
            <button
              onClick={() => router.push("/alerts")}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-sm transition active:opacity-80 ${
                alertSummary.critical > 0
                  ? "bg-red-50 ring-1 ring-red-200"
                  : "bg-amber-50 ring-1 ring-amber-200"
              }`}
            >
              <span className="text-2xl">{alertSummary.critical > 0 ? "🚨" : "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${alertSummary.critical > 0 ? "text-red-700" : "text-amber-700"}`}>
                  {alertSummary.critical > 0
                    ? `${alertSummary.critical} vehicle${alertSummary.critical > 1 ? "s" : ""} need immediate attention`
                    : `${alertSummary.warning} vehicle${alertSummary.warning > 1 ? "s" : ""} due for review`}
                </p>
                <p className={`text-xs ${alertSummary.critical > 0 ? "text-red-500" : "text-amber-500"}`}>
                  Tap to see fleet health
                </p>
              </div>
              <svg className={`h-4 w-4 flex-shrink-0 ${alertSummary.critical > 0 ? "text-red-400" : "text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

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
                    {v.vehicle_code} - {v.brand} {v.model}
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
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push("/inspections")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-2xl">📋</span>
              <span className="mt-1 text-sm font-bold text-blue-600">View Inspections</span>
            </button>
            <button
              onClick={() => router.push("/maintenance")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-2xl">🔧</span>
              <span className="mt-1 text-sm font-bold text-emerald-600">View Maintenance</span>
            </button>
            <button
              onClick={() => router.push("/analytics")}
              className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-2xl">📊</span>
              <span className="mt-1 text-sm font-bold text-purple-600">Analytics</span>
            </button>
            <button
              onClick={() => router.push("/alerts")}
              className="relative flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow transition hover:shadow-md"
            >
              <span className="text-2xl">🔔</span>
              <span className="mt-1 text-sm font-bold text-orange-600">Fleet Alerts</span>
              {alertSummary && alertSummary.critical > 0 && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {alertSummary.critical > 9 ? "9+" : alertSummary.critical}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Live Sheet confirmation modal */}
      {showLiveSheetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowLiveSheetConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">Open Live Sheet?</h2>
            <p className="mb-6 text-sm text-slate-500">
              View real-time fleet data in Google Sheets — inspections, maintenance records, and vehicle cost summaries, auto-refreshed every 5 minutes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLiveSheetConfirm(false)}
                className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
              >
                Cancel
              </button>
              <a
                href={LIVE_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowLiveSheetConfirm(false)}
                className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:bg-emerald-700"
              >
                Open Sheet
              </a>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
