import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { rowsToCsv } from "@/lib/excel";
import { uploadToS3 } from "@/lib/storage";

// Maximum rows per batch to prevent memory issues
const BATCH_SIZE = 5000;

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

/**
 * Fetch all rows from a table using pagination to avoid memory issues
 */
async function fetchAllPaginated<T>(
  table: string,
  orderBy: string = "created_at"
): Promise<{ data: T[]; error: Error | null }> {
  const supabase = getSupabaseAdmin();
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}

export async function POST(req: Request) {
  if (!requireBackupSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch data with pagination to handle large datasets
    const [vehicles, inspections, maintenance] = await Promise.all([
      fetchAllPaginated("vehicles", "created_at"),
      fetchAllPaginated("inspections", "created_at"),
      fetchAllPaginated("maintenance", "created_at"),
    ]);

    if (vehicles.error || inspections.error || maintenance.error) {
      console.error("Failed to fetch backup data:", { 
        vehiclesError: vehicles.error, 
        inspectionsError: inspections.error, 
        maintenanceError: maintenance.error 
      });
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

    return NextResponse.json({ 
      success: true, 
      uploads,
      counts: {
        vehicles: vehicles.data.length,
        inspections: inspections.data.length,
        maintenance: maintenance.data.length,
      }
    });
  } catch (err) {
    console.error("Failed to upload backups:", err);
    return NextResponse.json({ error: "Failed to upload backups" }, { status: 500 });
  }
}
