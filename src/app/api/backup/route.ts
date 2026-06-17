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

/** True only when all S3 credentials are present. */
function s3Configured(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  );
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
      fetchAllPaginated<Record<string, unknown>>("vehicles", "created_at"),
      fetchAllPaginated<Record<string, unknown>>("inspections", "created_at"),
      fetchAllPaginated<Record<string, unknown>>("maintenance", "created_at"),
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
    const files: Record<string, string> = {
      "vehicles.csv": rowsToCsv(vehicles.data || []),
      "inspections.csv": rowsToCsv(inspections.data || []),
      "maintenance.csv": rowsToCsv(maintenance.data || []),
    };
    const counts = {
      vehicles: vehicles.data.length,
      inspections: inspections.data.length,
      maintenance: maintenance.data.length,
    };

    // Preferred: upload to S3 when configured.
    if (s3Configured()) {
      const uploads = await Promise.all(
        Object.entries(files).map(([name, body]) =>
          uploadToS3({ key: `backups/${date}/${name}`, body, contentType: "text/csv" })
        )
      );
      return NextResponse.json({ success: true, storage: "s3", date, uploads, counts });
    }

    // Fallback: no S3 configured — return CSVs inline so the caller (the
    // GitHub Action) can archive them as a private artifact. This keeps
    // backups working with zero external storage setup.
    return NextResponse.json({ success: true, storage: "inline", date, counts, files });
  } catch (err) {
    console.error("Failed to upload backups:", err);
    return NextResponse.json({ error: "Failed to upload backups" }, { status: 500 });
  }
}
