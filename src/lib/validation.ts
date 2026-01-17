import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userCreateSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  display_name: z.string().min(1),
  role: z.enum(["admin", "staff"]),
});

export const userUpdateSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  display_name: z.string().min(1).optional(),
  role: z.enum(["admin", "staff"]).optional(),
});

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  vehicle_code: z.string().min(1).max(50),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const remarkFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const inspectionCreateSchema = z.object({
  vehicle_id: z.string().uuid(),
  odometer_km: z.number().int().min(0),
  driver_name: z.string().max(200).optional().nullable(),
  remarks_json: z.record(z.string(), z.string().min(1).max(500)),
});

export const maintenanceCreateSchema = z.object({
  vehicle_id: z.string().uuid(),
  odometer_km: z.number().int().min(0),
  bill_number: z.string().min(1).max(100),
  supplier_name: z.string().min(1).max(200),
  amount: z.number().min(0),
  remarks: z.string().min(1).max(5000),
});

export const inspectionUpdateSchema = inspectionCreateSchema.extend({
  id: z.string().uuid(),
});

export const maintenanceUpdateSchema = maintenanceCreateSchema.extend({
  id: z.string().uuid(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const inspectionsFilterSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  odometer_min: z.number().int().optional(),
  odometer_max: z.number().int().optional(),
  remarks: z.record(z.string(), z.string().min(1)).optional(),
});

export const maintenanceFilterSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  odometer_min: z.number().int().optional(),
  odometer_max: z.number().int().optional(),
  supplier: z.string().optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
});
