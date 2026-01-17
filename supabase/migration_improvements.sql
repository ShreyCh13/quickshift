-- Migration script to add improvements to existing QuickShift database
-- Run this on your existing database to apply all performance and data integrity improvements
-- WARNING: This will modify your schema. Backup your data first!

-- ============================================================================
-- STEP 1: Add new columns to existing tables
-- ============================================================================

-- Add updated_at and is_deleted to inspections
ALTER TABLE public.inspections 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Add updated_at and is_deleted to maintenance
ALTER TABLE public.maintenance 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

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

-- ============================================================================
-- STEP 5: Add triggers for updated_at
-- ============================================================================

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
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if all indexes were created
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('vehicles', 'inspections', 'maintenance')
ORDER BY tablename, indexname;

-- Check if all constraints were added
SELECT 
  con.conname AS constraint_name,
  rel.relname AS table_name,
  con.contype AS constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('vehicles', 'inspections', 'maintenance')
ORDER BY rel.relname, con.conname;

-- Check if new columns exist
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('vehicles', 'inspections', 'maintenance')
  AND column_name IN ('updated_at', 'updated_by', 'is_deleted')
ORDER BY table_name, column_name;

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
