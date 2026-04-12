-- Migration v7: Supplier invoice date on maintenance (nullable for legacy rows)
-- Safe to run multiple times.

alter table public.maintenance
  add column if not exists supplier_invoice_date date null;

comment on column public.maintenance.supplier_invoice_date is 'Date on supplier invoice; optional for legacy records';
