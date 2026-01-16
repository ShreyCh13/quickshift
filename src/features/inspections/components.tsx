"use client";

import type { RemarkFieldRow } from "@/lib/types";

type Props = {
  remarkFields: RemarkFieldRow[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

export function RemarkFieldsForm({ remarkFields, values, onChange }: Props) {
  return (
    <div className="space-y-3">
      {remarkFields.map((field) => (
        <label key={field.key} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{field.label}</span>
          <input
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-base"
            value={values[field.key] || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder="Enter remark or N/A"
            required
          />
        </label>
      ))}
    </div>
  );
}
