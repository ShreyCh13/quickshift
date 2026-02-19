import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth";
import { INSPECTION_CATEGORIES } from "@/lib/constants";
import type { ChecklistItem } from "@/lib/types";

// ============================================================
// Thresholds
// ============================================================

/** Days beyond a vehicle's OWN average inspection interval before we flag it */
const INSPECTION_OVERDUE_FACTOR = 1.4;
/** Fallback if not enough history: flag after N days */
const INSPECTION_FALLBACK_WARNING_DAYS = 21;
const INSPECTION_FALLBACK_CRITICAL_DAYS = 45;
/** Maintenance thresholds (always fixed — no good baseline) */
const MAINTENANCE_WARNING_DAYS = 90;
const MAINTENANCE_CRITICAL_DAYS = 180;
/** Odometer gap since last service */
const ODOMETER_GAP_KM = 5000;
/** Recurring failure: same item failed in N of last M inspections */
const RECURRING_COUNT = 2;
const RECURRING_LOOK_BACK = 3;
/** Safety-critical checklist keys — treated as critical even on single failure */
const SAFETY_CRITICAL_KEYS = new Set([
  "brake_lights", "foot_brake", "seat_belts", "dashboard_warning",
  "brake_performance", "steering", "tyres",
]);

// ============================================================
// Types (internal to this file)
// ============================================================

type RawVehicle = {
  id: string;
  vehicle_code: string;
  brand: string | null;
  model: string | null;
};

type RawInspection = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  remarks_json: Record<string, ChecklistItem>;
};

type RawMaintenance = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
};

export type IssueSeverity = "critical" | "warning";

export type VehicleIssue = {
  severity: IssueSeverity;
  text: string;
};

export type VehicleHealth = {
  vehicleId: string;
  vehicleCode: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  status: "critical" | "warning";
  issues: VehicleIssue[];
  lastInspectionDate: string | null;
  lastMaintenanceDate: string | null;
  daysSinceInspection: number | null;
  daysSinceMaintenance: number | null;
};

// ============================================================
// Helpers
// ============================================================

function daysBetween(a: string, b: string = new Date().toISOString()): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getFieldLabel(key: string): string {
  for (const cat of INSPECTION_CATEGORIES) {
    for (const field of cat.fields) {
      if (field.key === key) return field.label.replace(/ \(.*\)/, ""); // strip parenthetical detail
    }
  }
  // Capitalise the key as a fallback (covers legacy remark keys like "tyre", "alignment")
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

/** Average days between successive inspections for a vehicle */
function avgInspectionInterval(inspections: RawInspection[]): number | null {
  if (inspections.length < 2) return null;
  const sorted = [...inspections].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    total += daysBetween(sorted[i - 1].created_at, sorted[i].created_at);
  }
  return Math.round(total / (sorted.length - 1));
}

// ============================================================
// Core analysis per vehicle
// ============================================================

function analyseVehicle(
  vehicle: RawVehicle,
  inspections: RawInspection[], // desc-sorted, filtered for this vehicle
  maintenances: RawMaintenance[] // desc-sorted, filtered for this vehicle
): VehicleHealth | "ok" | "no_data" {
  const hasInspections = inspections.length > 0;
  const hasMaintenances = maintenances.length > 0;

  if (!hasInspections && !hasMaintenances) return "no_data";

  const issues: VehicleIssue[] = [];
  const latestInspection = inspections[0] ?? null;
  const latestMaintenance = maintenances[0] ?? null;

  // ── Inspection timing ──────────────────────────────────────
  if (!hasInspections) {
    // vehicle has maintenance but no inspection — mildly flag
    issues.push({ severity: "warning", text: "No inspection on record yet" });
  } else {
    const daysSince = daysBetween(latestInspection.created_at);
    const avgInterval = avgInspectionInterval(inspections);

    if (avgInterval !== null) {
      // Predictive: flag relative to the vehicle's own pattern
      const criticalThreshold = Math.round(avgInterval * INSPECTION_OVERDUE_FACTOR * 1.5);
      const warningThreshold = Math.round(avgInterval * INSPECTION_OVERDUE_FACTOR);
      if (daysSince >= criticalThreshold) {
        issues.push({
          severity: "critical",
          text: `No inspection in ${daysSince} days — typically every ~${avgInterval} days`,
        });
      } else if (daysSince >= warningThreshold) {
        issues.push({
          severity: "warning",
          text: `Due for inspection (${daysSince} days since last, typical interval ~${avgInterval} days)`,
        });
      }
    } else {
      // Not enough history for pattern — use fixed fallback
      if (daysSince >= INSPECTION_FALLBACK_CRITICAL_DAYS) {
        issues.push({ severity: "critical", text: `No inspection in ${daysSince} days` });
      } else if (daysSince >= INSPECTION_FALLBACK_WARNING_DAYS) {
        issues.push({ severity: "warning", text: `No inspection in ${daysSince} days` });
      }
    }

    // ── Recent inspection failures ─────────────────────────
    const recentInspectionDays = daysBetween(latestInspection.created_at);
    if (recentInspectionDays <= 10 && latestInspection.remarks_json) {
      const failed = Object.entries(latestInspection.remarks_json)
        .filter(([, item]) => !item.ok)
        .map(([key]) => ({ key, label: getFieldLabel(key) }));

      if (failed.length > 0) {
        const hasSafetyCritical = failed.some(({ key }) => SAFETY_CRITICAL_KEYS.has(key));
        const labels = failed.map(({ label }) => label).join(", ");
        issues.push({
          severity: hasSafetyCritical ? "critical" : "warning",
          text: `Last inspection (${fmt(latestInspection.created_at)}): ${failed.length} issue${failed.length > 1 ? "s" : ""} — ${labels}`,
        });
      }
    }

    // ── Recurring failures (pattern detection) ─────────────
    if (inspections.length >= RECURRING_LOOK_BACK) {
      const recent = inspections.slice(0, RECURRING_LOOK_BACK);
      const counts: Record<string, number> = {};
      for (const insp of recent) {
        if (!insp.remarks_json) continue;
        for (const [key, item] of Object.entries(insp.remarks_json)) {
          if (!item.ok) counts[key] = (counts[key] ?? 0) + 1;
        }
      }
      const recurring = Object.entries(counts)
        .filter(([, n]) => n >= RECURRING_COUNT)
        .map(([key]) => ({ key, label: getFieldLabel(key) }));

      if (recurring.length > 0) {
        const hasSafetyCritical = recurring.some(({ key }) => SAFETY_CRITICAL_KEYS.has(key));
        const labels = recurring.map(({ label }) => label).join(", ");
        issues.push({
          severity: hasSafetyCritical ? "critical" : "warning",
          text: `Recurring in last ${RECURRING_LOOK_BACK} inspections: ${labels}`,
        });
      }
    }
  }

  // ── Maintenance timing ──────────────────────────────────────
  if (hasInspections) { // only flag missing maintenance if we have inspection data (means vehicle is active)
    if (!hasMaintenances) {
      issues.push({ severity: "warning", text: "No service record on record yet" });
    } else {
      const daysSince = daysBetween(latestMaintenance.created_at);
      if (daysSince >= MAINTENANCE_CRITICAL_DAYS) {
        issues.push({ severity: "critical", text: `No service in ${daysSince} days` });
      } else if (daysSince >= MAINTENANCE_WARNING_DAYS) {
        issues.push({ severity: "warning", text: `Last service ${daysSince} days ago (${fmt(latestMaintenance.created_at)})` });
      }
    }
  }

  // ── Odometer gap ────────────────────────────────────────────
  if (latestInspection && latestMaintenance) {
    const gap = latestInspection.odometer_km - latestMaintenance.odometer_km;
    if (gap >= ODOMETER_GAP_KM) {
      issues.push({
        severity: "warning",
        text: `${gap.toLocaleString()} km driven since last service (at ${latestMaintenance.odometer_km.toLocaleString()} km)`,
      });
    }
  }

  if (issues.length === 0) return "ok";

  const status: "critical" | "warning" = issues.some((i) => i.severity === "critical") ? "critical" : "warning";

  return {
    vehicleId: vehicle.id,
    vehicleCode: vehicle.vehicle_code,
    vehicleBrand: vehicle.brand,
    vehicleModel: vehicle.model,
    status,
    issues,
    lastInspectionDate: latestInspection?.created_at ?? null,
    lastMaintenanceDate: latestMaintenance?.created_at ?? null,
    daysSinceInspection: latestInspection ? daysBetween(latestInspection.created_at) : null,
    daysSinceMaintenance: latestMaintenance ? daysBetween(latestMaintenance.created_at) : null,
  };
}

// ============================================================
// Route
// ============================================================

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(session, ["dev"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();

  try {
    const [vehiclesRes, inspectionsRes, maintenancesRes] = await Promise.all([
      supabase.from("vehicles").select("id, vehicle_code, brand, model").eq("is_active", true).order("vehicle_code"),
      supabase.from("inspections").select("id, vehicle_id, created_at, odometer_km, remarks_json").eq("is_deleted", false).order("created_at", { ascending: false }).limit(600),
      supabase.from("maintenance").select("id, vehicle_id, created_at, odometer_km").eq("is_deleted", false).order("created_at", { ascending: false }).limit(600),
    ]);

    if (vehiclesRes.error) throw vehiclesRes.error;
    if (inspectionsRes.error) throw inspectionsRes.error;
    if (maintenancesRes.error) throw maintenancesRes.error;

    const vehicles = vehiclesRes.data ?? [];
    const inspections = (inspectionsRes.data ?? []) as RawInspection[];
    const maintenances = (maintenancesRes.data ?? []) as RawMaintenance[];

    // Group by vehicle
    const inspByVehicle: Record<string, RawInspection[]> = {};
    for (const i of inspections) {
      (inspByVehicle[i.vehicle_id] ??= []).push(i);
    }
    const maintByVehicle: Record<string, RawMaintenance[]> = {};
    for (const m of maintenances) {
      (maintByVehicle[m.vehicle_id] ??= []).push(m);
    }

    let criticalCount = 0;
    let warningCount = 0;
    let okCount = 0;
    let noDataCount = 0;

    const vehiclesWithIssues: VehicleHealth[] = [];

    for (const v of vehicles) {
      const result = analyseVehicle(v, inspByVehicle[v.id] ?? [], maintByVehicle[v.id] ?? []);
      if (result === "no_data") {
        noDataCount++;
      } else if (result === "ok") {
        okCount++;
      } else {
        if (result.status === "critical") criticalCount++;
        else warningCount++;
        vehiclesWithIssues.push(result);
      }
    }

    // Sort: critical first, then by most issues, then alphabetical
    vehiclesWithIssues.sort((a, b) => {
      if (a.status !== b.status) return a.status === "critical" ? -1 : 1;
      if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
      return a.vehicleCode.localeCompare(b.vehicleCode);
    });

    return NextResponse.json({
      summary: {
        critical: criticalCount,
        warning: warningCount,
        ok: okCount,
        noData: noDataCount,
        totalActive: vehicles.length,
      },
      vehicles: vehiclesWithIssues,
    });
  } catch (err) {
    console.error("Alerts route error:", err);
    return NextResponse.json({ error: "Failed to compute fleet health" }, { status: 500 });
  }
}
