ALTER TABLE public.calendar_event_overrides
ADD COLUMN IF NOT EXISTS order_verification_status text NOT NULL DEFAULT 'pending'
  CHECK (order_verification_status IN ('pending','ordered','skipped'));