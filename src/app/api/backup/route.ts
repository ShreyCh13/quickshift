import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { rowsToCsv } from "@/lib/excel";
import { uploadToS3 } from "@/lib/storage";

function requireBackupSecret(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  return token && token === process.env.BACKUP_SECRET;
}

function dateKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function POST(req: Request) {
  if (!requireBackupSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("vehicles").select("id", { count: "exact", head: true });

  const [vehicles, inspections, maintenance] = await Promise.all([
    supabase.from("vehicles").select("*"),
    supabase.from("inspections").select("*"),
    supabase.from("maintenance").select("*"),
  ]);

  if (vehicles.error || inspections.error || maintenance.error) {
    return NextResponse.json({ error: "Failed to fetch export data" }, { status: 500 });
  }

  const date = dateKey();
  const uploads = await Promise.all([
    uploadToS3({
      key: `backups/${date}/vehicles.csv`,
      body: rowsToCsv(vehicles.data || []),
      contentType: "text/csv",
    }),
    uploadToS3({
      key: `backups/${date}/inspections.csv`,
      body: rowsToCsv(inspections.data || []),
      contentType: "text/csv",
    }),
    uploadToS3({
      key: `backups/${date}/maintenance.csv`,
      body: rowsToCsv(maintenance.data || []),
      contentType: "text/csv",
    }),
  ]);

  return NextResponse.json({ success: true, uploads });
}
