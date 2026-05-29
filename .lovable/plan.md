תוכנית מפורטת לפי 3 החלקים בבקשה. לפני שאתחיל ביישום, יש כמה החלטות שכדאי לאשר.

## חלק 1 — חיפוש גלובלי ממוקד (Header)

- **רכיב חדש:** `src/components/GlobalSearch.tsx` — שדה חיפוש בהדר עם dropdown תוצאות.
- **Debounce:** 250ms (`useDebouncedValue`).
- **Scope:** רק `recipes` (לפי `name_hebrew`) ו-`tasks` (לפי `name`) — מסונן לפי `branch_id` של המשתמש.
- **קליק על תוצאה:**
  - מתכון → ניווט ל-`/recipes` עם פתיחת המתכון (דרך `useUIStore.setLastRecipe`).
  - משימה → ניווט ל-`/tasks` ופתיחת ה-`QuickEditTaskDialog` של המשימה (state בראוטר/URL param).
- **מיקום:** משולב ב-Header הראשי (אצטרך לאתר את ה-Header — כנראה בתוך `__root.tsx`).

## חלק 2 — גמישות ניהול משימות

### 2.1 Toggle "דחוף" ב-Quick-Edit
- DB: הוספת `is_urgent boolean default false` לטבלת `tasks`.
- UI: Switch ב-`QuickEditTaskDialog.tsx` שמעדכן את השדה.

### 2.2 Drag & Drop ל-`/tasks`
- DB: הוספת `manual_order_index integer default 0` ל-`tasks`.
- ספרייה: `@dnd-kit/core` + `@dnd-kit/sortable` (להתקין).
- Sort: `is_urgent DESC, manual_order_index ASC, sort_order ASC`.
- שמירת הסדר ב-DB אחרי drop (bulk update).

**שאלה:** ה-Drag&Drop צריך לעבוד **בתוך כל קטגוריה/קבוצה בנפרד**, או על כל המשימות של המשמרת כרשימה שטוחה אחת? (אני אניח: בתוך כל קבוצה בנפרד — מתאים ללוגיקת ההיררכיה הקיימת.)

## חלק 3 — קיצורים ולמידת AI

### 3.1 FAB גרירה לפנקס
- רכיב חדש: `src/components/DraggableNotepadFab.tsx`.
- ממוקם רק במסך `/tasks`.
- Drag חופשי, מיקום נשמר ב-`localStorage` (`pizzax-notepad-fab-pos`).
- קליק → `navigate({ to: "/notebook" })`.

### 3.2 טבלת `ai_learning_dictionary`
עמודות:
- `id`, `user_id`, `branch_id`
- `user_input text` — מה שהמשתמש כתב
- `resolved_intent jsonb` — התוצאה הסופית שהמשתמש בחר (task_id / recipe_id / מחרוזת)
- `context text` — מאיפה זה הגיע (`task_linking`, `invoice_parsing`, וכו')
- `ai_suggestion jsonb` — מה Gemini הציע במקור
- `created_at`
- RLS: קריאה/כתיבה למשתמשים עם תפקיד בסניף שלהם.

### 3.3 לולאת פידבק
**שאלה חשובה:** איפה בדיוק היום קורה "task linking" אוטומטי של Gemini במערכת? אני רואה `copilot.functions.ts` ו-`invoice-ocr.functions.ts`, אבל לא בטוח איפה יש קישור משימות אוטומטי שצריך תיקון.
- ברירת המחדל שלי: אוסיף תשתית `logAiCorrection()` ב-`src/lib/ai-learning.functions.ts`, ואקרא לה מ-Quick-Edit כאשר משימה משתנה לאחר הצעת AI. נצטרך להגדיר מתי בדיוק "הצעה" קיימת.

### 3.4 הזרקת הקשר ל-Prompt
- ב-`copilot.functions.ts` (ובכל קריאה ל-Gemini), לפני בניית ה-system prompt:
  ```ts
  const dict = await supabase.from('ai_learning_dictionary')
    .select('user_input, resolved_intent, context')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(50);
  ```
- להוסיף לסיסטם פרומפט בלוק "מילון מונחי המטבח המקומי" עם הזוגות.

---

## קבצים שייווצרו/ישונו

**חדשים:**
- `src/components/GlobalSearch.tsx`
- `src/components/DraggableNotepadFab.tsx`
- `src/hooks/use-debounced-value.ts`
- `src/lib/ai-learning.functions.ts`
- `supabase/migrations/*` (2 מיגרציות)

**מעודכנים:**
- `src/routes/__root.tsx` (הוספת GlobalSearch להדר)
- `src/routes/tasks.tsx` (DnD + FAB)
- `src/components/QuickEditTaskDialog.tsx` (Urgent toggle + AI log)
- `src/lib/tasks.ts` (סדר מיון, manual_order_index)
- `src/lib/copilot.functions.ts` (הזרקת dictionary)
- `package.json` (הוספת `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)

---

## שאלות לפני שאתחיל

1. **Drag&Drop scope:** בתוך כל קטגוריה בנפרד (מומלץ) או רשימה שטוחה אחת לכל המשמרת?
2. **AI Learning trigger:** איפה היום יש "קישור משימות אוטומטי" של Gemini שהמשתמש יכול לתקן? (אם אין — אבנה את התשתית ואחכה להפנייה ספציפית מאוחר יותר.)
3. **GlobalSearch — מובייל:** ההדר במובייל מאוד צר (360px). להציג את שדה החיפוש כאייקון שנפתח למודאל בלחיצה, או שדה תמיד גלוי מצומצם?

אחרי שתאשר/תענה — אבצע הכל ברצף.
