# תוכנית עדכון מערכת מקיפה

מבוסס על מה שכבר בוצע בסיבובים קודמים (תלונות, ארנק סיבוס בסיסי, שמירת state ב-sandbox, schema סלחני, חישוב הנחה סמויה ב-OCR).

## מה שנשאר ליישום

### Module 1 — שיפורי OCR (`src/lib/invoice-ocr.functions.ts`)
- חיזוק ניקוי `total_amount` מסימני מטבע (₪, $, פסיקים) → float נקי
- כפיית פורמט תאריך ISO `YYYY-MM-DD` כולל המרה מ-`DD/MM/YYYY`
- חיזוק ההוראה ב-prompt: סינון מפורש של פלטות/אריזות/פיקדונות
- (חישוב הנחה סמויה כבר קיים)

### Module 2 — Sandbox UI (`src/components/AiTrainingSandbox.tsx` או `InvoiceIntakeModal.tsx`)
- פריסת split-screen בדסקטופ (תמונה משמאל, טופס מימין)
- במובייל: כרטיסי פריט מוערמים עם שם + ✅/❌ למעלה, ורשת קומפקטית (כמות/מחיר/הנחה/יחידה/סה"כ)
- מיקרו-ולידציה לכל שדה (✅/❌), כפתור "אשר הכל", "נקה נתונים"
- "שמור ולמד" disabled עד שכל הפריטים אושרו
- (state persistence כבר קיים)

### Module 3 — קטלוג חכם
- מיגרציית DB: הוספת `sku TEXT`, `expected_price NUMERIC`, `category TEXT`, `min_stock_alert NUMERIC` ל-`supplier_products`
- עיצוב מחדש של מודאל "פריט חדש לקטלוג" — רשת 2 עמודות
- החלפת שדה Unit ל-`<Select>` עם יחידות סטנדרטיות
- שדות חדשים ב-UI

### Module 4.4 — לוג עסקאות סיבוס
- טבלה חדשה `cibus_transactions_log` (wallet_id, amount, type add/deduct, created_by, created_at, note)
- RLS + GRANTs
- כתיבה ללוג בכל פעולה ב-`src/routes/cibus.tsx`
- ציר זמן בפרופיל הלקוח

### Module 5 — בידוד סניפים, יישור, feature flag
- **5.1 לוח שנה**: ודא ש-`calendar_events` query כבר מסונן ב-branch (כבר מסונן ב-RLS, צריך בדיקה ב-`src/routes/calendar.tsx`)
- **5.2 יישור RTL**: תיקון מחלקות ב-`src/components/CategoryDrawer.tsx` — `flex items-center gap-3` עקבי, `dir="rtl"` ברמת הדרואר
- **5.3 Feature flag סיבוס**: הצגת "ניהול צבירות סיבוס" בתפריט והגבלת `/cibus` רק לסניף "מודיעין" (לפי `branch.name` או `features.cibus_wallet`)

## הערות טכניות
- כל מיגרציית DB תלווה ב-GRANTs ו-RLS מתאימים
- שינויי UI שומרים על palette קיים (destructive/success/amber-brand)
- ה-state persistence הקיים ב-sandbox לא ייפגע

## הצעה לסדר עבודה (אפשר לאשר/לפצל)
1. Module 1 (OCR) + Module 5.2 (RTL fix) — שינויים קטנים, בטוחים
2. Module 3 (קטלוג) — דורש מיגרציה
3. Module 4.4 (לוג סיבוס) — דורש מיגרציה
4. Module 5.3 (feature flag) — קצר
5. Module 2 (Sandbox UI redesign) — הגדול ביותר; מומלץ להפריד לסבב נפרד כדי לא לשבור את ה-state persistence הקיים

האם לבצע הכל בסבב אחד, או להתחיל מ-1+3+4+5 ולהשאיר Module 2 (Sandbox redesign) לסבב נפרד?
