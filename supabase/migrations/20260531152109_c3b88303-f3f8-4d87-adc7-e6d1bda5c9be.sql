ALTER TABLE public.daily_task_logs
  ADD COLUMN IF NOT EXISTS admin_verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.daily_task_logs
  DROP CONSTRAINT IF EXISTS daily_task_logs_admin_verification_status_check;

ALTER TABLE public.daily_task_logs
  ADD CONSTRAINT daily_task_logs_admin_verification_status_check
  CHECK (admin_verification_status IN ('none','verified','rejected'));