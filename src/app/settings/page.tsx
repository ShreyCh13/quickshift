"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import { loadSession, clearSession } from "@/lib/auth";
import type { Session } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!session) return null;

  return (
    <MobileShell title="Settings">
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 pb-24">
        {/* User Info */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-2 text-lg font-bold text-slate-900">Account</h2>
          <div className="space-y-1 text-sm text-slate-600">
            <div><span className="font-semibold">Name:</span> {session.user.displayName}</div>
            <div><span className="font-semibold">Username:</span> {session.user.username}</div>
            <div><span className="font-semibold">Role:</span> {session.user.role === "admin" ? "Administrator" : "Staff"}</div>
          </div>
        </div>

        {/* Platform Links */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Platform Links</h2>
          <div className="space-y-3">
            <a
              href="https://github.com/ShreyCh13/state-fleet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border-2 border-slate-200 p-3 hover:border-slate-400"
            >
              <span className="font-semibold text-slate-700">GitHub Repository</span>
              <span className="text-2xl">🔗</span>
            </a>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border-2 border-slate-200 p-3 hover:border-slate-400"
            >
              <span className="font-semibold text-slate-700">Supabase Dashboard</span>
              <span className="text-2xl">🗄️</span>
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border-2 border-slate-200 p-3 hover:border-slate-400"
            >
              <span className="font-semibold text-slate-700">Vercel Dashboard</span>
              <span className="text-2xl">▲</span>
            </a>
          </div>
        </div>

        {/* Quick Guide */}
        <div className="mb-6 rounded-xl bg-blue-50 p-6 shadow">
          <h2 className="mb-4 text-lg font-bold text-slate-900">How to Use State Fleet</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold text-blue-900">📋 Inspections</h3>
              <p className="mt-1">Create daily vehicle inspections. Fill all checklist items (use "N/A" if not applicable).</p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900">🔧 Maintenance</h3>
              <p className="mt-1">Log all maintenance work with bill number, supplier, and cost details.</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-900">📊 Analytics</h3>
              <p className="mt-1">View spending trends by vehicle, brand, supplier, and date. Use filters to drill down.</p>
            </div>
            {session.user.role === "admin" && (
              <>
                <div>
                  <h3 className="font-semibold text-orange-900">⚙️ Admin</h3>
                  <p className="mt-1">Manage vehicles, users, and inspection categories. Edit or delete any entry.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">🚗 Vehicles</h3>
                  <p className="mt-1">Add vehicles via Supabase or the app. Use brand/model for better analytics.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full rounded-xl border-2 border-red-500 bg-white py-3 font-bold text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </MobileShell>
  );
}
