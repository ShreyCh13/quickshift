"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function AdminSection({ title, children }: Props) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
