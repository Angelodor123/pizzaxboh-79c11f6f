
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions select"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Trigger function: fires after dough trays update; calls hook if below threshold
CREATE OR REPLACE FUNCTION public.notify_dough_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_threshold int;
  v_setting jsonb;
  v_hook_url text;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'dough_alert_threshold';
  v_threshold := COALESCE((v_setting->>'value')::int, 15);

  IF NEW.trays_count < v_threshold THEN
    v_hook_url := 'https://project--0e28faf3-94b6-4399-9ba2-e9d1ba3d3774.lovable.app/api/public/hooks/dough-alert';
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dough_threshold_alert ON public.dough_updates_log;
CREATE TRIGGER trg_dough_threshold_alert
  AFTER INSERT ON public.dough_updates_log
  FOR EACH ROW EXECUTE FUNCTION public.notify_dough_threshold();

REVOKE EXECUTE ON FUNCTION public.notify_dough_threshold() FROM anon, authenticated;
