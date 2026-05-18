
-- app_settings: flexible key/value config
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed with role can read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins insert settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete settings"
ON public.app_settings FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- site_texts: CMS for editable copy
CREATE TABLE public.site_texts (
  key text PRIMARY KEY,
  group_key text NOT NULL DEFAULT 'general',
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed with role can read texts"
ON public.site_texts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins insert texts"
ON public.site_texts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update texts"
ON public.site_texts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete texts"
ON public.site_texts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER site_texts_updated_at
BEFORE UPDATE ON public.site_texts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial editable texts (idempotent)
INSERT INTO public.site_texts (key, group_key, label, value) VALUES
  ('home.title', 'home', 'כותרת ראשית – דף הבית', 'ברוכים הבאים למרכז השליטה של Pizza X'),
  ('home.subtitle', 'home', 'תיאור – דף הבית', 'מרכז הבקרה התפעולי של המטבח. הנה תמונת מצב יומית מהירה לכל מה שקורה היום במטבח.'),
  ('home.weather_title', 'home', 'כותרת — מזג אוויר', 'מזג אוויר — מודיעין'),
  ('home.rain_alert', 'home', 'התרעת גשם', '⚠️ צפי לגשם, אין לפתוח שולחנות וכיסאות בחוץ'),
  ('notebook.title', 'notebook', 'כותרת – פנקס יומי', 'פנקס עבודה יומי'),
  ('general.footer_credit', 'general', 'קרדיט בתחתית האתר', '© 2026 נבנה על ידי דור ברקת')
ON CONFLICT (key) DO NOTHING;
