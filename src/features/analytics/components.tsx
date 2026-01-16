"use client";

type Props = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: Props) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
