-- 1) profiles (NDA acceptance)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY,
  has_accepted_nda BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) EV vehicles
CREATE TABLE IF NOT EXISTS public.ev_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  battery_pct INTEGER NOT NULL DEFAULT 100 CHECK (battery_pct BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'ממתין',
  swap_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ev_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authed with role can read ev" ON public.ev_vehicles;
CREATE POLICY "Authed with role can read ev" ON public.ev_vehicles FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin'::public.app_role,'viewer'::public.app_role));
DROP POLICY IF EXISTS "Authed with role can update ev" ON public.ev_vehicles;
CREATE POLICY "Authed with role can update ev" ON public.ev_vehicles FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin'::public.app_role,'viewer'::public.app_role))
  WITH CHECK (public.current_user_role() IN ('admin'::public.app_role,'viewer'::public.app_role));
DROP POLICY IF EXISTS "Admins insert ev" ON public.ev_vehicles;
CREATE POLICY "Admins insert ev" ON public.ev_vehicles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin'::public.app_role);
DROP POLICY IF EXISTS "Admins delete ev" ON public.ev_vehicles;
CREATE POLICY "Admins delete ev" ON public.ev_vehicles FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin'::public.app_role);
DROP TRIGGER IF EXISTS set_ev_vehicles_updated_at ON public.ev_vehicles;
CREATE TRIGGER set_ev_vehicles_updated_at BEFORE UPDATE ON public.ev_vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ev_vehicles (name, sort_order) VALUES
  ('BYD', 10), ('Leapmotor', 20), ('Hyundai Kona', 30)
ON CONFLICT (name) DO NOTHING;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ev_vehicles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Notebook priority + archive
ALTER TABLE public.notebook_items ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.notebook_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS notebook_items_archived_at_idx ON public.notebook_items (archived_at);

-- 4) Notebook snapshots (14-day history)
CREATE TABLE IF NOT EXISTS public.notebook_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  list_key TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, list_key)
);
ALTER TABLE public.notebook_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authed with role can read snapshots" ON public.notebook_snapshots;
CREATE POLICY "Authed with role can read snapshots" ON public.notebook_snapshots FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin'::public.app_role,'viewer'::public.app_role));

-- 5) Daily 05:00 IL auto-reset function
CREATE OR REPLACE FUNCTION public.notebook_daily_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  snap_date DATE := (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '1 day';
BEGIN
  INSERT INTO public.notebook_snapshots (snapshot_date, list_key, items)
  SELECT snap_date::date, list_key, jsonb_agg(jsonb_build_object(
    'id', id, 'text', text, 'done', done, 'priority', priority, 'created_at', created_at
  ) ORDER BY created_at)
  FROM public.notebook_items
  WHERE archived_at IS NULL
  GROUP BY list_key
  ON CONFLICT (snapshot_date, list_key) DO UPDATE SET items = EXCLUDED.items;

  UPDATE public.notebook_items SET archived_at = now() WHERE archived_at IS NULL;

  DELETE FROM public.notebook_snapshots WHERE snapshot_date < (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '14 days';
END;
$func$;
REVOKE EXECUTE ON FUNCTION public.notebook_daily_reset() FROM PUBLIC;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('notebook-daily-reset');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('notebook-daily-reset', '0 2 * * *', $cron$SELECT public.notebook_daily_reset();$cron$);

-- 6) Wipe + reseed recipes
UPDATE public.recipes SET deleted = true WHERE id NOT LIKE 'seed-%';
DELETE FROM public.recipes WHERE id LIKE 'seed-%';

INSERT INTO public.recipes (id, category, name_hebrew, base_yield_hebrew, instructions_hebrew, ingredients, sort_order) VALUES
('seed-001','desserts','נוצ׳ולה קלאסית','','פותחים בצק שלם, משטיחים את הקראסט שיהיה דק מאוד, מזלפים את הנוטלה עד גובה 60% מהבצק מבלי לפספס את הפינות, שמים 8 צ׳אנקים של מסקרפונה מפוזרים על הנוטלה.','[{"name": "נוטלה", "quantity": 160, "unit": "גרם"}, {"name": "גבינת מסקרפונה", "quantity": 40, "unit": "גרם"}]'::jsonb,10),
('seed-002','desserts','נוצ׳ולה מוי בוואן','','פותחים בצק שלם, משטיחים את הקראסט שיהיה דק מאוד, מזלפים את הקינדר עד גובה 60% מהבצק מבלי לפספס את הפינות. לאחר אפייה מזלפים בפסים את השוקולד לבן וקרמל','[{"name": "קרם קינדר", "quantity": 150, "unit": "גרם"}, {"name": "זילוף קרמל", "quantity": 1, "unit": "לפי טעם"}, {"name": "זילוף שוקולד לבן", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,20),
('seed-003','desserts','נוצ׳ולה תות לבן','','פותחים בצק שלם, משטיחים את הקראסט שיהיה דק מאוד, מזלפים את השוקולד לבן עד גובה 60% מהבצק מבלי לפספס את הפינות לאחר אפייה מזלפים בפסים את הקרם תות','[{"name": "שוקולד לבן", "quantity": 150, "unit": "גרם"}, {"name": "זילוף תות לבן", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,30),
('seed-004','desserts','נוצ׳ולה פיסטוק','','פותחים בצק שלם, משטיחים את הקראסט שיהיה דק מאוד, מזלפים את הפיסטוק עד גובה 60% מהבצק מבלי לפספס את הפינות לאחר אפייה מזלפים בפסים את קרם השוקולד לבן','[{"name": "פיסטוק", "quantity": 160, "unit": "גרם"}, {"name": "זילוף שוקולד לבן", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,40),
('seed-005','desserts','נוצ׳ולה בננות קרמל','','פותחים בצק שלם, משטיחים את הקראסט שיהיה דק מאוד, מזלפים את הנוטלה עד גובה 60% מהבצק מבלי לפספס את הפינות, מפרקים את הבננה מעל לאחר אפייה מזלפים בפסים את הקרמל','[{"name": "נוטלה", "quantity": 160, "unit": "גרם"}, {"name": "בננות", "quantity": 50, "unit": "גרם"}, {"name": "זילוף קרמל", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,50),
('seed-006','desserts','הר סופגניות אוראו','','פותחים 75% בצק עד קוטר של כ 20 ס"מ, חותכים את הבצק ל-8 חתיכות שוות, שמים יחידת אוראו על כל חתיכת בצק וסוגרים בציפסר עד שמושחם. כשמייצרים סופגנייה לוודא שאין שכבות על גבי שכבות (כדי שלא יהיה בצק חי באמצע) ואם יש אז ללחוץ עליו. מעבירים ל-2 קערות פסטה, שמים קרמל, לבן ונוטלה.','[{"name": "1 בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "8 עוגיות אוראו", "quantity": 1, "unit": "לפי טעם"}, {"name": "זילוף קרמל מלוח", "quantity": 1, "unit": "לפי טעם"}, {"name": "זילוף שוקולד לבן", "quantity": 1, "unit": "לפי טעם"}, {"name": "זילוף נוטלה", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,60),
('seed-007','desserts','סכרת','','חותכים בצק ל-2, חותכים אותו ל-4-5 אצבעות, חותכים את האצבעות לעיגולים קטנים ומעבירים לטיגון על 200. לאחר טיגון מפזרים מעל סוכר, מעבירים לקערת פסטה, ושמים מעל 2 רטבים לבחירת הלקוח. את החצי בצק הנותר מכסים בקופסה כדי שלא יתייבש במגע עם האוויר.','[{"name": "חצי כדור בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "2 רטבים לבחירה", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,70),
('seed-008','starters','לחם שום משפחתי','','פותחים את הבצק כמו מלבן, רצים עם הסקוויזר שום על כל הפינות ואז ממלאים את הרוחב בפסים.','[{"name": "1 בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "רוטב שום קונפי", "quantity": 40, "unit": "גרם"}, {"name": "מוצרלה", "quantity": 50, "unit": "גרם"}, {"name": "1 דיפ עגבניות", "quantity": 1, "unit": "לפי טעם"}, {"name": "1 דיפ איולי נענע", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,80),
('seed-009','starters','אצבעות עם ים גבינה','','','[{"name": "1 בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "מוצרלה", "quantity": 120, "unit": "גרם"}, {"name": "1 דיפ עגבניות", "quantity": 1, "unit": "לפי טעם"}, {"name": "1 דיפ איולי נענע", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,90),
('seed-010','starters','פוקאצ׳ה X','','','[{"name": "שמן זית", "quantity": 1, "unit": "לפי טעם"}, {"name": "בולגרית", "quantity": 40, "unit": "גרם"}, {"name": "ארטישוק", "quantity": 40, "unit": "גרם"}, {"name": "עגבניות שרי", "quantity": 40, "unit": "גרם"}, {"name": "דיפ עגבניות", "quantity": 1, "unit": "לפי טעם"}, {"name": "דיפ איולי נענע", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,100),
('seed-011','starters','מיקס גבינה ושום','','פותחים את הבצק כמו מלבן, רצים עם הסקוויזר שום על כל הפינות ואז ממלאים את הרוחב בפסים.','[{"name": "1 בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "רוטב שום קונפי", "quantity": 40, "unit": "גרם"}, {"name": "מוצרלה", "quantity": 130, "unit": "גרם"}, {"name": "דיפ עגבניות", "quantity": 1, "unit": "לפי טעם"}, {"name": "דיפ איולי נענע", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,110),
('seed-012','starters','אצבעות מוצרלה מטוגנות','','מטגנים את האצבעות עד שהגבינה נמסה. לאחר אריזה מפזרים פרמזן מעל.','[{"name": "6 אצבעות מוצרלה", "quantity": 1, "unit": "לפי טעם"}, {"name": "דיפ עגבניות", "quantity": 1, "unit": "לפי טעם"}, {"name": "דיפ איולי נענע", "quantity": 1, "unit": "לפי טעם"}, {"name": "פרמזן", "quantity": 10, "unit": "גרם"}]'::jsonb,120),
('seed-013','starters','ארנצ''יני','','מטגנים את הכדורים על 170 מעלות למשך 5.5 דקות. במחבת מבשלים את הרוטב לצמצום. רוטב עובר לצלחת, 3 כדורים מעל, 3 עלי בזיליקום והפרמזן לסגירה.','[{"name": "3 יחידות כדורי ארנצ''יני", "quantity": 1, "unit": "לפי טעם"}, {"name": "כף עגבניות גדולה", "quantity": 1, "unit": "לפי טעם"}, {"name": "כף שמנת קטנה", "quantity": 1, "unit": "לפי טעם"}, {"name": "פרמזן", "quantity": 20, "unit": "גרם"}]'::jsonb,130),
('seed-014','starters','כרובית','','מטגנים את הכרובית, הגזע למטה הפרח למעלה, 6 דקות על 160. חשוב מאוד לוודא שהכל התרכך! אם יש גזעים עבים לחתוך באמצע לאורך הגזע בבול. מערבבים את הכרובית עם הרוטב, גרמולטה על צלחת, לערבב עם המיץ לימון, מעל הכרובית, עם לקקן להוריד את כל הרוטב.','[{"name": "כרובית", "quantity": 450, "unit": "גרם"}, {"name": "רוטב", "quantity": 60, "unit": "גרם"}, {"name": "כפית גרמולטה גדושה בלי מיץ לימון (14 גרם)", "quantity": 1, "unit": "לפי טעם"}, {"name": "כפית וחצי מיץ לימון (14 גרם)", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,140),
('seed-015','starters','פולנטה כמהין','','במחבת מבשלים את הפולנטה עד להסמכה. במחבת אחרת מטגנים את הפטריות עם השמן זית וקורט של מלח, בסוף הטיגון מוסיפים ערמונים לבישול קטן של כ-20 שניות ומעבירים הכל ביחד בצלחת מעל לפולנטה. בצלחות מוסיפים את שמן הכמהין והפרמזן.','[{"name": "פולנטה רכה", "quantity": 300, "unit": "גרם"}, {"name": "פטריות", "quantity": 50, "unit": "גרם"}, {"name": "שמן זית", "quantity": 10, "unit": "גרם"}, {"name": "שמן כמהין", "quantity": 8, "unit": "גרם"}, {"name": "ערמונים", "quantity": 30, "unit": "גרם"}, {"name": "פרמזן", "quantity": 15, "unit": "גרם"}]'::jsonb,150),
('seed-016','starters','בצקקממבר','','חותכים בצק ל-2, חותכים את הפינות שיהיה יותר עגול ופותחים חצי דרך. שום קונפי מעל הבצק, מדביקים את הקממבר לשום וסוגרים. לאחר אפייה שמים בסיס של רוקט, מעל הבצקקממבר: פרמזן ובלסמי, בצד הצלחת / קוקוט במשלוח ריבת שרי.','[{"name": "שליש בצק", "quantity": 1, "unit": "לפי טעם"}, {"name": "חצי קממבר", "quantity": 1, "unit": "לפי טעם"}, {"name": "שום קונפי", "quantity": 10, "unit": "גרם"}, {"name": "בלסמי מצומצם", "quantity": 8, "unit": "גרם"}, {"name": "פרמזן", "quantity": 8, "unit": "גרם"}, {"name": "ריבת עגבניות שרי", "quantity": 15, "unit": "גרם"}, {"name": "חופן רוקט", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,160),
('seed-017','pastas','פומודורו','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות עגבניות של 170 מ\"ל / 150 גרם", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,170),
('seed-018','pastas','ביאנקה','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת כמעט מלאות (90% כף)", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,180),
('seed-019','pastas','רוזה','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "כף עגבניות גדושה", "quantity": 1, "unit": "לפי טעם"}, {"name": "80% כף שמנת", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,190),
('seed-020','pastas','אלפרדו','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת (90%)", "quantity": 1, "unit": "לפי טעם"}, {"name": "פטריות (חופן)", "quantity": 40, "unit": "גרם"}]'::jsonb,200),
('seed-021','pastas','רוטב X','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת (90%)", "quantity": 1, "unit": "לפי טעם"}, {"name": "פטריות", "quantity": 40, "unit": "גרם"}, {"name": "ריבת בצל", "quantity": 30, "unit": "גרם"}, {"name": "ארטישוק", "quantity": 30, "unit": "גרם"}]'::jsonb,210),
('seed-022','pastas','לא רק פסטו','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "כף ורבע שמנת", "quantity": 1, "unit": "לפי טעם"}, {"name": "פסטו", "quantity": 50, "unit": "גרם"}, {"name": "שרי", "quantity": 40, "unit": "גרם"}]'::jsonb,220),
('seed-023','pastas','כמהין','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת (90%)", "quantity": 1, "unit": "לפי טעם"}, {"name": "פטריות", "quantity": 50, "unit": "גרם"}, {"name": "כמהין", "quantity": 25, "unit": "גרם"}]'::jsonb,230),
('seed-024','pastas','הבייקון המשוגע','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת (90%)", "quantity": 1, "unit": "לפי טעם"}, {"name": "ריבת בייקון", "quantity": 40, "unit": "גרם"}]'::jsonb,240),
('seed-025','pastas','אלי אוליו','','מקפיצים הכל חוץ מהפסטו עד שמתרכך בטמפרטורה 120 מעלות. כשהפסטה נכנסת נותנים חימום אחרון יחד עם הפסטו.','[{"name": "שמן זית", "quantity": 40, "unit": "גרם"}, {"name": "שרי", "quantity": 40, "unit": "גרם"}, {"name": "ארטישוק", "quantity": 40, "unit": "גרם"}, {"name": "פסטו", "quantity": 50, "unit": "גרם"}]'::jsonb,250),
('seed-026','pastas','ערמוניה','','מידע פסטה: פפרדלה — 180 גרם, רביולי 4 גבינות — 180 גרם, קפלצי — 12 יחידות, ניוקי — 250 גרם.','[{"name": "2 כפות שמנת (90%)", "quantity": 1, "unit": "לפי טעם"}, {"name": "ערמונים", "quantity": 30, "unit": "גרם"}, {"name": "פטריות", "quantity": 40, "unit": "גרם"}]'::jsonb,260),
('seed-027','salads','סלט קיסר','','מפרקים את כל העלים מהחסה, בוצעים את העלים הגדולים באמצע. מערבבים בבול את כל החסה עם כל הקרוטונים, כל רוטב הקיסר וחצי מהפרמזן, מערבבים ובצלחת מוסיפים בסגירה את החצי השני של הפרמזן. סה"כ 310 גרם.','[{"name": "חסה", "quantity": 180, "unit": "גרם"}, {"name": "רוטב קיסר", "quantity": 70, "unit": "גרם"}, {"name": "קרוטונים", "quantity": 40, "unit": "גרם"}, {"name": "פרמזן", "quantity": 10, "unit": "גרם"}, {"name": "סגירה: 10 גרם פרמזן", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,270),
('seed-028','salads','סלט קפרזה','','מערבבים בבול את השרי עם מלח ופסטו, מעבירים לצלחת, מפרקים מעל את הפרסקה, מזלפים מעל מעט פסטו, את הבלסמי, שמן זית וכ-4-5 עלי בזיליקום יפים.','[{"name": "שרי", "quantity": 250, "unit": "גרם"}, {"name": "פסטו", "quantity": 30, "unit": "גרם"}, {"name": "1.5 כדור מוצרלה פרסקה", "quantity": 1, "unit": "לפי טעם"}, {"name": "קורט מלח", "quantity": 1, "unit": "לפי טעם"}, {"name": "סגירה: 10 גרם שמן זית, 10 גרם פסטו, 15 גרם בלסמי, 4-5 עלי בזיליקום", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,280),
('seed-029','salads','סלט פנצנלה','','מערבבים בבול את השרי, קלמטה, מהפרמזן, מהבלסמי וכ-10-15 עלי בזיליקום עם השמן זית. מוסיפים בסגירה את הבלסמי ופרמזן שנשארו.','[{"name": "שרי", "quantity": 250, "unit": "גרם"}, {"name": "10-15 עלי בזיליקום", "quantity": 1, "unit": "לפי טעם"}, {"name": "זיתי קלמטה", "quantity": 35, "unit": "גרם"}, {"name": "בלסמי", "quantity": 20, "unit": "גרם"}, {"name": "קרוטונים", "quantity": 40, "unit": "גרם"}, {"name": "פרמזן", "quantity": 20, "unit": "גרם"}, {"name": "שמן זית", "quantity": 10, "unit": "גרם"}, {"name": "קורט מלח", "quantity": 1, "unit": "לפי טעם"}, {"name": "סגירה: 10 גרם בלסמי, 10 גרם פרמזן", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,290),
('seed-030','salads','סלט איקס','','מערבבים בבול את השרי, חסה, ארטישוק ופסטו, מצלחתים וסוגרים עם בולגרית ופסטו. סה"כ 430 גרם.','[{"name": "חסה", "quantity": 120, "unit": "גרם"}, {"name": "שרי", "quantity": 150, "unit": "גרם"}, {"name": "ארטישוק", "quantity": 50, "unit": "גרם"}, {"name": "פסטו", "quantity": 40, "unit": "גרם"}, {"name": "שמן זית", "quantity": 10, "unit": "גרם"}, {"name": "קורט מלח", "quantity": 1, "unit": "לפי טעם"}, {"name": "סגירה: 50 גרם בולגרית, 10 גרם פסטו", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,300),
('seed-031','salads','סלט צוות רוקט','','מערבבים בבול את הרוקט, שרי, ריבת שרי וארטישוק עם שמן זית, מעבירים לצלחת ושמים מעל צ''אנקים של הגורגונזולה. סה"כ 405 גרם.','[{"name": "רוקט", "quantity": 70, "unit": "גרם"}, {"name": "שרי", "quantity": 200, "unit": "גרם"}, {"name": "ארטישוק", "quantity": 50, "unit": "גרם"}, {"name": "ריבת שרי", "quantity": 50, "unit": "גרם"}, {"name": "שמן זית", "quantity": 10, "unit": "גרם"}, {"name": "קורט מלח", "quantity": 1, "unit": "לפי טעם"}, {"name": "סגירה: 25 גרם גבינה כחולה", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,310),
('seed-032','salads','סלט בהרכבה','','מלפפון קוצצים דק, גבינות סגירה בסוף. את כל המרכיבים שמים בקערה, מערבבים ומגישים.','[{"name": "450-500 גרם סך הכל לכל המרכיבים בסלט", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,320),
('seed-033','authentic_pastas','קאצו אה פפה','','מחבת על 80-100 מעלות לפתיחה של הרוטב. לאחר שמוסיפים את הפפרדלה מצמצמים עד שהרוטב מחבק את הפסטה.','[{"name": "קרם קאצו אה פפה", "quantity": 170, "unit": "גרם"}]'::jsonb,330),
('seed-034','authentic_pastas','קרבונרה','','פתיחה של הרוטב על 100 מעלות צמצום עד שמחבק. מכבים את האש ומוסיפים 2 חלמונים, החום האגור יסיים את החלמון, ובמידה ואין מספיק חום אגור אז עוד 5-10 שניות על 100 מעלות עם החלמון. סגירה עם נגיעת פרמג''נו.','[{"name": "קאצו אה פפה", "quantity": 130, "unit": "גרם"}, {"name": "שקית 40 גרם בייקון בסגנון גוואנצ''לה", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,340),
('seed-035','authentic_pastas','אמאטריציאנה','','צמצום של הרוטב, הוספה של הפפרדלה, חיבוק של הרוטב, הוספה של 30 גרם פקורינו, ערבוב עד קרם. להוסיף מי פסטה אם אין חיבור מספיק טוב. סגירה עם נגיעת פרמג''נו.','[{"name": "כף וחצי סן מרזנו", "quantity": 1, "unit": "לפי טעם"}, {"name": "שקית 40 גרם בייקון בסגנון גוואנצ''לה", "quantity": 1, "unit": "לפי טעם"}, {"name": "נגיעה צ''ילי גרוס", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,350),
('seed-036','authentic_pastas','ארביאטה','','זהה לאמאטריציאנה, ללא גוואנצ''לה ועם יותר צ''ילי גרוס. סגירה עם פרמג''נו.','[{"name": "כף וחצי סן מרזנו", "quantity": 1, "unit": "לפי טעם"}, {"name": "נגיעה גדולה צ''ילי גרוס", "quantity": 1, "unit": "לפי טעם"}]'::jsonb,360)
ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, name_hebrew=EXCLUDED.name_hebrew, instructions_hebrew=EXCLUDED.instructions_hebrew, ingredients=EXCLUDED.ingredients, sort_order=EXCLUDED.sort_order, deleted=false;