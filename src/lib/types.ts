export type Role = "admin" | "staff" | "dev";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  createdAt: string;
};

export type Session = {
  user: SessionUser;
  loginAt: number;
};

export type UserRow = {
  id: string;
  username: string;
  password?: string;
  display_name: string;
  role: Role;
  created_at: string;
  updated_at?: string;
  password_changed_at?: string | null;
};

export type VehicleRow = {
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
};

export type RemarkFieldRow = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ChecklistItemRow = {
  id: string;
  category_key: string;
  category_label: string;
  item_key: string;
  item_label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type SupplierRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type DriverRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

/** A single item in the inspection checklist */
export type ChecklistItem = {
  /** true = passed/OK (ticked); false = issue found (remarks required) */
  ok: boolean;
  /** Required when ok = false */
  remarks: string;
};

export type InspectionRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  updated_at: string;
  odometer_km: number;
  driver_name: string | null;
  /** Keys match INSPECTION_CATEGORIES field keys */
  remarks_json: Record<string, ChecklistItem>;
  created_by: string;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  updated_at: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  supplier_invoice_number: string;
  amount: number;
  remarks: string;
  created_by: string;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type VehiclesImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};
