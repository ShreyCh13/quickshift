/**
 * Shared API response types
 * Single source of truth for API response structures
 */

// ============================================================================
// Generic Response Types
// ============================================================================

/**
 * Standard paginated response structure
 * Used by inspections, maintenance, vehicles, users APIs
 */
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Standard error response
 */
export type ApiError = {
  error: string;
  details?: string;
};

/**
 * Success response for mutations
 */
export type MutationSuccess = {
  success: true;
};

/**
 * Delete response with soft delete info
 */
export type DeleteResponse = {
  success: true;
  soft?: boolean;
  relatedRecords?: {
    inspectionCount: number;
    maintenanceCount: number;
  };
};

// ============================================================================
// Entity-Specific Response Types
// ============================================================================

/**
 * Vehicle info for embedded/joined data
 */
export type VehicleInfo = {
  vehicle_code: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

/**
 * Inspection with embedded vehicle info
 */
export type InspectionWithVehicle = {
  id: string;
  vehicle_id: string;
  created_at: string;
  updated_at?: string;
  odometer_km: number;
  driver_name?: string | null;
  remarks_json?: Record<string, string> | null;
  created_by: string;
  updated_by?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  vehicles: VehicleInfo | null;
};

/**
 * Maintenance with embedded vehicle info
 */
export type MaintenanceWithVehicle = {
  id: string;
  vehicle_id: string;
  created_at: string;
  updated_at?: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  amount: number;
  remarks?: string | null;
  created_by: string;
  updated_by?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  vehicles: VehicleInfo | null;
};

/**
 * User (without password)
 */
export type UserPublic = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "staff" | "dev";
  created_at: string;
  updated_at?: string;
};

/**
 * Remark field configuration
 */
export type RemarkField = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

// ============================================================================
// API-Specific Response Types
// ============================================================================

/**
 * Inspections list response
 */
export type InspectionsResponse = {
  inspections: InspectionWithVehicle[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Maintenance list response
 */
export type MaintenanceResponse = {
  maintenance: MaintenanceWithVehicle[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Vehicles list response
 */
export type VehiclesResponse = {
  vehicles: Array<{
    id: string;
    vehicle_code: string;
    plate_number?: string | null;
    brand: string;
    model: string;
    year?: number | null;
    notes?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Users list response
 */
export type UsersResponse = {
  users: UserPublic[];
  total: number;
};

/**
 * Analytics response
 */
export type AnalyticsResponse = {
  filters: Record<string, unknown>;
  inspections: InspectionWithVehicle[];
  maintenance: MaintenanceWithVehicle[];
  monthly: Array<{ month: string; total: number }>;
  topSuppliers: Array<{ supplier: string; total: number; count: number }>;
  topVehicles: Array<{
    vehicle_code: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
    maintenance_count: number;
    inspection_count: number;
    total: number;
  }>;
  totalInspections: number;
  totalMaintenance: number;
};

/**
 * Login response (session stored client-side; no token/expiresAt returned)
 */
export type LoginResponse = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: "admin" | "staff" | "dev";
  };
};

// ============================================================================
// Filter Types (for frontend queries)
// ============================================================================

/**
 * Inspection filter parameters
 */
export type InspectionFilters = {
  vehicle_id?: string;
  vehicle_query?: string;
  brand?: string;
  date_from?: string;
  date_to?: string;
};

/**
 * Maintenance filter parameters
 */
export type MaintenanceFilters = {
  vehicle_id?: string;
  vehicle_query?: string;
  brand?: string;
  date_from?: string;
  date_to?: string;
  supplier?: string;
};

/**
 * Analytics filter parameters
 */
export type AnalyticsFilters = {
  vehicle_id?: string;
  brand?: string;
  date_from?: string;
  date_to?: string;
  supplier?: string;
  type?: "all" | "inspections" | "maintenance";
};

/**
 * Vehicle filter parameters
 */
export type VehicleFilters = {
  search?: string;
  is_active?: boolean;
};
