/**
 * Shared query helpers for API routes
 * Consolidates duplicated logic for filtering, pagination, and data enrichment
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ZodSchema } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "./constants";

// ============================================================================
// Types
// ============================================================================

export type VehicleInfo = {
  vehicle_code: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

export type VehicleFilters = {
  vehicle_id?: string;
  vehicle_query?: string;
  brand?: string;
};

export type PaginationParams = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

// ============================================================================
// Filter Parsing
// ============================================================================

/**
 * Parse base64-encoded filters from query string
 * Replaces 4 different implementations across routes
 * 
 * @param raw - Base64 encoded JSON string from query params
 * @param schema - Optional Zod schema for validation
 * @returns Parsed and validated filters, or empty object on error
 */
export function parseFilters<T extends Record<string, unknown>>(
  raw: string | null,
  schema?: ZodSchema<T>
): T {
  if (!raw) return {} as T;
  
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as T;
    }
    
    if (schema) {
      const result = schema.safeParse(parsed);
      return result.success ? result.data : {} as T;
    }
    
    return parsed as T;
  } catch (error) {
    console.error("Failed to parse filters:", error);
    return {} as T;
  }
}

/**
 * Extract filter values directly from parsed object
 * Use when Zod validation is not needed but type safety is desired
 */
export function extractFilters<T extends Record<string, unknown>>(
  filters: Record<string, unknown> | null | undefined,
  keys: (keyof T)[]
): Partial<T> {
  if (!filters) return {};
  
  const result: Partial<T> = {};
  for (const key of keys) {
    if (filters[key as string] !== undefined) {
      result[key] = filters[key as string] as T[keyof T];
    }
  }
  return result;
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Parse pagination parameters from URL
 * Standardizes max values across all routes
 * 
 * @param url - Request URL object
 * @param maxPageSize - Optional override for max page size (default: PAGE_SIZE_MAX)
 */
export function parsePagination(url: URL, maxPageSize: number = PAGE_SIZE_MAX): PaginationParams {
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const requestedPageSize = Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT);
  const pageSize = Math.min(maxPageSize, Math.max(1, requestedPageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  return { page, pageSize, from, to };
}

// ============================================================================
// Vehicle Filtering
// ============================================================================

/**
 * Get vehicle IDs matching filter criteria
 * Replaces 4 duplicate 15-line blocks across routes
 * 
 * @returns Array of vehicle IDs, empty array if no filters, null if no matches found
 */
export async function getVehicleIdsByFilter(
  supabase: SupabaseClient,
  filters: VehicleFilters
): Promise<{ ids: string[]; noMatch: boolean }> {
  // If specific vehicle_id provided, use it directly
  if (filters.vehicle_id) {
    return { ids: [filters.vehicle_id], noMatch: false };
  }
  
  // Search by vehicle_query (code, plate, brand, model)
  if (filters.vehicle_query) {
    const term = `%${filters.vehicle_query}%`;
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("id")
      .or(`vehicle_code.ilike.${term},plate_number.ilike.${term},brand.ilike.${term},model.ilike.${term}`);
    
    if (error) {
      console.error("Vehicle query filter error:", error);
      throw new Error("Failed to filter vehicles");
    }
    
    const ids = (vehicles || []).map((v) => v.id);
    return { ids, noMatch: ids.length === 0 };
  }
  
  // Filter by brand
  if (filters.brand) {
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("id")
      .ilike("brand", filters.brand);
    
    if (error) {
      console.error("Brand filter error:", error);
      throw new Error("Failed to filter by brand");
    }
    
    const ids = (vehicles || []).map((v) => v.id);
    return { ids, noMatch: ids.length === 0 };
  }
  
  // No vehicle filters - return empty array (don't filter by vehicle)
  return { ids: [], noMatch: false };
}

/**
 * Apply vehicle ID filter to a query
 * Helper to simplify query building
 */
export function applyVehicleFilter<T>(
  query: T & { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T },
  vehicleResult: { ids: string[]; noMatch: boolean }
): T | null {
  if (vehicleResult.noMatch) {
    return null; // Signal to return empty results
  }
  
  if (vehicleResult.ids.length === 1) {
    return query.eq("vehicle_id", vehicleResult.ids[0]);
  }
  
  if (vehicleResult.ids.length > 1) {
    return query.in("vehicle_id", vehicleResult.ids);
  }
  
  return query; // No filter applied
}

// ============================================================================
// Vehicle Enrichment
// ============================================================================

/**
 * Batch fetch vehicles and enrich records
 * Replaces 2 identical 25-line blocks in inspections and maintenance routes
 * Fixes N+1 query problem
 */
export async function enrichWithVehicles<T extends { vehicle_id?: string | null }>(
  records: T[],
  supabase: SupabaseClient
): Promise<(T & { vehicles: VehicleInfo | null })[]> {
  if (records.length === 0) {
    return [];
  }
  
  // Collect unique vehicle IDs
  const vehicleIds = [...new Set(
    records
      .filter((r) => r.vehicle_id)
      .map((r) => r.vehicle_id as string)
  )];
  
  if (vehicleIds.length === 0) {
    return records.map((r) => ({ ...r, vehicles: null }));
  }
  
  // Batch fetch all vehicles in ONE query
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, vehicle_code, plate_number, brand, model")
    .in("id", vehicleIds);
  
  if (error) {
    console.error("Failed to fetch vehicles for enrichment:", error);
    return records.map((r) => ({ ...r, vehicles: null }));
  }
  
  // Create lookup map
  const vehicleMap = new Map<string, VehicleInfo>();
  for (const v of vehicles || []) {
    vehicleMap.set(v.id, {
      vehicle_code: v.vehicle_code,
      plate_number: v.plate_number,
      brand: v.brand,
      model: v.model,
    });
  }
  
  // Enrich records
  return records.map((r) => ({
    ...r,
    vehicles: r.vehicle_id ? vehicleMap.get(r.vehicle_id) || null : null,
  }));
}

// ============================================================================
// Soft Delete
// ============================================================================

/**
 * Perform soft delete on a record
 * Sets is_deleted, deleted_at, deleted_by, and updated_by
 */
export async function softDelete(
  supabase: SupabaseClient,
  table: "inspections" | "maintenance",
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from(table)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      updated_by: userId,
    })
    .eq("id", id);
  
  if (error) {
    console.error(`Failed to soft delete ${table}:`, error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create an empty paginated response
 */
export function emptyPaginatedResponse<K extends string>(
  key: K,
  pagination: PaginationParams
): Record<K, []> & { total: number; page: number; pageSize: number; hasMore: boolean } {
  return {
    [key]: [],
    total: 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasMore: false,
  } as Record<K, []> & { total: number; page: number; pageSize: number; hasMore: boolean };
}

/**
 * Build paginated response object
 */
export function paginatedResponse<T, K extends string>(
  key: K,
  data: T[],
  total: number,
  pagination: PaginationParams
): Record<K, T[]> & { total: number; page: number; pageSize: number; hasMore: boolean } {
  return {
    [key]: data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasMore: pagination.from + data.length < total,
  } as Record<K, T[]> & { total: number; page: number; pageSize: number; hasMore: boolean };
}

// ============================================================================
// Date Filtering
// ============================================================================

/**
 * Apply date range filters to a query
 */
export function applyDateFilters<T>(
  query: T & { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T },
  filters: { date_from?: string; date_to?: string },
  column: string = "created_at"
): T {
  let result = query;
  
  if (filters.date_from) {
    result = result.gte(column, filters.date_from);
  }
  
  if (filters.date_to) {
    result = result.lte(column, filters.date_to);
  }
  
  return result;
}
