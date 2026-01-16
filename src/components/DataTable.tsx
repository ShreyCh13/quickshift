"use client";

import type { ReactNode } from "react";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  renderExpanded?: (row: T) => ReactNode;
};

export default function DataTable<T extends { id: string }>({
  columns,
  rows,
  renderExpanded,
}: Props<T>) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <details key={row.id} className="rounded-lg border bg-white">
          <summary className="grid cursor-pointer grid-cols-2 gap-2 px-3 py-3 text-sm">
            {columns.slice(0, 2).map((col) => (
              <span key={String(col.key)} className="font-medium text-slate-900">
                {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key])}
              </span>
            ))}
          </summary>
          <div className="border-t px-3 py-2 text-sm text-slate-600">
            {columns.map((col) => (
              <div key={String(col.key)} className="flex items-center justify-between py-1">
                <span className="text-slate-500">{col.label}</span>
                <span className="text-slate-900">
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key])}
                </span>
              </div>
            ))}
            {renderExpanded ? <div className="mt-2">{renderExpanded(row)}</div> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
