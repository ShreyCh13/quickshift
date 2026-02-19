"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { loadSession, getSessionHeader } from "@/lib/auth";
import MobileShell from "@/components/MobileShell";
import type { VehicleHealth, IssueSeverity } from "@/app/api/alerts/route";

// ============================================================
// Types
// ============================================================

type Summary = {
  critical: number;
  warning: number;
  ok: number;
  noData: number;
  totalActive: number;
};

type Filter = "all" | "critical" | "warning";

// ============================================================
// Vehicle Health Card — compact, all issues in one card
// ============================================================

function HealthCard({ vehicle }: { vehicle: VehicleHealth }) {
  const isCritical = vehicle.status === "critical";

  return (
    <div
      className={`rounded-xl bg-white shadow-sm ring-1 overflow-hidden ${
        isCritical ? "ring-red-200" : "ring-amber-200"
      }`}
    >
      {/* Colour stripe */}
      <div className={`h-1 w-full ${isCritical ? "bg-red-500" : "bg-amber-400"}`} />

      <div className="p-4">
        {/* Vehicle identity */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isCritical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {isCritical ? "Needs attention" : "Review soon"}
              </span>
            </div>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">{vehicle.vehicleCode}</p>
            {(vehicle.vehicleBrand || vehicle.vehicleModel) && (
              <p className="text-xs text-slate-500">
                {[vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
          {/* Last activity snapshot */}
          <div className="shrink-0 text-right text-[11px] text-slate-400 leading-tight">
            {vehicle.daysSinceInspection != null && (
              <p>Inspect: {vehicle.daysSinceInspection}d ago</p>
            )}
            {vehicle.daysSinceMaintenance != null && (
              <p>Service: {vehicle.daysSinceMaintenance}d ago</p>
            )}
          </div>
        </div>

        {/* Issues list */}
        <ul className="space-y-1.5">
          {vehicle.issues.map((issue, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <IssueIcon severity={issue.severity} />
              <span className="leading-snug text-slate-700">{issue.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IssueIcon({ severity }: { severity: IssueSeverity }) {
  if (severity === "critical") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100">
        <svg className="h-2.5 w-2.5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100">
      <svg className="h-2.5 w-2.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

// ============================================================
// Fleet health bar
// ============================================================

function HealthBar({ summary }: { summary: Summary }) {
  const withData = summary.totalActive - summary.noData;
  const healthyPct = withData > 0 ? Math.round((summary.ok / withData) * 100) : 100;

  let grade: string;
  let gradeColor: string;
  let barColor: string;

  if (healthyPct >= 85) {
    grade = "Good"; gradeColor = "text-emerald-700"; barColor = "bg-emerald-500";
  } else if (healthyPct >= 60) {
    grade = "Fair"; gradeColor = "text-amber-700"; barColor = "bg-amber-400";
  } else {
    grade = "Poor"; gradeColor = "text-red-700"; barColor = "bg-red-500";
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fleet health</p>
          <p className={`text-2xl font-bold ${gradeColor}`}>{grade}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-800">{healthyPct}<span className="text-lg text-slate-400">%</span></p>
          <p className="text-xs text-slate-400">vehicles OK</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${healthyPct}%` }}
        />
      </div>

      {/* Breakdown pills */}
      <div className="flex gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {summary.critical} critical
        </span>
        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {summary.warning} warnings
        </span>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {summary.ok} ok
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Filter Tabs
// ============================================================

function FilterTabs({
  filter,
  setFilter,
  counts,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: { all: number; critical: number; warning: number };
}) {
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "warning", label: "Warnings", count: counts.warning },
  ];

  return (
    <div className="flex gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setFilter(tab.id)}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            filter === tab.id
              ? tab.id === "critical"
                ? "bg-red-500 text-white"
                : tab.id === "warning"
                ? "bg-amber-400 text-white"
                : "bg-slate-800 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span className={`ml-1 ${filter === tab.id ? "opacity-80" : "opacity-60"}`}>
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// No-data section (collapsed by default)
// ============================================================

function NoDataSection({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-200"
    >
      <span className="text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{count} vehicle{count > 1 ? "s" : ""}</span> with no records yet
      </span>
      <svg
        className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

// ============================================================
// How it works section
// ============================================================

function HowItWorks() {
  return (
    <details className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 select-none">
        How is this calculated?
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-500">
        <p><strong className="text-slate-700">Inspection timing</strong> — compares days since last inspection against that vehicle&apos;s own average inspection interval. No fixed deadline — each vehicle is judged by its own history.</p>
        <p><strong className="text-slate-700">Recurring issues</strong> — flags any checklist item that failed in 2 of the last 3 inspections. Indicates a persistent problem, not a one-off.</p>
        <p><strong className="text-slate-700">Recent failures</strong> — surfaces failed checklist items from inspections in the last 10 days. Safety-critical items (brakes, tyres, seat belts, dashboard warnings) are always escalated.</p>
        <p><strong className="text-slate-700">Service overdue</strong> — flags vehicles with no maintenance logged in 90+ days (warning) or 180+ days (critical).</p>
        <p><strong className="text-slate-700">Odometer gap</strong> — if the vehicle&apos;s odometer at last inspection is 5,000+ km ahead of the last service reading, a service may be due.</p>
        <p className="mt-2 italic">Vehicles with no data at all are not counted — they can&apos;t be analysed without a baseline.</p>
      </div>
    </details>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AlertsPage() {
  const router = useRouter();

  // Synchronous gate — check role before any render, avoid flash of content
  const initialSession = typeof window !== "undefined" ? loadSession() : null;
  const isAuthorised = initialSession?.user.role === "dev";

  const [vehicles, setVehicles] = useState<VehicleHealth[]>([]);
  const [summary, setSummary] = useState<Summary>({ critical: 0, warning: 0, ok: 0, noData: 0, totalActive: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    if (!initialSession) { router.replace("/login"); return; }
    if (!isAuthorised) { router.replace("/"); return; }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render nothing while redirect is in flight
  if (!isAuthorised) return null;

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", { headers: getSessionHeader() });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setVehicles(data.vehicles ?? []);
      setSummary(data.summary ?? { critical: 0, warning: 0, ok: 0, noData: 0, totalActive: 0 });
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return vehicles;
    return vehicles.filter((v) => v.status === filter);
  }, [vehicles, filter]);

  const counts = useMemo(() => ({
    all: vehicles.length,
    critical: vehicles.filter((v) => v.status === "critical").length,
    warning: vehicles.filter((v) => v.status === "warning").length,
  }), [vehicles]);

  return (
    <MobileShell title="Fleet Health">
      <div className="min-h-screen bg-slate-50 pb-28">
        <div className="mx-auto max-w-lg space-y-3 p-4 pt-3">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Fleet Health</h1>
              {lastRefreshed && !loading && (
                <p className="text-xs text-slate-400">
                  Updated {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-50 disabled:opacity-40"
            >
              <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <div className="h-28 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button onClick={fetchData} className="mt-2 text-sm font-semibold text-red-600 underline">Retry</button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              <HealthBar summary={summary} />

              {vehicles.length > 0 && (
                <FilterTabs filter={filter} setFilter={setFilter} counts={counts} />
              )}

              {/* All clear */}
              {filtered.length === 0 && (
                <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {filter === "all" ? "All vehicles are in good shape" : `No ${filter} issues`}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">Nothing needs attention right now.</p>
                </div>
              )}

              {/* Vehicle cards */}
              {filtered.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {filtered.length} vehicle{filtered.length !== 1 ? "s" : ""} need{filtered.length === 1 ? "s" : ""} attention
                  </p>
                  {filtered.map((v) => (
                    <HealthCard key={v.vehicleId} vehicle={v} />
                  ))}
                </div>
              )}

              {/* No-data vehicles — collapsed, not cluttering the list */}
              <NoDataSection count={summary.noData} />

              <HowItWorks />
            </>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
