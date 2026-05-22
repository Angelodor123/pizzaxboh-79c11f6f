
-- Onboarding
CREATE TABLE public.page_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.page_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read onboarding" ON public.page_onboarding FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "admins write onboarding" ON public.page_onboarding FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role) WITH CHECK (current_user_role() = 'admin'::app_role);
CREATE TRIGGER trg_page_onboarding_updated BEFORE UPDATE ON public.page_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Measurement units
CREATE TABLE public.measurement_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read units" ON public.measurement_units FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "admins write units" ON public.measurement_units FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role) WITH CHECK (current_user_role() = 'admin'::app_role);

-- Prep items
CREATE TABLE public.prep_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  target_sun numeric NOT NULL DEFAULT 0,
  target_mon numeric NOT NULL DEFAULT 0,
  target_tue numeric NOT NULL DEFAULT 0,
  target_wed numeric NOT NULL DEFAULT 0,
  target_thu numeric NOT NULL DEFAULT 0,
  target_fri numeric NOT NULL DEFAULT 0,
  target_sat numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prep_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read prep items" ON public.prep_items FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "admins write prep items" ON public.prep_items FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role) WITH CHECK (current_user_role() = 'admin'::app_role);
CREATE TRIGGER trg_prep_items_updated BEFORE UPDATE ON public.prep_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prep_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_item_id uuid NOT NULL REFERENCES public.prep_items(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  current_stock numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prep_item_id, log_date)
);
ALTER TABLE public.prep_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read prep log" ON public.prep_log FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "roles write prep log" ON public.prep_log FOR ALL TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE TRIGGER trg_prep_log_updated BEFORE UPDATE ON public.prep_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Restock items
CREATE TABLE public.restock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  barcode text,
  target_sun numeric NOT NULL DEFAULT 0,
  target_mon numeric NOT NULL DEFAULT 0,
  target_tue numeric NOT NULL DEFAULT 0,
  target_wed numeric NOT NULL DEFAULT 0,
  target_thu numeric NOT NULL DEFAULT 0,
  target_fri numeric NOT NULL DEFAULT 0,
  target_sat numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_restock_items_barcode ON public.restock_items(barcode) WHERE barcode IS NOT NULL;
ALTER TABLE public.restock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read restock items" ON public.restock_items FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "admins write restock items" ON public.restock_items FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role) WITH CHECK (current_user_role() = 'admin'::app_role);
CREATE TRIGGER trg_restock_items_updated BEFORE UPDATE ON public.restock_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.restock_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restock_item_id uuid NOT NULL REFERENCES public.restock_items(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  current_stock numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restock_item_id, log_date)
);
ALTER TABLE public.restock_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read restock log" ON public.restock_log FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE POLICY "roles write restock log" ON public.restock_log FOR ALL TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));
CREATE TRIGGER trg_restock_log_updated BEFORE UPDATE ON public.restock_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed units
INSERT INTO public.measurement_units (name, sort_order) VALUES
  ('ק"ג', 1), ('גרם', 2), ('ליטר', 3), ('מ"ל', 4),
  ('יחידה', 5), ('קופסה', 6), ('פיילה', 7), ('שק', 8), ('ארגז', 9)
ON CONFLICT (name) DO NOTHING;

-- Seed onboarding
INSERT INTO public.page_onboarding (page_key, title, body) VALUES
  ('index', 'לוח בקרה תפעולי', 'דף הבית של המערכת. כאן רואים בסקירה אחת את כל מה שחשוב למשמרת: אירועי היום, הגעות סחורה למחר, מצב המשימות ומלאי הטעינה של הרכבים. השתמש בכפתורי הניווט כדי להגיע למודולים השונים.'),
  ('recipes', 'מתכונים', 'מאגר המתכונים של המטבח. בחר מתכון כדי לראות מרכיבים, הוראות, וטכניקות. ניתן להתאים אישית את הכמויות לפי גודל ההכנה הנדרש.'),
  ('calendar', 'יומן תפעולי', 'ניהול אירועים, הגעות סחורה ומשימות חוזרות. אדמין יכול להוסיף ולערוך אירועים; הצוות צופה לפי יום או שבוע.'),
  ('suppliers', 'ספקים', 'רשימת הספקים, ימי הגעת סחורה ופרטי קשר. עדכון פרטי ספק יסנכרן אוטומטית את היומן.'),
  ('notebook', 'מחברת מטבח', 'רשימות עבודה יומיות: משימות, קניות והזמנות. סמן פריט כבוצע כדי להוריד אותו מהרשימה; הרשימות נשמרות אוטומטית.'),
  ('guide', 'מדריך מטבח', 'מאגר ידע, נהלים והסברים. השתמש בחיפוש כדי למצוא נושא ספציפי.'),
  ('admin', 'ניהול מערכת', 'אזור אדמין בלבד: ניהול משתמשים, הרשאות, טקסטים, יחידות מידה, פריטי הכנות ופריטי השלמות.'),
  ('prep', 'הכנות יומיות', 'עמוד זה מיועד לניהול הכנות המטבח היומיות. המערכת מציגה את כמויות היעד הנדרשות להיום באופן אוטומטי. עליך לספור את המלאי הקיים במקרר, להזין אותו בשדה ''מלאי קיים'', והמערכת תחשב מיד כמה בדיוק נשאר לך להכין למשמרת.'),
  ('restock', 'השלמות מהמחסן', 'עמוד זה מיועד להשלמת חומרי גלם וציוד מהמחסן הגדול אל עמדות העבודה בפס. עליך להזין את המלאי הנוכחי שנמצא פיזית בעמדה, והמערכת תגיד לך בדיוק איזו כמות של סחורה עליך להביא מהמחסן כדי שלא יחסר דבר במהלך הסרוויס.')
ON CONFLICT (page_key) DO NOTHING;
