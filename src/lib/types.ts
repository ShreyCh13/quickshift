export type Role = "admin" | "staff";

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
};

export type VehicleRow = {
  id: string;
  vehicle_code: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate_number: string | null;
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

export type InspectionRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  driver_name: string | null;
  remarks_json: Record<string, string>;
  created_by: string;
};

export type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  odometer_km: number;
  bill_number: string;
  supplier_name: string;
  amount: string;
  remarks: string;
  created_by: string;
};

export type VehiclesImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};
