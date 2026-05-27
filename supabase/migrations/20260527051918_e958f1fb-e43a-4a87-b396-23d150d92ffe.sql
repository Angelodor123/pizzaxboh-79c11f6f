CREATE OR REPLACE FUNCTION public.operational_day_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT ((public.operational_today()::timestamp + INTERVAL '5 hours') AT TIME ZONE 'Asia/Jerusalem')
$$;

GRANT EXECUTE ON FUNCTION public.operational_day_start() TO anon, authenticated, service_role;