-- Internal cron helpers: revoke EXECUTE from public/anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.rollover_daily_operations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notebook_daily_reset()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.daily_task_logs_reset()       FROM PUBLIC, anon, authenticated;
