ALTER TABLE public.dough_updates_log
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'shop';

ALTER TABLE public.dough_updates_log
  DROP CONSTRAINT IF EXISTS dough_updates_log_location_check;

ALTER TABLE public.dough_updates_log
  ADD CONSTRAINT dough_updates_log_location_check
  CHECK (location IN ('shop','warehouse'));

CREATE INDEX IF NOT EXISTS idx_dough_log_branch_item_loc_created
  ON public.dough_updates_log (branch_id, prep_item_id, location, created_at DESC);