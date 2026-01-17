-- Supabase schema for QuickShift (car inspection + maintenance logging)
-- Single source of truth for tables + indexes

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  display_name text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique check (length(vehicle_code) <= 50),
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

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  odometer_km int not null check (odometer_km >= 0),
  driver_name text null,
  remarks_json jsonb not null,
  created_by uuid not null references public.users(id),
  updated_by uuid null references public.users(id),
  is_deleted boolean not null default false
);

create index if not exists inspections_vehicle_created_idx on public.inspections (vehicle_id, created_at desc);
create index if not exists inspections_created_idx on public.inspections (created_at desc);
create index if not exists inspections_created_by_idx on public.inspections (created_by);
create index if not exists inspections_driver_idx on public.inspections (driver_name) where driver_name is not null;
create index if not exists inspections_remarks_gin_idx on public.inspections using gin (remarks_json);
create index if not exists inspections_is_deleted_idx on public.inspections (is_deleted) where is_deleted = false;

create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  odometer_km int not null check (odometer_km >= 0),
  bill_number text not null check (length(bill_number) <= 100),
  supplier_name text not null check (length(supplier_name) <= 200),
  amount numeric(12,2) not null check (amount >= 0),
  remarks text not null check (length(remarks) <= 5000),
  created_by uuid not null references public.users(id),
  updated_by uuid null references public.users(id),
  is_deleted boolean not null default false
);

create index if not exists maintenance_vehicle_created_idx on public.maintenance (vehicle_id, created_at desc);
create index if not exists maintenance_created_idx on public.maintenance (created_at desc);
create index if not exists maintenance_supplier_lower_idx on public.maintenance (lower(supplier_name));
create index if not exists maintenance_bill_number_idx on public.maintenance (bill_number);
create index if not exists maintenance_created_by_idx on public.maintenance (created_by);
create index if not exists maintenance_amount_idx on public.maintenance (amount);
create index if not exists maintenance_is_deleted_idx on public.maintenance (is_deleted) where is_deleted = false;

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers to all tables
drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();

drop trigger if exists inspections_set_updated_at on public.inspections;
create trigger inspections_set_updated_at
before update on public.inspections
for each row
execute function public.set_updated_at();

drop trigger if exists maintenance_set_updated_at on public.maintenance;
create trigger maintenance_set_updated_at
before update on public.maintenance
for each row
execute function public.set_updated_at();
