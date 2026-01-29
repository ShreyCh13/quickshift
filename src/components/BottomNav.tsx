"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, loadSession } from "@/lib/auth";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const session = loadSession();
    setIsAdmin(session?.user.role === "admin");
  }, []);

  const navItems = [
    { href: "/vehicles", label: "Vehicles", shortLabel: "Cars", icon: "🚗", color: "text-slate-600", activeColor: "text-slate-900 bg-slate-100" },
    { href: "/inspections", label: "Inspections", shortLabel: "Inspect", icon: "📋", color: "text-blue-600", activeColor: "text-blue-700 bg-blue-100" },
    { href: "/maintenance", label: "Maintenance", shortLabel: "Maint", icon: "🔧", color: "text-emerald-600", activeColor: "text-emerald-700 bg-emerald-100" },
    { href: "/analytics", label: "Analytics", shortLabel: "Stats", icon: "📊", color: "text-purple-600", activeColor: "text-purple-700 bg-purple-100" },
  ];

  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", shortLabel: "Admin", icon: "⚙️", color: "text-orange-600", activeColor: "text-orange-700 bg-orange-100" });
  }

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearSession();
    router.replace("/login");
  }

  // Calculate if we need compact mode (6 items = admin mode with logout)
  const totalItems = navItems.length + 1; // +1 for logout
  const isCompact = totalItems > 5;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-lg safe-area-inset-bottom">
      <div className="mx-auto flex max-w-screen-xl items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-2.5 transition ${
                isActive ? `${item.activeColor} font-bold` : `${item.color} hover:bg-slate-50`
              }`}
            >
              <span className={isCompact ? "text-xl" : "text-2xl"}>{item.icon}</span>
              <span className={`mt-0.5 truncate ${isCompact ? "text-[10px]" : "text-xs"}`}>
                {isCompact ? item.shortLabel : item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-2.5 text-red-600 hover:bg-red-50`}
        >
          <span className={isCompact ? "text-xl" : "text-2xl"}>🚪</span>
          <span className={`mt-0.5 truncate ${isCompact ? "text-[10px]" : "text-xs"}`}>Logout</span>
        </button>
      </div>
    </nav>
  );
}
