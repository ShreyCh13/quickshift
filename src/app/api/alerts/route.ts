import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { INSPECTION_CATEGORIES } from "@/lib/constants";
import type { FleetAlert, AlertType, AlertSeverity, ChecklistItem } from "@/lib/types";

// ============================================================
// Thresholds
// ============================================================

const INSPECTION_WARNING_DAYS = 30;
const INSPECTION_CRITICAL_DAYS = 60;
const MAINTENANCE_WARNING_DAYS = 90;
const MAINTENANCE_CRITICAL_DAYS = 180;
const ODOMETER_GAP_KM = 5000;
const RECURRING_FAILURE_MIN_COUNT = 2;
const RECURRING_FAILURE_LOOK_BACK = 3;

// ============================================================
// Helpers
// ============================================================

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function makeAlert(
  vehicleId: string,
  vehicleCode: string,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  suggestion: string,
  extras: Partial<Pick<FleetAlert, "daysSince" | "failedItems" | "lastEventDate" | "odometerGap">> = {}
): FleetAlert {
  return {
    id: `${vehicleId}-${type}`,
    vehicleId,
    vehicleCode,
    vehicleBrand,
    vehicleModel,
    type,
    severity,
    title,
    description,
    suggestion,
    ...extras,
  };
}

/** Returns label for a checklist field key, or the key itself as fallback */
function getFieldLabel(key: string): string {
  for (const cat of INSPECTION_CATEGORIES) {
    for (const field of cat.fields) {
      if (field.key === key) return field.label;
    }
  }
  return key;
}

// ============================================================
// Alert Computation
// ============================================================

type VehicleRow = {
  id: string;
  vehicle_code: string;
  brand: string | null;
  model: string | null;
};

type InspectionRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  remarks_json: Record<string, ChecklistItem>;
};

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
};

function computeAlertsForVehicle(
  vehicle: VehicleRow,
  inspections: InspectionRow[], // already sorted desc, filtered for this vehicle
  maintenances: MaintenanceRow[] // already sorted desc, filtered for this vehicle
): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  const { id, vehicle_code, brand, model } = vehicle;

  const latestInspection = inspections[0] ?? null;
  const latestMaintenance = maintenances[0] ?? null;

  // ── Inspection overdue ──────────────────────────────────────
  if (!latestInspection) {
    alerts.push(
      makeAlert(id, vehicle_code, brand, model,
        "NEVER_INSPECTED", "info",
        "No inspection on record",
        "This vehicle has never been inspected.",
        "Schedule an inspection as soon as possible."
      )
    );
  } else {
    const days = daysSince(latestInspection.created_at);
    if (days >= INSPECTION_CRITICAL_DAYS) {
      alerts.push(
        makeAlert(id, vehicle_code, brand, model,
          "INSPECTION_CRITICAL", "critical",
          `Inspection overdue by ${days} days`,
          `Last inspection was ${days} days ago (${new Date(latestInspection.created_at).toLocaleDateString("en-GB")}).`,
          "Arrange an immediate inspection — vehicle may be unsafe to operate.",
          { daysSince: days, lastEventDate: latestInspection.created_at }
        )
      );
    } else if (days >= INSPECTION_WARNING_DAYS) {
      alerts.push(
        makeAlert(id, vehicle_code, brand, model,
          "INSPECTION_OVERDUE", "warning",
          `Inspection due (${days} days ago)`,
          `Last inspection was ${days} days ago (${new Date(latestInspection.created_at).toLocaleDateString("en-GB")}).`,
          "Schedule an inspection within the next few days.",
          { daysSince: days, lastEventDate: latestInspection.created_at }
        )
      );
    }

    // ── Recent inspection failures ────────────────────────────
    const recentDays = daysSince(latestInspection.created_at);
    if (recentDays <= 14 && latestInspection.remarks_json) {
      const failedItems = Object.entries(latestInspection.remarks_json)
        .filter(([, item]) => !item.ok)
        .map(([key]) => getFieldLabel(key));

      if (failedItems.length > 0) {
        alerts.push(
          makeAlert(id, vehicle_code, brand, model,
            "RECENT_FAILURE", "warning",
            `${failedItems.length} issue${failedItems.length > 1 ? "s" : ""} flagged in last inspection`,
            `Recent inspection (${new Date(latestInspection.created_at).toLocaleDateString("en-GB")}) flagged: ${failedItems.slice(0, 3).join(", ")}${failedItems.length > 3 ? ` +${failedItems.length - 3} more` : ""}.`,
            "Review the failed items and schedule repairs.",
            { failedItems, lastEventDate: latestInspection.created_at }
          )
        );
      }
    }

    // ── Recurring checklist failures (last N inspections) ─────
    if (inspections.length >= RECURRING_FAILURE_LOOK_BACK) {
      const recent = inspections.slice(0, RECURRING_FAILURE_LOOK_BACK);
      const failureCounts: Record<string, number> = {};

      for (const insp of recent) {
        if (!insp.remarks_json) continue;
        for (const [key, item] of Object.entries(insp.remarks_json)) {
          if (!item.ok) {
            failureCounts[key] = (failureCounts[key] ?? 0) + 1;
          }
        }
      }

      const recurringKeys = Object.entries(failureCounts)
        .filter(([, count]) => count >= RECURRING_FAILURE_MIN_COUNT)
        .map(([key]) => key);

      if (recurringKeys.length > 0) {
        const labels = recurringKeys.map(getFieldLabel);
        alerts.push(
          makeAlert(id, vehicle_code, brand, model,
            "RECURRING_FAILURE", "critical",
            `Chronic issues across ${RECURRING_FAILURE_LOOK_BACK} inspections`,
            `The following item${labels.length > 1 ? "s have" : " has"} failed repeatedly: ${labels.join(", ")}.`,
            "These are persistent problems — prioritise repair before the next trip.",
            { failedItems: labels, lastEventDate: latestInspection.created_at }
          )
        );
      }
    }
  }

  // ── Maintenance overdue ──────────────────────────────────────
  if (!latestMaintenance) {
    alerts.push(
      makeAlert(id, vehicle_code, brand, model,
        "NEVER_MAINTAINED", "info",
        "No maintenance on record",
        "This vehicle has no maintenance history in the system.",
        "Log past maintenance or schedule a service soon."
      )
    );
  } else {
    const days = daysSince(latestMaintenance.created_at);
    if (days >= MAINTENANCE_CRITICAL_DAYS) {
      alerts.push(
        makeAlert(id, vehicle_code, brand, model,
          "MAINTENANCE_CRITICAL", "critical",
          `No maintenance in ${days} days`,
          `Last maintenance was ${days} days ago (${new Date(latestMaintenance.created_at).toLocaleDateString("en-GB")}).`,
          "Service this vehicle immediately — long-term neglect increases breakdown risk.",
          { daysSince: days, lastEventDate: latestMaintenance.created_at }
        )
      );
    } else if (days >= MAINTENANCE_WARNING_DAYS) {
      alerts.push(
        makeAlert(id, vehicle_code, brand, model,
          "MAINTENANCE_OVERDUE", "warning",
          `Maintenance due (${days} days since last service)`,
          `Last maintenance was ${days} days ago (${new Date(latestMaintenance.created_at).toLocaleDateString("en-GB")}).`,
          "Schedule a service check within the next 2 weeks.",
          { daysSince: days, lastEventDate: latestMaintenance.created_at }
        )
      );
    }
  }

  // ── Odometer gap (inspection km >> maintenance km) ──────────
  if (latestInspection && latestMaintenance) {
    const gap = latestInspection.odometer_km - latestMaintenance.odometer_km;
    if (gap >= ODOMETER_GAP_KM) {
      alerts.push(
        makeAlert(id, vehicle_code, brand, model,
          "ODOMETER_GAP", "warning",
          `${gap.toLocaleString()} km driven since last service`,
          `Odometer at last inspection: ${latestInspection.odometer_km.toLocaleString()} km. Last service at: ${latestMaintenance.odometer_km.toLocaleString()} km.`,
          "Consider scheduling an oil change and mechanical check.",
          { odometerGap: gap, lastEventDate: latestInspection.created_at }
        )
      );
    }
  }

  return alerts;
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(req: Request) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  try {
    const [vehiclesRes, inspectionsRes, maintenancesRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, vehicle_code, brand, model")
        .eq("is_active", true)
        .order("vehicle_code"),

      supabase
        .from("inspections")
        .select("id, vehicle_id, created_at, odometer_km, remarks_json")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500),

      supabase
        .from("maintenance")
        .select("id, vehicle_id, created_at, odometer_km")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (vehiclesRes.error) {
      console.error("Alerts: failed to load vehicles:", vehiclesRes.error);
      return NextResponse.json({ error: "Failed to load vehicles" }, { status: 500 });
    }
    if (inspectionsRes.error) {
      console.error("Alerts: failed to load inspections:", inspectionsRes.error);
      return NextResponse.json({ error: "Failed to load inspections" }, { status: 500 });
    }
    if (maintenancesRes.error) {
      console.error("Alerts: failed to load maintenance:", maintenancesRes.error);
      return NextResponse.json({ error: "Failed to load maintenance" }, { status: 500 });
    }

    const vehicles = vehiclesRes.data ?? [];
    const inspections = (inspectionsRes.data ?? []) as InspectionRow[];
    const maintenances = (maintenancesRes.data ?? []) as MaintenanceRow[];

    // Group by vehicle
    const inspectionsByVehicle: Record<string, InspectionRow[]> = {};
    for (const insp of inspections) {
      if (!inspectionsByVehicle[insp.vehicle_id]) inspectionsByVehicle[insp.vehicle_id] = [];
      inspectionsByVehicle[insp.vehicle_id].push(insp);
    }

    const maintenancesByVehicle: Record<string, MaintenanceRow[]> = {};
    for (const m of maintenances) {
      if (!maintenancesByVehicle[m.vehicle_id]) maintenancesByVehicle[m.vehicle_id] = [];
      maintenancesByVehicle[m.vehicle_id].push(m);
    }

    const allAlerts: FleetAlert[] = [];
    for (const vehicle of vehicles) {
      const vehicleInspections = inspectionsByVehicle[vehicle.id] ?? [];
      const vehicleMaintenances = maintenancesByVehicle[vehicle.id] ?? [];
      const alerts = computeAlertsForVehicle(vehicle, vehicleInspections, vehicleMaintenances);
      allAlerts.push(...alerts);
    }

    // Sort: critical → warning → info, then by vehicleCode
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    allAlerts.sort((a, b) => {
      const sev = severityOrder[a.severity] - severityOrder[b.severity];
      if (sev !== 0) return sev;
      return a.vehicleCode.localeCompare(b.vehicleCode);
    });

    const criticalCount = allAlerts.filter((a) => a.severity === "critical").length;
    const warningCount = allAlerts.filter((a) => a.severity === "warning").length;
    const infoCount = allAlerts.filter((a) => a.severity === "info").length;

    return NextResponse.json({
      alerts: allAlerts,
      summary: { critical: criticalCount, warning: warningCount, info: infoCount, total: allAlerts.length },
    });
  } catch (err) {
    console.error("Alerts route error:", err);
    return NextResponse.json({ error: "Failed to compute alerts" }, { status: 500 });
  }
}
