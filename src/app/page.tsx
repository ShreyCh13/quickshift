"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const session = loadSession();
    router.replace(session ? "/vehicles" : "/login");
  }, [router]);

  return <div className="min-h-screen bg-slate-50" />;
}
