
-- Supplier ordering schedule fields
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS order_days smallint[] NOT NULL DEFAULT '{}'::smallint[],
  ADD COLUMN IF NOT EXISTS order_cutoff_time time without time zone,
  ADD COLUMN IF NOT EXISTS delivery_days smallint[] NOT NULL DEFAULT '{}'::smallint[];

-- Backfill delivery_days from existing delivery_weekdays for continuity
UPDATE public.suppliers
SET delivery_days = delivery_weekdays
WHERE delivery_days = '{}'::smallint[] AND delivery_weekdays IS NOT NULL;

-- Expected items checklist on calendar delivery events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS expected_items jsonb NOT NULL DEFAULT '[]'::jsonb;
