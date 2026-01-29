-- ===================================================================================
-- QuickShift Database Migration (Consolidated)
-- ===================================================================================
-- Run this ONCE on your existing database after schema.sql
-- Includes: performance indexes, soft delete, constraints, triggers, and scalability
-- WARNING: Backup your data first!
-- Last updated: 2026-01-29
-- ===================================================================================

-- Wrap entire migration in a transaction for atomicity
BEGIN;

-- ============================================================================
-- STEP 1: Add new columns to existing tables
-- ============================================================================

-- Add missing columns to vehicles
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS plate_number text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Add constraint for plate_number if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'vehicles' AND constraint_name = 'vehicles_plate_number_check'
  ) THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_plate_number_check 
      CHECK (plate_number IS NULL OR length(plate_number) <= 50);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add updated_at, is_deleted, deleted_at, deleted_by to inspections
ALTER TABLE public.inspections 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

-- Add updated_at, is_deleted, deleted_at, deleted_by to maintenance
ALTER TABLE public.maintenance 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

-- Add updated_at to users table for consistency
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Set initial values for updated_at (copy from created_at)
UPDATE public.inspections SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.maintenance SET updated_at = created_at WHERE updated_at IS NULL;

-- ============================================================================
-- STEP 2: Add check constraints
-- ============================================================================

-- Vehicles constraints
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_code_length_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_code_length_check 
  CHECK (length(vehicle_code) <= 50);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_brand_length_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_brand_length_check 
  CHECK (brand IS NULL OR length(brand) <= 100);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_model_length_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_model_length_check 
  CHECK (model IS NULL OR length(model) <= 100);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_year_range_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_year_range_check 
  CHECK (year IS NULL OR (year >= 1900 AND year <= extract(year from now()) + 1));

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_notes_length_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_notes_length_check 
  CHECK (notes IS NULL OR length(notes) <= 1000);

-- Inspections constraints
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_odometer_check;
ALTER TABLE public.inspections ADD CONSTRAINT inspections_odometer_check 
  CHECK (odometer_km >= 0);

-- Maintenance constraints
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_odometer_check;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_odometer_check 
  CHECK (odometer_km >= 0);

ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_bill_number_length_check;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_bill_number_length_check 
  CHECK (length(bill_number) <= 100);

ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_supplier_name_length_check;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_supplier_name_length_check 
  CHECK (length(supplier_name) <= 200);

ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_amount_check;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_amount_check 
  CHECK (amount >= 0);

ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_remarks_length_check;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_remarks_length_check 
  CHECK (length(remarks) <= 5000);

-- ============================================================================
-- STEP 3: Update foreign key constraints (change cascade to restrict)
-- ============================================================================

-- Drop existing foreign keys
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_vehicle_id_fkey;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_vehicle_id_fkey;

-- Re-add with RESTRICT instead of CASCADE
ALTER TABLE public.inspections 
  ADD CONSTRAINT inspections_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance 
  ADD CONSTRAINT maintenance_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;

-- ============================================================================
-- STEP 4: Add new indexes
-- ============================================================================

-- Vehicles indexes
CREATE INDEX IF NOT EXISTS vehicles_code_idx ON public.vehicles (lower(vehicle_code));

-- Update existing partial indexes
DROP INDEX IF EXISTS vehicles_is_active_idx;
CREATE INDEX vehicles_is_active_idx ON public.vehicles (is_active) WHERE is_active = true;

DROP INDEX IF EXISTS vehicles_brand_idx;
CREATE INDEX vehicles_brand_idx ON public.vehicles (brand) WHERE brand IS NOT NULL;

-- Inspections indexes
CREATE INDEX IF NOT EXISTS inspections_created_by_idx ON public.inspections (created_by);
CREATE INDEX IF NOT EXISTS inspections_driver_idx ON public.inspections (driver_name) WHERE driver_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS inspections_remarks_gin_idx ON public.inspections USING gin (remarks_json);
CREATE INDEX IF NOT EXISTS inspections_is_deleted_idx ON public.inspections (is_deleted) WHERE is_deleted = false;

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS maintenance_bill_number_idx ON public.maintenance (bill_number);
CREATE INDEX IF NOT EXISTS maintenance_created_by_idx ON public.maintenance (created_by);
CREATE INDEX IF NOT EXISTS maintenance_amount_idx ON public.maintenance (amount);
CREATE INDEX IF NOT EXISTS maintenance_is_deleted_idx ON public.maintenance (is_deleted) WHERE is_deleted = false;

-- Odometer indexes for range queries (used in analytics and filtering)
CREATE INDEX IF NOT EXISTS inspections_odometer_idx ON public.inspections (odometer_km);
CREATE INDEX IF NOT EXISTS maintenance_odometer_idx ON public.maintenance (odometer_km);

-- ============================================================================
-- STEP 5: Add triggers for updated_at
-- ============================================================================

-- Create set_updated_at function if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for vehicles
DROP TRIGGER IF EXISTS vehicles_set_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger for inspections
DROP TRIGGER IF EXISTS inspections_set_updated_at ON public.inspections;
CREATE TRIGGER inspections_set_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger for maintenance
DROP TRIGGER IF EXISTS maintenance_set_updated_at ON public.maintenance;
CREATE TRIGGER maintenance_set_updated_at
  BEFORE UPDATE ON public.maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger for users
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- STEP 6: Data cleanup (optional - only if you have invalid data)
-- ============================================================================

-- Fix negative odometers (uncomment if needed)
-- UPDATE public.inspections SET odometer_km = 0 WHERE odometer_km < 0;
-- UPDATE public.maintenance SET odometer_km = 0 WHERE odometer_km < 0;

-- Fix negative amounts (uncomment if needed)
-- UPDATE public.maintenance SET amount = 0 WHERE amount < 0;

-- Fix too-long strings (uncomment if needed)
-- UPDATE public.vehicles SET vehicle_code = left(vehicle_code, 50) WHERE length(vehicle_code) > 50;
-- UPDATE public.vehicles SET brand = left(brand, 100) WHERE length(brand) > 100;
-- UPDATE public.vehicles SET model = left(model, 100) WHERE length(model) > 100;
-- UPDATE public.vehicles SET notes = left(notes, 1000) WHERE length(notes) > 1000;
-- UPDATE public.maintenance SET bill_number = left(bill_number, 100) WHERE length(bill_number) > 100;
-- UPDATE public.maintenance SET supplier_name = left(supplier_name, 200) WHERE length(supplier_name) > 200;
-- UPDATE public.maintenance SET remarks = left(remarks, 5000) WHERE length(remarks) > 5000;

-- ============================================================================
-- STEP 6: SCALABILITY IMPROVEMENTS (Full-text search, user FK fixes)
-- ============================================================================

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inspections_active_vehicle_date 
ON public.inspections(vehicle_id, created_at DESC) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_inspections_active_created 
ON public.inspections(created_at DESC) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_maintenance_active_vehicle_date 
ON public.maintenance(vehicle_id, created_at DESC) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_maintenance_active_created 
ON public.maintenance(created_at DESC) 
WHERE is_deleted = false;

-- Full-text search indexes for supplier and remarks
CREATE INDEX IF NOT EXISTS idx_maintenance_supplier_trgm 
ON public.maintenance USING gin(supplier_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_maintenance_remarks_trgm 
ON public.maintenance USING gin(remarks gin_trgm_ops);

-- Vehicle plate search (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'plate_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate_lower 
    ON public.vehicles(lower(plate_number)) 
    WHERE plate_number IS NOT NULL;
  END IF;
END $$;

-- Fix user foreign key constraints (ON DELETE SET NULL)
DO $$ 
BEGIN
  -- Make created_by nullable to handle user deletion gracefully
  ALTER TABLE public.inspections ALTER COLUMN created_by DROP NOT NULL;
  ALTER TABLE public.maintenance ALTER COLUMN created_by DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  -- Column might already be nullable, ignore error
  NULL;
END $$;

-- Re-create foreign keys with SET NULL behavior
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inspections_created_by_fkey') THEN
    ALTER TABLE public.inspections DROP CONSTRAINT inspections_created_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inspections_updated_by_fkey') THEN
    ALTER TABLE public.inspections DROP CONSTRAINT inspections_updated_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'maintenance_created_by_fkey') THEN
    ALTER TABLE public.maintenance DROP CONSTRAINT maintenance_created_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'maintenance_updated_by_fkey') THEN
    ALTER TABLE public.maintenance DROP CONSTRAINT maintenance_updated_by_fkey;
  END IF;
END $$;

ALTER TABLE public.inspections ADD CONSTRAINT inspections_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.inspections ADD CONSTRAINT inspections_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 7: ANALYTICS VIEW
-- ============================================================================

-- Drop existing view if it exists to recreate
DROP VIEW IF EXISTS public.vehicle_stats;

-- Create analytics view (handles optional plate_number column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'plate_number'
  ) THEN
    EXECUTE '
      CREATE VIEW public.vehicle_stats AS
      SELECT 
        v.id as vehicle_id,
        v.vehicle_code,
        v.plate_number,
        v.brand,
        v.model,
        v.is_active,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_deleted = false) as inspection_count,
        COUNT(DISTINCT m.id) FILTER (WHERE m.is_deleted = false) as maintenance_count,
        COALESCE(SUM(m.amount) FILTER (WHERE m.is_deleted = false), 0) as total_maintenance_cost,
        MAX(i.created_at) FILTER (WHERE i.is_deleted = false) as last_inspection_at,
        MAX(m.created_at) FILTER (WHERE m.is_deleted = false) as last_maintenance_at
      FROM public.vehicles v
      LEFT JOIN public.inspections i ON v.id = i.vehicle_id
      LEFT JOIN public.maintenance m ON v.id = m.vehicle_id
      GROUP BY v.id, v.vehicle_code, v.plate_number, v.brand, v.model, v.is_active
    ';
  ELSE
    EXECUTE '
      CREATE VIEW public.vehicle_stats AS
      SELECT 
        v.id as vehicle_id,
        v.vehicle_code,
        NULL::text as plate_number,
        v.brand,
        v.model,
        v.is_active,
        COUNT(DISTINCT i.id) FILTER (WHERE i.is_deleted = false) as inspection_count,
        COUNT(DISTINCT m.id) FILTER (WHERE m.is_deleted = false) as maintenance_count,
        COALESCE(SUM(m.amount) FILTER (WHERE m.is_deleted = false), 0) as total_maintenance_cost,
        MAX(i.created_at) FILTER (WHERE i.is_deleted = false) as last_inspection_at,
        MAX(m.created_at) FILTER (WHERE m.is_deleted = false) as last_maintenance_at
      FROM public.vehicles v
      LEFT JOIN public.inspections i ON v.id = i.vehicle_id
      LEFT JOIN public.maintenance m ON v.id = m.vehicle_id
      GROUP BY v.id, v.vehicle_code, v.brand, v.model, v.is_active
    ';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Commit the transaction - all changes are atomic
COMMIT;

DO $$ 
BEGIN
  RAISE NOTICE 'QuickShift Migration Complete!';
  RAISE NOTICE 'Run the verification queries below to confirm.';
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (in case you need to undo - USE WITH CAUTION!)
-- ============================================================================

/*
-- WARNING: This will remove all improvements. Only use if you need to rollback.

-- Drop new indexes
DROP INDEX IF EXISTS vehicles_code_idx;
DROP INDEX IF EXISTS inspections_created_by_idx;
DROP INDEX IF EXISTS inspections_driver_idx;
DROP INDEX IF EXISTS inspections_remarks_gin_idx;
DROP INDEX IF EXISTS inspections_is_deleted_idx;
DROP INDEX IF EXISTS maintenance_bill_number_idx;
DROP INDEX IF EXISTS maintenance_created_by_idx;
DROP INDEX IF EXISTS maintenance_amount_idx;
DROP INDEX IF EXISTS maintenance_is_deleted_idx;

-- Drop triggers
DROP TRIGGER IF EXISTS inspections_set_updated_at ON public.inspections;
DROP TRIGGER IF EXISTS maintenance_set_updated_at ON public.maintenance;

-- Drop new columns (WARNING: This will delete data!)
ALTER TABLE public.inspections DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE public.maintenance DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.maintenance DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.maintenance DROP COLUMN IF EXISTS is_deleted;

-- Drop check constraints
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_code_length_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_brand_length_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_model_length_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_year_range_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_notes_length_check;
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_odometer_check;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_odometer_check;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_bill_number_length_check;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_supplier_name_length_check;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_amount_check;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_remarks_length_check;

-- Restore cascade foreign keys
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_vehicle_id_fkey;
ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_vehicle_id_fkey;
ALTER TABLE public.inspections ADD CONSTRAINT inspections_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance ADD CONSTRAINT maintenance_vehicle_id_fkey 
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
*/
