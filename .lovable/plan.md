## מטרה
להוסיף שכבת גיימיפיקציה ל-OCR החשבוניות + טור "שיוך חשבונאי" בטבלת הפריטים, עם זיכרון אוטומטי של ה-AI.

## חלק 1 — טאב חדש "🎮 אימון AI" ב-`/invoices`

קומפוננטה חדשה: `src/components/AiTrainingSandbox.tsx`.

מקור נתונים: טבלת `invoice_ocr_feedback` (קיימת — `raw_ocr`, `final_data`, `diff_summary`).

לכל ספק נחשב מתוך הפידבק:
- **XP** = סה"כ שדות שזוהו נכון (לא תוקנו ידנית). נספור מהשוואה raw_ocr↔final_data לכל שדה (invoice_number, total_amount, document_date, items[*].name/quantity/unit_price).
- **Level** = `floor(XP/50) + 1` (מקסימום 5):
  - 1 מתחיל · 2 חניך · 3 מומחה · 4 וירטואוז · 5 מאסטר
- **XP bar** = `(XP % 50) / 50 × 100%`
- **Streak** 🔥 = מספר חשבוניות אחרונות רצופות עם `diff_summary='perfect'` (אפס תיקונים) באותו ספק.

UI: כרטיס לכל ספק (גריד דו־טורי במובייל=טור יחיד), עם:
- שם ספק + תג Level צבעוני
- פס XP מלא (gradient ניאון) + מספר XP / next level
- 🔥 streak אם > 0
- מד "חשבוניות שעובדו"

## חלק 2 — שיוך חשבונאי + זיכרון AI

### Migration
1. הוספת `category text` ל-`invoice_items` (nullable).
2. שימוש ב-`ai_learning_dictionary` הקיים, עם `context='invoice_category'`, `user_input=שם פריט מנורמל`, `resolved_intent={category}`.

### קטגוריות קבועות (Hebrew):
- חומרי גלם (Food Cost)
- ניקיון ותחזוקה
- אריזה וחד־פעמי
- משקאות
- אחר

### שינויים ב-`SmartReceivingModal`:
- בטבלת ה-verify/manual — טור חדש "שיוך חשבונאי" (dropdown 44px).
- כשמגיע OCR: שליפת מילון לפי `branch_id` + `context='invoice_category'` → לכל שורה, אם השם תואם (looseEq) — מילוי אוטומטי של הקטגוריה.
- בעת שמירה:
  - שמירת `category` בעמודה החדשה של `invoice_items`.
  - לכל פריט עם קטגוריה — `INSERT` ל-`ai_learning_dictionary` (דרך `logAiCorrection`) עם `context='invoice_category'`.
  - שמירת רשומת `invoice_ocr_feedback` עם `diff_summary` = `'perfect'` אם 0 תיקונים, אחרת `'edits:<N>'`.
  - אם perfect → קריאה ל-`celebrate()` מ-`@/lib/celebrate` (קונפטי קיים).

## חלק 3 — קבצים שמשתנים
- **חדש**: `src/components/AiTrainingSandbox.tsx`
- **עריכה**: `src/routes/invoices.tsx` — הוספת `TabsTrigger` שלישי + `TabsContent`
- **עריכה**: `src/components/SmartReceivingModal.tsx` — טור קטגוריה, prefill ממילון, שמירת feedback + confetti
- **Migration**: `ALTER TABLE invoice_items ADD COLUMN category text;`

## מחוץ לסקופ
- שינוי ב-DnD
- שינוי לוגיקת OCR בצד שרת (`receiving.functions.ts`) — נשתמש בקיים.
- אינטגרציה של הקטגוריה לדוחות פיננסיים (נשמר ל-DB בלבד; ויזואליזציה בעתיד).
