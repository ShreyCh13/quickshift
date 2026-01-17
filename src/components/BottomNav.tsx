"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession } from "@/lib/auth";

export default function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const session = loadSession();
    setIsAdmin(session?.user.role === "admin");
  }, []);

  const navItems = [
    { href: "/vehicles", label: "Vehicles", icon: "🚗", color: "text-slate-600", activeColor: "text-slate-900 bg-slate-100" },
    { href: "/inspections", label: "Inspections", icon: "📋", color: "text-blue-600", activeColor: "text-blue-700 bg-blue-100" },
    { href: "/maintenance", label: "Maintenance", icon: "🔧", color: "text-emerald-600", activeColor: "text-emerald-700 bg-emerald-100" },
    { href: "/analytics", label: "Analytics", icon: "📊", color: "text-purple-600", activeColor: "text-purple-700 bg-purple-100" },
  ];

  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", icon: "⚙️", color: "text-orange-600", activeColor: "text-orange-700 bg-orange-100" });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-lg">
      <div className="mx-auto flex max-w-screen-xl items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-3 transition ${
                isActive ? `${item.activeColor} font-bold` : `${item.color} hover:bg-slate-50`
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="mt-1 text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
