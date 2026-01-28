"use client";

import type { ReactNode } from "react";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type Props = {
  title: string;
  children: ReactNode;
};

export default function MobileShell({ title, children }: Props) {
  const { isOnline, pendingCount } = useOnlineStatus();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <span>You&apos;re offline. Changes will sync when connected.</span>
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {isOnline && pendingCount > 0 && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-blue-500 px-4 py-2 text-center text-sm font-medium text-white">
          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Syncing {pendingCount} pending {pendingCount === 1 ? "change" : "changes"}...</span>
          </div>
        </div>
      )}

      <TopBar title={title} />
      <main className={`mx-auto max-w-xl px-4 pb-24 pt-4 ${!isOnline || pendingCount > 0 ? "mt-10" : ""}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
