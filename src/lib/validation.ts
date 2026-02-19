import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const deleteWithForceSchema = z.object({
  id: z.string().uuid(),
  force: z.boolean().optional(),
});

// ============================================================================
// Auth Schemas
// ============================================================================

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userCreateSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
    role: z.enum(["admin", "staff"]),
  })
  .transform((data) => ({ ...data, display_name: data.username }));

export const userUpdateSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    role: z.enum(["admin", "staff"]).optional(),
  })
  .transform((data) => {
    const { username, ...rest } = data;
    return username !== undefined ? { ...rest, username, display_name: username } : data;
  });

// ============================================================================
// Vehicle Schemas
// ============================================================================

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  vehicle_code: z.string().min(1).max(50),
  plate_number: z.string().max(50).optional().nullable(),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// Remark Field Schemas (legacy - kept for admin categories tab)
// ============================================================================

export const remarkFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const checklistItemConfigSchema = z.object({
  id: z.string().uuid().optional(),
  category_key: z.string().min(1),
  category_label: z.string().min(1),
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

// ============================================================================
// Supplier & Driver Schemas
// ============================================================================

export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export const supplierUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).trim().optional(),
  is_active: z.boolean().optional(),
});

export const driverCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export const driverUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).trim().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// Inspection Schemas
// ============================================================================

/** A single checklist item: ok flag + optional remarks (required if not ok) */
const checklistItemSchema = z
  .object({
    ok: z.boolean(),
    remarks: z.string().max(500).default(""),
  })
  .refine((item) => item.ok || item.remarks.trim().length > 0, {
    message: "Remarks are required when item is not OK",
  });

export const inspectionCreateSchema = z.object({
  vehicle_id: z.string().uuid(),
  odometer_km: z.number().int().min(0),
  driver_name: z.string().max(200).optional().nullable(),
  remarks_json: z.record(z.string(), checklistItemSchema),
});

export const inspectionUpdateSchema = inspectionCreateSchema.extend({
  id: z.string().uuid(),
});

// ============================================================================
// Maintenance Schemas
// ============================================================================

export const maintenanceCreateSchema = z.object({
  vehicle_id: z.string().uuid(),
  odometer_km: z.number().int().min(0),
  bill_number: z.string().min(1).max(100),
  supplier_name: z.string().min(1).max(200),
  supplier_invoice_number: z.string().min(1).max(100),
  amount: z.number().min(0),
  remarks: z.string().min(1).max(5000),
});

export const maintenanceUpdateSchema = maintenanceCreateSchema.extend({
  id: z.string().uuid(),
});

// ============================================================================
// Filter & Pagination Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const inspectionsFilterSchema = z.object({
  // Legacy single-value filters
  vehicle_id: z.string().uuid().optional(),
  vehicle_query: z.string().optional(),
  brand: z.string().optional(),
  driver_name: z.string().optional(),
  remarks: z.record(z.string(), z.string().min(1)).optional(),
  // Multi-select filters
  vehicle_ids: z.array(z.string().uuid()).optional(),
  driver_names: z.array(z.string()).optional(),
  filter_mode: z.enum(["and", "or"]).optional(),
  // Universal search
  search: z.string().optional(),
  // Date / range
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  odometer_min: z.number().int().optional(),
  odometer_max: z.number().int().optional(),
});

export const maintenanceFilterSchema = z.object({
  // Legacy single-value filters (kept for backward compat / exports)
  vehicle_id: z.string().uuid().optional(),
  vehicle_query: z.string().optional(),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  supplier_invoice_number: z.string().optional(),
  // Multi-select filters
  vehicle_ids: z.array(z.string().uuid()).optional(),
  supplier_names: z.array(z.string()).optional(),
  filter_mode: z.enum(["and", "or"]).optional(),
  // Universal search
  search: z.string().optional(),
  // Date / amount ranges
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  odometer_min: z.number().int().optional(),
  odometer_max: z.number().int().optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
});

export const analyticsFilterSchema = z.object({
  // Legacy single-value filters
  vehicle_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  // Multi-select filters
  vehicle_ids: z.array(z.string().uuid()).optional(),
  supplier_names: z.array(z.string()).optional(),
  // Other filters
  type: z.enum(["all", "inspections", "maintenance"]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export const vehicleFilterSchema = z.object({
  search: z.string().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type IdInput = z.infer<typeof idSchema>;
export type DeleteWithForceInput = z.infer<typeof deleteWithForceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type RemarkFieldInput = z.infer<typeof remarkFieldSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemConfigSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type InspectionCreateInput = z.infer<typeof inspectionCreateSchema>;
export type InspectionUpdateInput = z.infer<typeof inspectionUpdateSchema>;
export type MaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>;
export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>;
export type InspectionsFilterInput = z.infer<typeof inspectionsFilterSchema>;
export type MaintenanceFilterInput = z.infer<typeof maintenanceFilterSchema>;
export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;
export type VehicleFilterInput = z.infer<typeof vehicleFilterSchema>;
