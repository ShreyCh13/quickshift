"use client";

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { getSessionHeader } from "@/lib/auth";
import type { AnalyticsResponse } from "@/lib/api-types";

// ============================================
// Types
// ============================================

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface VehicleFilters {
  search?: string;
  brand?: string;
  isActive?: boolean;
}

interface InspectionFilters {
  vehicle_id?: string;
  vehicle_query?: string;
  date_from?: string;
  date_to?: string;
}

interface MaintenanceFilters {
  vehicle_id?: string;
  vehicle_query?: string;
  supplier?: string;
  date_from?: string;
  date_to?: string;
}

// ============================================
// Query Keys (centralized for consistency)
// ============================================

export const queryKeys = {
  vehicles: {
    all: ["vehicles"] as const,
    list: (filters?: VehicleFilters) => ["vehicles", "list", filters] as const,
    dropdown: () => ["vehicles", "dropdown"] as const,
    detail: (id: string) => ["vehicles", "detail", id] as const,
  },
  inspections: {
    all: ["inspections"] as const,
    list: (filters?: InspectionFilters) => ["inspections", "list", filters] as const,
    infinite: (filters?: InspectionFilters) => ["inspections", "infinite", filters] as const,
    detail: (id: string) => ["inspections", "detail", id] as const,
  },
  maintenance: {
    all: ["maintenance"] as const,
    list: (filters?: MaintenanceFilters) => ["maintenance", "list", filters] as const,
    infinite: (filters?: MaintenanceFilters) => ["maintenance", "infinite", filters] as const,
    detail: (id: string) => ["maintenance", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: () => ["users", "list"] as const,
  },
  remarkFields: {
    all: ["remarkFields"] as const,
    active: () => ["remarkFields", "active"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    summary: (filters?: Record<string, unknown>) => ["analytics", "summary", filters] as const,
  },
};

// ============================================
// API Helpers
// ============================================

async function fetchWithSession<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getSessionHeader(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

function encodeFilters(filters: object): string {
  return btoa(JSON.stringify(filters));
}

// ============================================
// Vehicle Hooks
// ============================================

export function useVehicles(
  filters?: VehicleFilters,
  page = 1,
  pageSize = 20
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters?.search) params.set("search", filters.search);

  return useQuery({
    queryKey: queryKeys.vehicles.list(filters),
    queryFn: () =>
      fetchWithSession<{
        vehicles: Array<{
          id: string;
          vehicle_code: string;
          plate_number: string | null;
          brand: string | null;
          model: string | null;
          year: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        total: number;
      }>(`/api/vehicles?${params}`),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useVehiclesInfinite(filters?: VehicleFilters, pageSize = 20) {
  const baseParams: Record<string, string> = { pageSize: String(pageSize) };
  if (filters?.search) baseParams.search = filters.search;

  return useInfiniteQuery({
    queryKey: [...queryKeys.vehicles.list(filters), "infinite"],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        ...baseParams,
        page: String(pageParam),
      });
      const response = await fetchWithSession<{
        vehicles: Array<{
          id: string;
          vehicle_code: string;
          plate_number: string | null;
          brand: string | null;
          model: string | null;
          year: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        total: number;
        hasMore?: boolean;
      }>(`/api/vehicles?${params}`);

      return {
        data: response.vehicles,
        total: response.total,
        page: pageParam,
        pageSize,
        hasMore: response.hasMore ?? (pageParam * pageSize < response.total),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 60 * 1000,
  });
}

export function useVehicleDropdown() {
  return useQuery({
    queryKey: queryKeys.vehicles.dropdown(),
    queryFn: () =>
      fetchWithSession<{
        vehicles: Array<{
          id: string;
          vehicle_code: string;
          plate_number: string | null;
          brand: string | null;
          model: string | null;
        }>;
      }>("/api/vehicles?pageSize=200"),
    staleTime: 5 * 60 * 1000, // 5 minutes - dropdown data changes less frequently
    select: (data) => data.vehicles,
  });
}

// ============================================
// Inspection Hooks
// ============================================

export function useInspectionsInfinite(
  filters?: InspectionFilters,
  pageSize = 20
) {
  const filtersParam = filters ? encodeFilters(filters) : "";

  return useInfiniteQuery({
    queryKey: queryKeys.inspections.infinite(filters),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(pageSize),
      });
      if (filtersParam) params.set("filters", filtersParam);

      const response = await fetchWithSession<{
        inspections: Array<{
          id: string;
          vehicle_id: string;
          created_at: string;
          odometer_km: number;
          driver_name: string | null;
          remarks_json: Record<string, string>;
          created_by?: string;
          vehicles: {
            vehicle_code: string;
            plate_number: string | null;
            brand: string | null;
            model: string | null;
          } | null;
          users: {
            id: string;
            display_name: string;
          } | null;
        }>;
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/api/events/inspections?${params}`);

      return {
        data: response.inspections,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        hasMore: response.hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      vehicle_id: string;
      odometer_km: number;
      driver_name?: string;
      remarks_json: Record<string, string>;
    }) =>
      fetchWithSession("/api/events/inspections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate all inspection queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithSession("/api/events/inspections", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

// ============================================
// Maintenance Hooks
// ============================================

export function useMaintenanceInfinite(
  filters?: MaintenanceFilters,
  pageSize = 20
) {
  const filtersParam = filters ? encodeFilters(filters) : "";

  return useInfiniteQuery({
    queryKey: queryKeys.maintenance.infinite(filters),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(pageSize),
      });
      if (filtersParam) params.set("filters", filtersParam);

      const response = await fetchWithSession<{
        maintenance: Array<{
          id: string;
          vehicle_id: string;
          created_at: string;
          odometer_km: number;
          bill_number: string;
          supplier_name: string;
          amount: number;
          remarks: string;
          created_by?: string;
          vehicles: {
            vehicle_code: string;
            plate_number: string | null;
            brand: string | null;
            model: string | null;
          } | null;
          users: {
            id: string;
            display_name: string;
          } | null;
        }>;
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
      }>(`/api/events/maintenance?${params}`);

      return {
        data: response.maintenance,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        hasMore: response.hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      vehicle_id: string;
      odometer_km: number;
      bill_number: string;
      supplier_name: string;
      amount: number;
      remarks: string;
    }) =>
      fetchWithSession("/api/events/maintenance", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithSession("/api/events/maintenance", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

// ============================================
// User & Remark Field Hooks
// ============================================

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () =>
      fetchWithSession<{
        users: Array<{
          id: string;
          username: string;
          display_name: string;
          role: string;
          password?: string;
          created_at: string;
        }>;
      }>("/api/users"),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.users,
  });
}

export function useRemarkFields() {
  return useQuery({
    queryKey: queryKeys.remarkFields.active(),
    queryFn: () =>
      fetchWithSession<{
        remarkFields: Array<{
          id: string;
          key: string;
          label: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        }>;
      }>("/api/config/remarks"),
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => data.remarkFields,
  });
}

// ============================================
// Analytics Hook
// ============================================

export function useAnalytics(filters?: Record<string, unknown>) {
  // Build filters param if filters provided
  let queryString = "";
  if (filters && Object.keys(filters).length > 0) {
    const encoded = btoa(JSON.stringify(filters));
    queryString = `?filters=${encoded}`;
  }

  return useQuery({
    queryKey: queryKeys.analytics.summary(filters),
    queryFn: () => fetchWithSession<AnalyticsResponse>(`/api/analytics${queryString}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Admin Mutations
// ============================================

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; display_name: string; role: string }) =>
      fetchWithSession("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; display_name?: string; role?: string; password?: string }) =>
      fetchWithSession("/api/users", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchWithSession("/api/users", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useCreateRemarkField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; label: string; sort_order: number; is_active: boolean }) =>
      fetchWithSession("/api/config/remarks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remarkFields.all });
    },
  });
}

export function useUpdateRemarkField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; key: string; label: string; sort_order: number; is_active: boolean }) =>
      fetchWithSession("/api/config/remarks", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remarkFields.all });
    },
  });
}

export function useDeleteRemarkField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchWithSession("/api/config/remarks", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remarkFields.all });
    },
  });
}
