"use client";

import type { VehicleRow } from "@/lib/types";

type Props = {
  vehicle: VehicleRow;
  onSelect?: (vehicle: VehicleRow) => void;
};

export function VehicleCard({ vehicle, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(vehicle)}
      className="w-full rounded-lg border bg-white p-3 text-left"
    >
      <div className="text-base font-semibold text-slate-900">{vehicle.vehicle_code}</div>
      <div className="text-sm text-slate-600">
        {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ""}
      </div>
      <div className="text-xs text-slate-500">{vehicle.plate_number || "No plate"}</div>
    </button>
  );
}
