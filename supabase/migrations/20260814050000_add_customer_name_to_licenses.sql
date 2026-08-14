-- Add customer_name column to licenses table if it doesn't exist
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT NULL;

-- Reload PostgREST schema cache so the new column is immediately available
NOTIFY pgrst, 'reload schema';
