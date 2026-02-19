"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { loadSession, getSessionHeader } from "@/lib/auth";
import MobileShell from "@/components/MobileShell";
import type { FleetAlert, AlertSeverity } from "@/lib/types";

// ============================================================
// Icons
// ============================================================

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconWrench({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconGauge({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconRepeat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function IconExclamation({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ============================================================
// Config maps
// ============================================================

const ALERT_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  INSPECTION_OVERDUE: IconClipboard,
  INSPECTION_CRITICAL: IconClipboard,
  MAINTENANCE_OVERDUE: IconWrench,
  MAINTENANCE_CRITICAL: IconWrench,
  ODOMETER_GAP: IconGauge,
  RECURRING_FAILURE: IconRepeat,
  RECENT_FAILURE: IconExclamation,
  NEVER_INSPECTED: IconClipboard,
  NEVER_MAINTAINED: IconWrench,
};

const SEVERITY_CONFIG = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    icon: "text-red-500",
    dot: "bg-red-500",
    label: "Critical",
    summaryBg: "bg-red-50 border border-red-200",
    summaryText: "text-red-700",
    summaryNum: "text-red-600",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    icon: "text-amber-500",
    dot: "bg-amber-500",
    label: "Warning",
    summaryBg: "bg-amber-50 border border-amber-200",
    summaryText: "text-amber-700",
    summaryNum: "text-amber-600",
  },
  info: {
    border: "border-l-blue-400",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    icon: "text-blue-500",
    dot: "bg-blue-400",
    label: "Info",
    summaryBg: "bg-blue-50 border border-blue-200",
    summaryText: "text-blue-700",
    summaryNum: "text-blue-600",
  },
};

const ACTION_LABEL: Record<string, { label: string; param: string }> = {
  INSPECTION_OVERDUE: { label: "Inspect Now", param: "inspections" },
  INSPECTION_CRITICAL: { label: "Inspect Now", param: "inspections" },
  RECURRING_FAILURE: { label: "Inspect Now", param: "inspections" },
  RECENT_FAILURE: { label: "Inspect Now", param: "inspections" },
  NEVER_INSPECTED: { label: "Add Inspection", param: "inspections" },
  MAINTENANCE_OVERDUE: { label: "Log Service", param: "maintenance" },
  MAINTENANCE_CRITICAL: { label: "Log Service", param: "maintenance" },
  ODOMETER_GAP: { label: "Log Service", param: "maintenance" },
  NEVER_MAINTAINED: { label: "Log Service", param: "maintenance" },
};

// ============================================================
// Alert Card
// ============================================================

function AlertCard({ alert, onAction }: { alert: FleetAlert; onAction: (vehicleId: string, type: "inspections" | "maintenance") => void }) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const Icon = ALERT_ICONS[alert.type] ?? IconExclamation;
  const action = ACTION_LABEL[alert.type];

  return (
    <div className={`rounded-xl border-l-4 bg-white shadow-sm ${sev.border} overflow-hidden`}>
      <div className="p-4">
        {/* Header row */}
        <div className="mb-2 flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${sev.bg}`}>
            <Icon className={`h-4 w-4 ${sev.icon}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sev.badge}`}>
                {sev.label}
              </span>
              <span className="truncate font-mono text-sm font-bold text-slate-800">
                {alert.vehicleCode}
              </span>
              {(alert.vehicleBrand || alert.vehicleModel) && (
                <span className="truncate text-xs text-slate-500">
                  {[alert.vehicleBrand, alert.vehicleModel].filter(Boolean).join(" ")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-800">{alert.title}</p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-2 text-sm text-slate-600">{alert.description}</p>

        {/* Failed items chips */}
        {alert.failedItems && alert.failedItems.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {alert.failedItems.slice(0, 5).map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {item}
              </span>
            ))}
            {alert.failedItems.length > 5 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                +{alert.failedItems.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Suggestion */}
        <div className={`mb-3 rounded-lg px-3 py-2 ${sev.bg}`}>
          <p className="text-xs font-medium text-slate-700">
            <span className="mr-1 opacity-60">Suggestion:</span>
            {alert.suggestion}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          {alert.lastEventDate ? (
            <p className="text-xs text-slate-400">
              Last event: {new Date(alert.lastEventDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : (
            <span />
          )}
          {action && (
            <button
              onClick={() => onAction(alert.vehicleId, action.param as "inspections" | "maintenance")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition active:opacity-80 ${
                alert.severity === "critical" ? "bg-red-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-blue-500"
              }`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Summary Card
// ============================================================

function SummaryCard({
  count,
  label,
  severity,
  isActive,
  onClick,
}: {
  count: number;
  label: string;
  severity: AlertSeverity | "all";
  isActive: boolean;
  onClick: () => void;
}) {
  if (severity === "all") {
    return (
      <button
        onClick={onClick}
        className={`flex flex-1 flex-col items-center rounded-xl border-2 p-3 transition ${
          isActive ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white"
        }`}
      >
        <span className="text-xl font-bold text-slate-800">{count}</span>
        <span className="text-xs font-medium text-slate-500">All</span>
      </button>
    );
  }
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center rounded-xl border-2 p-3 transition ${
        isActive ? `border-current ${cfg.summaryBg}` : "border-slate-200 bg-white"
      }`}
    >
      <span className={`text-xl font-bold ${cfg.summaryNum}`}>{count}</span>
      <span className={`text-xs font-medium ${cfg.summaryText}`}>{label}</span>
    </button>
  );
}

// ============================================================
// Main Page
// ============================================================

type Filter = "all" | AlertSeverity;

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [summary, setSummary] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    fetchAlerts();
  }, [router]);

  async function fetchAlerts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", { headers: getSessionHeader() });
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = await res.json();
      setAlerts(data.alerts ?? []);
      setSummary(data.summary ?? { critical: 0, warning: 0, info: 0, total: 0 });
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.severity === filter)),
    [alerts, filter]
  );

  function handleAction(vehicleId: string, type: "inspections" | "maintenance") {
    router.push(`/${type}/new?vehicle=${vehicleId}`);
  }

  return (
    <MobileShell title="Fleet Alerts">
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-24">
        <div className="mx-auto max-w-lg space-y-4 p-4">
          {/* Header */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Fleet Alerts</h1>
              <p className="text-sm text-slate-500">Smart maintenance & inspection recommendations</p>
            </div>
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-50 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Last refreshed */}
          {lastRefreshed && !loading && (
            <p className="text-xs text-slate-400">
              Updated {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Summary cards */}
          <div className="flex gap-2">
            <SummaryCard count={summary.total} label="All" severity="all" isActive={filter === "all"} onClick={() => setFilter("all")} />
            <SummaryCard count={summary.critical} label="Critical" severity="critical" isActive={filter === "critical"} onClick={() => setFilter("critical")} />
            <SummaryCard count={summary.warning} label="Warnings" severity="warning" isActive={filter === "warning"} onClick={() => setFilter("warning")} />
            <SummaryCard count={summary.info} label="Info" severity="info" isActive={filter === "info"} onClick={() => setFilter("info")} />
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button onClick={fetchAlerts} className="mt-2 text-sm font-semibold text-red-600 underline">
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {filter === "all" ? "All clear!" : `No ${filter} alerts`}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {filter === "all"
                  ? "Your fleet is up to date. No action needed right now."
                  : `No ${filter}-level alerts at this time.`}
              </p>
            </div>
          )}

          {/* Alert list */}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {/* Group label */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  {filtered.length} alert{filtered.length !== 1 ? "s" : ""}
                  {filter !== "all" ? ` · ${filter}` : ""}
                </p>
              </div>

              {filtered.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onAction={handleAction} />
              ))}
            </div>
          )}

          {/* How alerts work */}
          {!loading && (
            <details className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700 select-none">
                How are alerts calculated?
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p><strong className="text-slate-700">Inspection overdue</strong> — no inspection in 30 days (warning) or 60 days (critical).</p>
                <p><strong className="text-slate-700">Maintenance overdue</strong> — no service in 90 days (warning) or 180 days (critical).</p>
                <p><strong className="text-slate-700">Recent failures</strong> — latest inspection (within 14 days) had failed checklist items.</p>
                <p><strong className="text-slate-700">Chronic issues</strong> — same checklist item failed in 2 of the last 3 inspections.</p>
                <p><strong className="text-slate-700">Odometer gap</strong> — vehicle has been driven 5,000+ km since the last recorded service.</p>
                <p><strong className="text-slate-700">No history</strong> — vehicle has no inspections or maintenance on record at all.</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
