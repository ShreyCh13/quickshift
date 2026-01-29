"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export default function FormField({ label, error, className, ...props }: Props) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        {...props}
        className={`min-h-[48px] w-full rounded-lg border-2 px-4 py-3 text-base transition-colors focus:outline-none ${
          error 
            ? "border-red-300 focus:border-red-500" 
            : "border-slate-200 focus:border-blue-500"
        } ${className || ""}`}
      />
      {error && (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      )}
    </label>
  );
}
