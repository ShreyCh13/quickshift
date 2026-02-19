-- Migration v2: Suppliers, Drivers, Supplier Invoice Number, Password Changed At
-- Run this in Supabase SQL Editor (safe to run multiple times - uses IF NOT EXISTS)

-- ============================================================
-- 1. SUPPLIERS TABLE
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
create index if not exists suppliers_created_at_idx on public.suppliers (created_at desc);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

-- ============================================================
-- 2. DRIVERS TABLE
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
create index if not exists drivers_created_at_idx on public.drivers (created_at desc);

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at
before update on public.drivers
for each row
execute function public.set_updated_at();

-- ============================================================
-- 3. ADD supplier_invoice_number TO maintenance
-- ============================================================
alter table public.maintenance
  add column if not exists supplier_invoice_number text not null default ''
    check (length(supplier_invoice_number) <= 100);

-- Remove default after column is added (existing rows get empty string, new rows must supply value)
-- Note: The application will enforce this as required. Empty string default only for migration safety.

create index if not exists maintenance_supplier_invoice_idx on public.maintenance (supplier_invoice_number)
  where supplier_invoice_number != '';

-- ============================================================
-- 4. ADD password_changed_at TO users (for session invalidation)
-- ============================================================
alter table public.users
  add column if not exists password_changed_at timestamptz;

-- ============================================================
-- 5. SOFT DELETE columns on inspections (if not present from older schema)
-- ============================================================
alter table public.inspections
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

alter table public.maintenance
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

-- ============================================================
-- 6. TRIGRAM EXTENSION for fast name search (required for pg_trgm indexes)
-- ============================================================
create extension if not exists pg_trgm;

create index if not exists suppliers_name_trgm_idx on public.suppliers using gin (name gin_trgm_ops);
create index if not exists drivers_name_trgm_idx on public.drivers using gin (name gin_trgm_ops);
