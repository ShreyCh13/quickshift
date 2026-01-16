"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function FormField({ label, ...props }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-base focus:border-slate-500 focus:outline-none"
      />
    </label>
  );
}
