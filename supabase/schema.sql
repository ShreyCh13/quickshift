-- State Fleet: Complete Database Schema (v2)
-- Includes: users, vehicles, remark_fields, inspections, maintenance, suppliers, drivers
-- Run this in a fresh Supabase project; for existing projects run migration_v2.sql instead.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- For fast ILIKE / trigram search on names

-- ============================================================
-- UTILITY: auto-update updated_at timestamps
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set when admin changes password; used to invalidate stale sessions
  password_changed_at timestamptz
);

-- ============================================================
-- VEHICLES
-- ============================================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique check (length(vehicle_code) <= 50),
  plate_number text null check (plate_number is null or length(plate_number) <= 50),
  brand text null check (brand is null or length(brand) <= 100),
  model text null check (model is null or length(model) <= 100),
  year int null check (year is null or (year >= 1900 and year <= extract(year from now()) + 1)),
  notes text null check (notes is null or length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_is_active_idx on public.vehicles (is_active) where is_active = true;
create index if not exists vehicles_brand_idx on public.vehicles (brand) where brand is not null;
create index if not exists vehicles_code_idx on public.vehicles (lower(vehicle_code));
create index if not exists vehicles_plate_idx on public.vehicles (lower(plate_number)) where plate_number is not null;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- ============================================================
-- SUPPLIERS
-- ============================================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists suppliers_name_lower_idx on public.suppliers (lower(name));
create index if not exists suppliers_is_active_idx on public.suppliers (is_active) where is_active = true;
create index if not exists suppliers_name_trgm_idx on public.suppliers using gin (name gin_trgm_ops);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

-- ============================================================
-- DRIVERS
-- ============================================================
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists drivers_name_lower_idx on public.drivers (lower(name));
create index if not exists drivers_is_active_idx on public.drivers (is_active) where is_active = true;
create index if not exists drivers_name_trgm_idx on public.drivers using gin (name gin_trgm_ops);

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

-- ============================================================
-- REMARK FIELDS (legacy: kept for admin categories tab)
-- ============================================================
create table if not exists public.remark_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists remark_fields_is_active_idx on public.remark_fields (is_active);
create index if not exists remark_fields_sort_order_idx on public.remark_fields (sort_order);

-- ============================================================
-- INSPECTIONS
-- remarks_json structure: Record<fieldKey, { ok: boolean; remarks: string }>
-- ok=true means passed; ok=false means failed (remarks required)
-- ============================================================
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  odometer_km int not null check (odometer_km >= 0),
  driver_name text null,
  remarks_json jsonb not null default '{}',
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid null references public.users(id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

create index if not exists inspections_vehicle_created_idx on public.inspections (vehicle_id, created_at desc);
create index if not exists inspections_created_idx on public.inspections (created_at desc);
create index if not exists inspections_created_by_idx on public.inspections (created_by);
create index if not exists inspections_driver_idx on public.inspections (lower(driver_name)) where driver_name is not null;
create index if not exists inspections_remarks_gin_idx on public.inspections using gin (remarks_json);
create index if not exists inspections_is_deleted_idx on public.inspections (is_deleted) where is_deleted = false;

drop trigger if exists inspections_set_updated_at on public.inspections;
create trigger inspections_set_updated_at
before update on public.inspections
for each row execute function public.set_updated_at();

-- ============================================================
-- MAINTENANCE
-- ============================================================
create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  odometer_km int not null check (odometer_km >= 0),
  bill_number text not null check (length(bill_number) <= 100),
  supplier_name text not null check (length(supplier_name) <= 200),
  supplier_invoice_number text not null default '' check (length(supplier_invoice_number) <= 100),
  amount numeric(12,2) not null check (amount >= 0),
  remarks text not null check (length(remarks) <= 5000),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid null references public.users(id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

create index if not exists maintenance_vehicle_created_idx on public.maintenance (vehicle_id, created_at desc);
create index if not exists maintenance_created_idx on public.maintenance (created_at desc);
create index if not exists maintenance_supplier_lower_idx on public.maintenance (lower(supplier_name));
create index if not exists maintenance_bill_number_idx on public.maintenance (bill_number);
create index if not exists maintenance_supplier_invoice_idx on public.maintenance (supplier_invoice_number) where supplier_invoice_number != '';
create index if not exists maintenance_created_by_idx on public.maintenance (created_by);
create index if not exists maintenance_amount_idx on public.maintenance (amount);
create index if not exists maintenance_is_deleted_idx on public.maintenance (is_deleted) where is_deleted = false;

drop trigger if exists maintenance_set_updated_at on public.maintenance;
create trigger maintenance_set_updated_at
before update on public.maintenance
for each row execute function public.set_updated_at();
