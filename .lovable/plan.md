
# הרחבה Multi-Tenant + סניף ראשון לציון

## תמונת מצב (מה כבר קיים)
- טבלת `branches` קיימת, עם `BranchGate` שמראה למשתמש Super Admin רשת של כרטיסי סניפים, ולכל שאר המשתמשים נועל אוטומטית לפי `assigned_branch_id`.
- `BranchSwitcher` בכותרת מאפשר ל-super admin להחליף סניפים דינמית.
- רולים נוכחיים בטבלת `user_roles`: `admin`, `viewer`, `super_admin` (עם enum `app_role`).
- WeatherWidget קבוע על קואורדינטות מודיעין.
- כל הקוורים כבר עוברים פילטור לפי `branch_id` דרך `current_user_branch_id` RPC.

## חלק 1 — היררכיית רולים חדשה
ממפים את 4 הרולים החדשים על המבנה הקיים תוך שמירה על תאימות לאחור:

| חדש | מימוש |
|---|---|
| `regional_super_admin` | = `super_admin` הקיים (גישה לכל הסניפים + מעבר דינמי) |
| `branch_super_admin` | = `admin` עם `assigned_branch_id` (נעול לסניף) |
| `shift_manager` | רול **חדש** ב-enum, עם `assigned_branch_id` |
| `employee` | = `viewer` עם `assigned_branch_id` |

**מיגרציה**:
- `ALTER TYPE app_role ADD VALUE 'shift_manager'`.
- `has_role()` כבר מטפל - אין שינוי בלוגיקה.
- ב-`auth.tsx` נעדכן את ה-derive של הרול האפקטיבי כדי לחשוף שמות תצוגה חדשים (`regional_super_admin` במקום `super_admin` בלייבלים), אבל בבסיס הנתונים נשארים השמות הקיימים כדי לא לשבור RLS פוליסיות.
- נוסיף פונקציית עזר `display_role` ב-client בלבד.

## חלק 2 — לובי Super Admin עם KPI רשתי
שיפוץ של ה-grid הקיים ב-`BranchGate.tsx`:

1. **Network KPI Widget** (חדש) - באנר מעל כרטיסי הסניפים:
   - מציג "סה״כ מגשי בצק ברשת" - aggregate של `dough_trays` מכל הסניפים הפעילים.
   - שאילתה: `SELECT branch_id, SUM(trays_remaining) FROM dough_logs WHERE ... GROUP BY branch_id` (נשתמש בלוגיקה הקיימת של DoughStatusCard אבל cross-branch).
   - לקריאה כסניפים-cross נצטרך RPC חדשה `network_dough_summary()` שעוקפת את ה-RLS לפי בדיקה ש-`has_role(auth.uid(), 'super_admin')`.

2. **כרטיסי סניפים משודרגים**:
   - מוסיפים שדה `address` ו-`image_url` לטבלת `branches` (מיגרציה).
   - מעלים את שתי התמונות שצורפו ל-`public/branches/modiin.webp` ו-`public/branches/rishon.webp`.
   - מעדכנים שני הסניפים: Modi'in (עמק החולה 76) + Rishon LeZion (ז'בוטינסקי 16). אם הסניפים לא קיימים - יצירה.
   - כל כרטיס: תמונת רקע מלאה עם gradient overlay, שם הסניף + כתובת, hover עם נאון.

## חלק 3 — Branch Context גלובלי (כבר קיים, נחזק)
- `setActiveBranchId` ב-`current-branch.ts` כבר שומר ב-localStorage.
- RLS על כל הטבלאות כבר מסנן לפי `current_user_branch_id()`.
- **כותרת דינמית**: ב-`__root.tsx` או בכותרת הראשית, נוסיף תווית עם שם הסניף הפעיל ליד הלוגו.

## חלק 4 — תצורות ייחודיות לראשון
1. **דגל פיצ'ר "אין רכבים"**: נוסיף עמודה `features jsonb` לטבלת `branches` (לדוגמה `{"vehicles": false}`).
   - ב-Rishon ניתן `{"vehicles": false}`, במודיעין `{"vehicles": true}`.
   - הוק חדש `useBranchFeature(key)` שקורא מה-branches cache.
   - בקומפוננטות שמציגות "רכבים" (TasksPanel category, car-closing): `if (!useBranchFeature('vehicles')) return null`.

2. **WeatherWidget דינמי**: נוסיף עמודות `latitude`/`longitude` לטבלת `branches`. הוויידג'ט יקרא את הקואורדינטות מהסניף הפעיל. ברירת מחדל למודיעין אם NULL.

## פירוט טכני

### מיגרציה אחת:
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'shift_manager';

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Update/insert Modi'in
INSERT INTO public.branches (name, address, latitude, longitude, features, active)
VALUES ('Modi''in', 'עמק החולה 76', 31.8928, 35.0104, '{"vehicles": true}', true)
ON CONFLICT (name) DO UPDATE
  SET address=EXCLUDED.address, latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude, features=EXCLUDED.features;

INSERT INTO public.branches (name, address, latitude, longitude, features, active)
VALUES ('Rishon LeZion', 'ז''בוטינסקי 16', 31.9710, 34.7886, '{"vehicles": false}', true)
ON CONFLICT (name) DO UPDATE ...;

-- RPC לסיכום מגשי בצק רשתי
CREATE OR REPLACE FUNCTION public.network_dough_summary()
RETURNS TABLE(total_trays numeric, per_branch jsonb)
SECURITY DEFINER ...
```

### קבצים שיתעדכנו:
- `supabase/migrations/<new>.sql` — מיגרציה
- `src/lib/auth.tsx` — תמיכה ב-`shift_manager` ב-AppRole type
- `src/components/BranchGate.tsx` — KPI widget + כרטיסים עם תמונות וכתובת
- `src/components/WeatherWidget.tsx` — קריאת קואורדינטות מהסניף
- `src/components/BranchSwitcher.tsx` או הכותרת — תצוגת שם סניף ליד הלוגו
- `src/routes/tasks.tsx` / TasksPanel — הסתרת קטגוריית רכבים בראשון
- `public/branches/modiin.webp`, `public/branches/rishon.webp` — תמונות

## שאלות לאישור לפני שאני מתחיל
1. **תמונות הסניפים**: התמונה הראשונה (חזית PIZZA X עם נאונים) = מודיעין? השנייה (הפנים עם הטיקי) = ראשון? או הפוך?
2. **שם הסניף בעברית**: בכרטיס נציג "מודיעין" / "ראשון לציון" בעברית או "Modi'in" / "Rishon LeZion" באנגלית?
3. **`shift_manager`**: לבינתיים נמפה את ההרשאות שלו = `admin` (כל הפעולות בסניף). מאוחר יותר נחדד אם צריך הגבלות ספציפיות. אישור?
4. **תיקון הסניף הקיים**: אם כרגע יש סניף קיים בשם אחר במודיעין, האם להחליף את השם שלו ל-"Modi'in"/"מודיעין", או ליצור חדש?
