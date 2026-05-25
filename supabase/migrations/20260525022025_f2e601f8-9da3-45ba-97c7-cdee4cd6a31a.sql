-- Step 1: add super_admin value to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
