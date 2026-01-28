-- Migration to add is_deleted column if it doesn't exist
-- Run this in your Supabase SQL editor if records aren't showing up

-- Add is_deleted to inspections if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inspections' 
    AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE public.inspections ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS inspections_is_deleted_idx ON public.inspections (is_deleted) WHERE is_deleted = false;
  END IF;
END $$;

-- Add is_deleted to maintenance if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'maintenance' 
    AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE public.maintenance ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS maintenance_is_deleted_idx ON public.maintenance (is_deleted) WHERE is_deleted = false;
  END IF;
END $$;

-- Update any NULL values to false (in case column was added without default)
UPDATE public.inspections SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE public.maintenance SET is_deleted = false WHERE is_deleted IS NULL;
