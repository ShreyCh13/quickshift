"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession } from "@/lib/auth";

const NAV = [
  { href: "/vehicles", label: "Vehicles" },
  { href: "/inspections", label: "Inspections" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/admin", label: "Admin" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const session = loadSession();
    setShowAdmin(session?.user.role === "admin");
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white">
      <div className="mx-auto flex max-w-xl justify-between px-2 py-2 text-xs">
        {NAV.filter((item) => (item.href === "/admin" ? showAdmin : true)).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-12 flex-1 items-center justify-center rounded-md ${
                active ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
