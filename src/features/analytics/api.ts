import { getSessionHeader } from "@/lib/auth";

export async function fetchAnalytics() {
  const res = await fetch("/api/analytics", { headers: { ...getSessionHeader() } });
  return res.json();
}
