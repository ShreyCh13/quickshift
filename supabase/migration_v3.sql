-- Migration v3: maintenance_vehicle_summary view + anon read grants for Google Sheets sync
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. VEHICLE MAINTENANCE SUMMARY VIEW
-- Aggregates total maintenance cost & metadata per vehicle.
-- Used by the Google Sheets "Vehicle Summary" tab.
-- ============================================================
create or replace view public.maintenance_vehicle_summary as
select
  v.id           as vehicle_id,
  v.vehicle_code,
  v.brand,
  v.model,
  v.plate_number,
  count(m.id)                              as record_count,
  coalesce(sum(m.amount), 0)               as total_cost,
  max(m.created_at)                        as last_maintenance_date,
  max(m.odometer_km)                       as last_odometer
from public.vehicles v
left join public.maintenance m
  on m.vehicle_id = v.id
  and m.is_deleted = false
where v.is_active = true
group by v.id, v.vehicle_code, v.brand, v.model, v.plate_number
order by total_cost desc;

-- ============================================================
-- 2. GRANT READ ACCESS TO ANON ROLE
-- Required so the Google Apps Script (which uses the anon key)
-- can fetch data from Supabase REST API.
--
-- SECURITY NOTE: Only grant the minimum required access.
-- The queries in the Apps Script filter is_deleted=false
-- but RLS policies below enforce this at the database level.
-- ============================================================

-- Grant on view
grant select on public.maintenance_vehicle_summary to anon;

-- Grant on tables used by the Apps Script
grant select on public.inspections to anon;
grant select on public.maintenance to anon;
grant select on public.vehicles to anon;

-- ============================================================
-- 3. ROW-LEVEL SECURITY POLICIES FOR ANON READ
-- Add safe read-only policies so anon can only see
-- non-deleted records of active vehicles.
-- ============================================================

-- Inspections: anon can read non-deleted rows
drop policy if exists "anon_read_inspections" on public.inspections;
create policy "anon_read_inspections"
  on public.inspections
  for select
  to anon
  using (is_deleted = false);

-- Maintenance: anon can read non-deleted rows
drop policy if exists "anon_read_maintenance" on public.maintenance;
create policy "anon_read_maintenance"
  on public.maintenance
  for select
  to anon
  using (is_deleted = false);

-- Vehicles: anon can read active vehicles
drop policy if exists "anon_read_vehicles" on public.vehicles;
create policy "anon_read_vehicles"
  on public.vehicles
  for select
  to anon
  using (is_active = true);
