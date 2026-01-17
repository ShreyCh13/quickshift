"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";

type Props = {
  title: string;
};

export default function TopBar({ title }: Props) {
  const router = useRouter();

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearSession();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
