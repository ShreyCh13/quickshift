/**
 * Shared API utilities for consistent API interactions across the app.
 */

/**
 * Encode a string to base64, works in both browser and server.
 */
export function toBase64(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

/**
 * Decode a base64 string, works in both browser and server.
 */
export function fromBase64(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(value)));
}

/**
 * Build an export URL with optional filters.
 */
export function buildExportUrl(params: {
  type: "vehicles" | "inspections" | "maintenance";
  format: "xlsx" | "csv";
  filters?: Record<string, unknown>;
}): string {
  const query = new URLSearchParams();
  query.set("type", params.type);
  query.set("format", params.format);
  if (params.filters && Object.keys(params.filters).length > 0) {
    const raw = JSON.stringify(params.filters);
    query.set("filters", toBase64(raw));
  }
  return `/api/export?${query.toString()}`;
}

/**
 * Build a query string from parameters, encoding filters as base64.
 */
export function buildQueryParams(params: {
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}): string {
  const query = new URLSearchParams();
  
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.filters && Object.keys(params.filters).length > 0) {
    const raw = JSON.stringify(params.filters);
    query.set("filters", toBase64(raw));
  }
  
  // Add any other string params
  Object.entries(params).forEach(([key, value]) => {
    if (key !== "page" && key !== "pageSize" && key !== "filters" && value !== undefined) {
      query.set(key, String(value));
    }
  });
  
  return query.toString();
}

/**
 * Parse filters from base64-encoded query param.
 */
export function parseFilters<T = Record<string, unknown>>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const decoded = fromBase64(raw);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}
