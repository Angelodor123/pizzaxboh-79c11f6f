
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ingredient_name text,
  ADD COLUMN IF NOT EXISTS is_purchased_good boolean NOT NULL DEFAULT false;

ALTER TABLE public.prep_items
  ADD COLUMN IF NOT EXISTS ingredient_name text,
  ADD COLUMN IF NOT EXISTS is_purchased_good boolean NOT NULL DEFAULT false;
