
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.notebook_items
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notebook_items_urgent_sort
  ON public.notebook_items (list_key, is_urgent DESC, text ASC)
  WHERE archived_at IS NULL;

-- Daily task log reset: drop rows older than today's operational date at 05:00 Asia/Jerusalem
CREATE OR REPLACE FUNCTION public.daily_task_logs_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.daily_task_logs
  WHERE log_date < public.operational_today();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.daily_task_logs_reset() FROM anon, authenticated;

-- Schedule via pg_cron at 05:00 Asia/Jerusalem (02:00 UTC during standard time / 03:00 UTC DST — schedule at 02:00 UTC; trigger uses operational_today which already shifts by 5h)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-task-logs-reset')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-task-logs-reset');
    PERFORM cron.schedule(
      'daily-task-logs-reset',
      '0 2 * * *',
      $cron$SELECT public.daily_task_logs_reset();$cron$
    );
  END IF;
END$$;
