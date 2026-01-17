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
  vehicle_code text not null unique,
  brand text null,
  model text null,
  year int null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_is_active_idx on public.vehicles (is_active);
create index if not exists vehicles_brand_idx on public.vehicles (brand);

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
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  odometer_km int not null,
  driver_name text null,
  remarks_json jsonb not null,
  created_by uuid not null references public.users(id)
);

create index if not exists inspections_vehicle_created_idx on public.inspections (vehicle_id, created_at desc);
create index if not exists inspections_created_idx on public.inspections (created_at desc);

create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  odometer_km int not null,
  bill_number text not null,
  supplier_name text not null,
  amount numeric(12,2) not null,
  remarks text not null,
  created_by uuid not null references public.users(id)
);

create index if not exists maintenance_vehicle_created_idx on public.maintenance (vehicle_id, created_at desc);
create index if not exists maintenance_created_idx on public.maintenance (created_at desc);
create index if not exists maintenance_supplier_lower_idx on public.maintenance (lower(supplier_name));

-- Optional updated_at trigger for vehicles
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();
