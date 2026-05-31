CREATE OR REPLACE FUNCTION public.notify_dough_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_threshold int;
  v_setting jsonb;
  v_hook_url text;
BEGIN
  -- Only the in-store ("shop") count drives the low-dough alert.
  -- Southern freezer/fridge are storage buffers and should not fire alerts,
  -- and inserts for those locations must never be aborted by HTTP errors here.
  IF NEW.location IS DISTINCT FROM 'shop' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'dough_alert_threshold';
  v_threshold := COALESCE((v_setting->>'value')::int, 15);

  IF NEW.trays_count < v_threshold THEN
    v_hook_url := 'https://project--0e28faf3-94b6-4399-9ba2-e9d1ba3d3774.lovable.app/api/public/hooks/dough-alert';
    BEGIN
      PERFORM extensions.net.http_post(
        url := v_hook_url,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'trays_count', NEW.trays_count,
          'threshold', v_threshold,
          'branch_id', NEW.branch_id,
          'updated_by_name', NEW.updated_by_name
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never block the insert because of a notification failure.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;