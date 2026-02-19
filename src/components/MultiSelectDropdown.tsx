"use client";

import { useEffect, useRef, useState } from "react";

type Accent = "emerald" | "blue" | "purple";

const styles: Record<Accent, { checkbox: string; chip: string; chipX: string; done: string; focus: string }> = {
  emerald: {
    checkbox: "border-emerald-500 bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    chipX: "text-emerald-600",
    done: "bg-emerald-600 active:bg-emerald-700",
    focus: "focus:border-emerald-500",
  },
  blue: {
    checkbox: "border-blue-500 bg-blue-500",
    chip: "bg-blue-100 text-blue-800",
    chipX: "text-blue-600",
    done: "bg-blue-600 active:bg-blue-700",
    focus: "focus:border-blue-500",
  },
  purple: {
    checkbox: "border-purple-500 bg-purple-500",
    chip: "bg-purple-100 text-purple-800",
    chipX: "text-purple-600",
    done: "bg-purple-600 active:bg-purple-700",
    focus: "focus:border-purple-500",
  },
};

interface Props {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  accent?: Accent;
}

export default function MultiSelectDropdown({ options, selected, onChange, placeholder, accent = "emerald" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const s = styles[accent];

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border-2 border-slate-200 px-3 py-3 text-base text-left ${s.focus} focus:outline-none`}
      >
        <span className={selected.length === 0 ? "text-slate-400" : "font-medium text-slate-900"}>
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span key={val} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.chip}`}>
                {opt?.label ?? val}
                <button type="button" onClick={() => toggle(val)} className={`leading-none ${s.chipX}`}>×</button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${s.focus} focus:outline-none`}
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-400">No options</div>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm active:bg-slate-50"
                  >
                    <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${selected.includes(option.value) ? s.checkbox : "border-slate-300"}`}>
                      {selected.includes(option.value) && <span className="text-[10px] font-bold text-white">✓</span>}
                    </div>
                    <span className="flex-1 text-left text-slate-800">{option.label}</span>
                  </button>
                ))
              )}
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => { onChange([]); setSearch(""); }}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 active:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(""); }}
                className={`flex-1 rounded-lg py-2 text-xs font-medium text-white ${s.done}`}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
