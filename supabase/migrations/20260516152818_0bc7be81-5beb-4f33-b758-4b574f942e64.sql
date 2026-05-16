-- Recipes table (shared across all users)
CREATE TABLE public.recipes (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name_hebrew TEXT NOT NULL,
  base_yield_hebrew TEXT NOT NULL DEFAULT '',
  essence_hebrew TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  spice_bag JSONB,
  instructions_hebrew TEXT NOT NULL DEFAULT '',
  timer_seconds INTEGER,
  texture_target_hebrew TEXT,
  technique_notes_hebrew TEXT,
  deleted BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- All authenticated users with a role (admin or viewer) can read
CREATE POLICY "Authenticated users with role can read recipes"
ON public.recipes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'viewer'::app_role)
);

-- Only admins can write
CREATE POLICY "Admins can insert recipes"
ON public.recipes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update recipes"
ON public.recipes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete recipes"
ON public.recipes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recipes_set_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.recipes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;

-- Seed 24 base recipes
INSERT INTO public.recipes (id, category, name_hebrew, base_yield_hebrew, ingredients, spice_bag, instructions_hebrew, timer_seconds, texture_target_hebrew, technique_notes_hebrew, sort_order) VALUES
('classic-tomato','sauces_bases','רוטב עגבניות קלאסי','קופסה אחת (4 פחיות)',
 '[{"name":"עגבניות PELATI (1 ק\"ג כל אחת)","quantity":4,"unit":"פחיות"},{"name":"בזיליקום טרי","quantity":1,"unit":"חופן"}]'::jsonb,
 '{"name":"שקית תבלינים לרוטב עגבניות","totalWeightGrams":480,"items":[{"name":"סוכר","quantity":200,"unit":"גרם"},{"name":"מלח","quantity":160,"unit":"גרם"},{"name":"שום גבישי","quantity":120,"unit":"גרם"}]}'::jsonb,
 'פורקים את הפחיות לפיילה גדולה, מוסיפים את שקית התבלינים והבזיליקום. טוחנים עם בלנדר מוט גדול למשך 2.5 דקות בדיוק.',
 150, NULL, NULL, 10),
('cream-sauce','sauces_bases','רוטב שמנת','בקבוק 5 ליטר',
 '[{"name":"שמנת לבישול ''פקק צהוב''","quantity":5,"unit":"ליטר"}]'::jsonb,
 '{"name":"שקית תבלינים לרוטב שמנת","totalWeightGrams":620,"items":[{"name":"מלח","quantity":300,"unit":"גרם"},{"name":"פלפל שחור","quantity":120,"unit":"גרם"},{"name":"אגוז מוסקט","quantity":200,"unit":"גרם"}]}'::jsonb,
 'מערבבים את השמנת עם שקית התבלינים בבלנדר ידני עד הומוגניות. שומרים מצוננים בבקבוק 5 ליטר.',
 NULL, NULL, NULL, 20),
('san-marzano','sauces_bases','רוטב עגבניות סן מרזנו','קופסה אחת (4 פחיות)',
 '[{"name":"עגבניות סן מרזנו","quantity":4,"unit":"פחיות"},{"name":"בזיליקום טרי","quantity":1,"unit":"חופן"}]'::jsonb,
 NULL,
 'טחינה קצרה ועדינה של 30 שניות לפירוק גושים בלבד — חשוב לשמור על המרקם של העגבניות.',
 30, NULL, NULL, 30),
('rose-sauce','sauces_bases','רוטב רוז','לפי הזמנה',
 '[{"name":"רוטב עגבניות קלאסי","quantity":1,"unit":"חלקים"},{"name":"רוטב שמנת","quantity":1,"unit":"חלקים"}]'::jsonb,
 NULL,
 'מערבבים יחס 1:1 של רוטב עגבניות ורוטב שמנת. מוודאים אחידות לפני הגשה.',
 NULL, NULL, NULL, 40),
('aioli-garlic-confit','aiolis_sauces','איולי שום קונפי','1 ק"ג',
 '[{"name":"מיונז","quantity":800,"unit":"גרם"},{"name":"שום קונפי","quantity":200,"unit":"גרם"}]'::jsonb,
 NULL,
 'מערבבים מיונז ושום קונפי בבלנדר ידני עד הומוגניות מלאה.',
 NULL, 'אמולסיה חלקה', NULL, 110),
('aioli-mint','aiolis_sauces','איולי נענע','1 ק"ג',
 '[{"name":"מיונז","quantity":800,"unit":"גרם"},{"name":"עלי נענע טריים","quantity":80,"unit":"גרם"},{"name":"שמן זית","quantity":120,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'טוחנים את הנענע עם השמן בבלנדר. מוסיפים בזילוף איטי לתוך המיונז תוך ערבוב כדי לשמור על הצבע הירוק.',
 NULL, 'אמולסיה ירוקה', 'זילוף איטי שומר על הצבע', 120),
('aioli-chipotle','aiolis_sauces','איולי צ''יפוטלה','1 ק"ג',
 '[{"name":"מיונז","quantity":800,"unit":"גרם"},{"name":"צ''יפוטלה ברוטב אדובו","quantity":200,"unit":"גרם"}]'::jsonb,
 NULL,
 'טוחנים את הצ''יפוטלה לדק. מערבבים עם המיונז עד אחידות.',
 NULL, NULL, NULL, 130),
('aioli-pepperoni','aiolis_sauces','איולי פפרוני','1.5 ק"ג',
 '[{"name":"מיונז","quantity":1000,"unit":"גרם"},{"name":"שמן פפרוני","quantity":500,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מערבבים יחס 1:2 (שמן פפרוני : מיונז) עד קבלת אומאמי מרוכז. ערבוב ידני.',
 NULL, NULL, NULL, 140),
('aioli-mustard','aiolis_sauces','איולי חרדל','1 ק"ג',
 '[{"name":"מיונז","quantity":500,"unit":"גרם"},{"name":"חרדל חלק","quantity":500,"unit":"גרם"}]'::jsonb,
 NULL,
 'מערבבים יחס שווה של מיונז וחרדל חלק עד אחידות.',
 NULL, NULL, NULL, 150),
('pesto','aiolis_sauces','פסטו','1 ק"ג',
 '[{"name":"בזיליקום","quantity":300,"unit":"גרם"},{"name":"שמן זית","quantity":400,"unit":"מ\"ל"},{"name":"פרמזן","quantity":150,"unit":"גרם"},{"name":"שום קלוף","quantity":50,"unit":"גרם"},{"name":"צנוברים","quantity":100,"unit":"גרם"}]'::jsonb,
 NULL,
 'טוחנים את כל המרכיבים במעבד מזון. מוסיפים את שמן הזית בזילוף איטי לשמירה על הארומה והצבע.',
 NULL, NULL, 'שמן בזילוף איטי', 160),
('caesar-dressing','aiolis_sauces','רוטב סיזר','1.5 ליטר',
 '[{"name":"מיונז","quantity":1000,"unit":"גרם"},{"name":"אנשובי","quantity":80,"unit":"גרם"},{"name":"צלפים","quantity":80,"unit":"גרם"},{"name":"פרמזן","quantity":200,"unit":"גרם"},{"name":"מיץ לימון","quantity":100,"unit":"מ\"ל"},{"name":"חרדל","quantity":40,"unit":"גרם"}]'::jsonb,
 NULL,
 'טוחנים את האנשובי, צלפים, פרמזן, לימון וחרדל לאחידות. מקפלים פנימה את המיונז עד הומוגניות.',
 NULL, NULL, NULL, 170),
('jam-red-onion','jams_creams','ריבת בצל סגול','2 ק"ג',
 '[{"name":"בצל סגול חתוך","quantity":2500,"unit":"גרם"},{"name":"סוכר","quantity":500,"unit":"גרם"},{"name":"חומץ בלסמי","quantity":200,"unit":"מ\"ל"},{"name":"יין אדום","quantity":300,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מטגנים את הבצל על אש נמוכה עד שמתרכך (כ-20 דקות). מוסיפים סוכר, חומץ ויין. ממשיכים בבישול איטי כשעה עד מרקם ריבתי וצמיגי.',
 3600, 'מרקם ריבתי צמיג', 'בישול ארוך ואיטי — סבלנות נדרשת', 210),
('jam-bacon','jams_creams','ריבת בייקון','1.5 ק"ג',
 '[{"name":"בייקון קצוץ","quantity":1500,"unit":"גרם"},{"name":"בצל סגול חתוך","quantity":500,"unit":"גרם"},{"name":"סוכר חום","quantity":300,"unit":"גרם"},{"name":"דבש","quantity":200,"unit":"גרם"},{"name":"קפה שחור","quantity":150,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מטגנים את הבייקון עד פריך. מוסיפים בצל וממשיכים לטגן. מוסיפים סוכר, דבש וקפה ומבשלים על אש נמוכה כ-40 דקות.',
 2400, 'מרקם דחוס מתוק-מלוח', NULL, 220),
('jam-cherry','jams_creams','ריבת דובדבן','2 ק"ג',
 '[{"name":"דובדבנים מגולענים","quantity":2000,"unit":"גרם"},{"name":"סוכר","quantity":800,"unit":"גרם"},{"name":"מיץ לימון","quantity":80,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מבשלים את הדובדבנים עם הסוכר ולימון על אש בינונית כשעה, עד מרקם צמיג ומבריק.',
 3600, 'צמיג ומבריק', NULL, 230),
('jam-pepperoni','jams_creams','ריבת פפרוני','1.2 ק"ג',
 '[{"name":"פפרוני קצוץ דק","quantity":1000,"unit":"גרם"},{"name":"בצל סגול","quantity":300,"unit":"גרם"},{"name":"סוכר חום","quantity":250,"unit":"גרם"},{"name":"חומץ אדום","quantity":150,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מטגנים פפרוני ובצל עד שחרור שומן. מוסיפים סוכר וחומץ. מבשלים כ-30 דקות עד מרקם ריבתי חריף.',
 1800, 'מרקם ריבתי חריף', NULL, 240),
('garlic-confit-production','jams_creams','שום קונפי (ייצור)','3 ק"ג',
 '[{"name":"שום קלוף","quantity":3000,"unit":"גרם"},{"name":"שמן קנולה","quantity":3000,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מטמינים את השום בשמן בסיר עמוק. מבשלים על אש הנמוכה ביותר 2.5 שעות עד שהשום רך ומתפורר. מסננים ושומרים בשמן.',
 9000, 'רך ומתפורר', 'אסור לרתוח — חום נמוך בלבד', 250),
('cacio-e-pepe','jams_creams','קצ''יו אה פפה','1 ק"ג',
 '[{"name":"פקורינו רומנו","quantity":400,"unit":"גרם"},{"name":"חמאה","quantity":200,"unit":"גרם"},{"name":"שמנת","quantity":400,"unit":"מ\"ל"},{"name":"פלפל שחור גרוס","quantity":40,"unit":"גרם"},{"name":"קסנתן","quantity":4,"unit":"גרם"}]'::jsonb,
 NULL,
 'ממיסים חמאה עם שמנת. מוסיפים פקורינו ופלפל. טורפים פנימה קסנתן עד יציבות. מצננים.',
 NULL, 'קרם יציב', 'קסנתן מייצב את האמולסיה', 260),
('truffle-squeezer','jams_creams','כמהין לזילוף','1 ק"ג',
 '[{"name":"מחית כמהין","quantity":600,"unit":"גרם"},{"name":"שמן זית","quantity":300,"unit":"מ\"ל"},{"name":"מלח","quantity":10,"unit":"גרם"}]'::jsonb,
 NULL,
 'מערבבים את כל המרכיבים בבלנדר עד מרקם רך לזילוף משקית.',
 NULL, 'רך לזילוף', NULL, 270),
('polenta-sticks','starters','מקלות פולנטה','40 מקלות',
 '[{"name":"פולנטה מבושלת","quantity":2000,"unit":"גרם"},{"name":"קמח","quantity":300,"unit":"גרם"},{"name":"ביצים","quantity":4,"unit":"יחידות"},{"name":"פירורי לחם פנקו","quantity":400,"unit":"גרם"}]'::jsonb,
 NULL,
 'חותכים פולנטה למקלות. ציפוי כפול: קמח → ביצה → פנקו, ושוב ביצה → פנקו. מטגנים בשמן עמוק ב-180°C עד פריך.',
 NULL, 'קראנץ'' חיצוני, רכות פנימית', 'ציפוי כפול הוא הסוד לקראנץ''', 310),
('polenta-truffle','starters','פולנטה כמהין','1.5 ק"ג',
 '[{"name":"פולנטה","quantity":300,"unit":"גרם"},{"name":"חלב","quantity":1000,"unit":"מ\"ל"},{"name":"חמאה","quantity":150,"unit":"גרם"},{"name":"פרמזן","quantity":150,"unit":"גרם"},{"name":"מחית כמהין","quantity":80,"unit":"גרם"}]'::jsonb,
 NULL,
 'מבשלים פולנטה בחלב כ-20 דקות תוך ערבוב מתמיד. מסיימים בחמאה, פרמזן וכמהין. שומרים חמה לזילוף משקית.',
 1200, 'חלקה לזילוף', NULL, 320),
('gremolata','starters','גרמולטה','500 גרם',
 '[{"name":"פטרוזיליה קצוצה דק","quantity":300,"unit":"גרם"},{"name":"קליפת לימון","quantity":50,"unit":"גרם"},{"name":"שום קלוף קצוץ דק","quantity":50,"unit":"גרם"},{"name":"שמן זית","quantity":100,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'מערבבים את כל המרכיבים. חיתוך פינאלי על הצלחת לפני הגשה.',
 NULL, NULL, NULL, 330),
('croutons','starters','קרוטונים','2 ק"ג',
 '[{"name":"פוקצ''ה אפויה חלקית","quantity":2000,"unit":"גרם"},{"name":"שמן קנולה לטיגון","quantity":2000,"unit":"מ\"ל"}]'::jsonb,
 NULL,
 'חותכים פוקצ''ה לקוביות, מקררים. מטגנים בשמן עמוק ב-180°C עד הזהבה ופריכות. מסננים על נייר סופג.',
 NULL, 'פריך מבחוץ, רך מבפנים', 'הקירור חיוני לקראנץ''', 340),
('cookies','desserts','עוגיות','40 עוגיות',
 '[{"name":"חמאה רכה","quantity":500,"unit":"גרם"},{"name":"סוכר חום","quantity":400,"unit":"גרם"},{"name":"סוכר לבן","quantity":200,"unit":"גרם"},{"name":"ביצים","quantity":4,"unit":"יחידות"},{"name":"קמח","quantity":700,"unit":"גרם"},{"name":"שוקולד צ''יפס","quantity":500,"unit":"גרם"}]'::jsonb,
 NULL,
 'מקציפים חמאה וסוכר. מוסיפים ביצים, קמח ושוקולד. מעצבים כדורים. אופים ב-155°C למשך 15 דקות בעומק התנור.',
 900, 'רך באמצע, פריך בקצוות', 'טמפרטורה נמוכה ואחידה — אל תפתח את התנור', 410),
('kinder-ice-cream','desserts','גלידת קינדר','2 ליטר',
 '[{"name":"חלב","quantity":1000,"unit":"מ\"ל"},{"name":"שמנת","quantity":500,"unit":"מ\"ל"},{"name":"קינדר","quantity":400,"unit":"גרם"},{"name":"נוטלה","quantity":200,"unit":"גרם"},{"name":"חלמונים","quantity":8,"unit":"יחידות"},{"name":"סוכר","quantity":200,"unit":"גרם"}]'::jsonb,
 NULL,
 'מכינים אנגלז עם חלב, שמנת, חלמונים וסוכר. מקפלים פנימה קינדר ונוטלה מומסים. מקררים ומכניסים למכונת גלידה.',
 NULL, 'עשירה וקרמית', NULL, 420);

-- Spice mixes (production batches, no ingredients per se)
INSERT INTO public.recipes (id, category, name_hebrew, base_yield_hebrew, ingredients, instructions_hebrew, sort_order) VALUES
('spice-mix-tomato','spices','שקיות תבלינים לרוטב עגבניות','10 שקיות × 480ג''',
 '[{"name":"סוכר","quantity":2000,"unit":"גרם"},{"name":"מלח","quantity":1600,"unit":"גרם"},{"name":"שום גבישי","quantity":1200,"unit":"גרם"}]'::jsonb,
 'שוקלים כל מרכיב בנפרד למאזניים. מערבבים יחד עד אחידות צבע. מחלקים ל-10 שקיות של 480 גרם בדיוק.',
 510),
('spice-mix-cream','spices','שקיות תבלינים לרוטב שמנת','10 שקיות × 620ג''',
 '[{"name":"מלח","quantity":3000,"unit":"גרם"},{"name":"פלפל שחור","quantity":1200,"unit":"גרם"},{"name":"אגוז מוסקט","quantity":2000,"unit":"גרם"}]'::jsonb,
 'טוחנים את התבלינים יחד למרקם אחיד. מסמנים X על השקית. מחלקים ל-10 שקיות של 620 גרם.',
 520);