## ספרינט: מרכז התראות מאוחד, תפקידים תפעוליים, ודף קשר סניף

### 1. מרכז התראות מאוחד + תיוגי קבוצה
- **DB**: ודא ש-`notifications` כולל `link` (כבר קיים). אין צורך במיגרציה.
- **UnifiedBell**: כבר מאחד `notifications` + tickets + complaints. אוסיף Realtime גם ל-`notifications` (כרגע רק polling דרך store).
- **MentionInput**:
  - הסר את החסימה של תיוג עצמי.
  - הוסף הצעות לקבוצות: `@כולם`, `@מטבח`, `@דלפק`, `@שליחים`, `@מנהלים` בנוסף ליוזרים.
- **Shift Feed parser**: בעת שליחת פוסט, פרס תגיות קבוצה ויוזרים → צור רשומות `notifications` לכל הנמענים (כולל self אם תויג).
  - `@כולם` → כל המשתמשים הפעילים בסניף.
  - `@מטבח/@דלפק/@שליחים` → לפי `department`.
  - `@מנהלים` → role `admin`/`super_admin`/`shift_manager`.
- **רנדור פיד**: רכיב חדש `<FeedText>` שמזהה את התגיות ומעטר אותן בצ׳יפים צבעוניים (זהב/כתום/כחול/ירוק/סגול).

### 2. שדות פרופיל תפעוליים
- **מיגרציה** ל-`profiles`: `department` (enum: kitchen/counter/delivery/management), `seniority` (text), `address` (text), `phone` (text).
- **RLS / View לפרטיות**:
  - שמירה על מדיניות SELECT קיימת.
  - יצירת VIEW `public.employee_directory` עם `security_invoker=on` שמסתיר `address` למי שאינו admin/super_admin (CASE לפי `current_user_role()`/`is_super_admin`).
  - דף הקשר ישלוף מה-VIEW; דף עריכת אדמין ימשיך לעבוד מול `profiles`.
- **טופס Admin → Users**: הוספת שדות חדשים בטופס העריכה הקיים (מחלקה/ותק/טלפון/כתובת).

### 3. דף קשר של הסניף (`/aids/contacts` כבר קיים — שדרוג)
- שדרוג העמוד הקיים מ"אנשי קשר חיצוניים" לכלול טאב **"צוות הסניף"** (employees) בנוסף לקיים, או הוספת מסך חדש `/aids/staff` אם נוח יותר.
- **כרטיס עובד**:
  - אווטאר, שם, מחלקה (badge צבעוני), ותק.
  - כפתורי פעולה: 📞 (`tel:`) ו-💬 וואטסאפ (`https://wa.me/` + ניקוי מספר לפורמט 972).
  - `address` מוצג רק אם `isSuperAdmin` או role admin/manager.
- **Manager CRUD**: כפתור "ערוך" → מודאל קטן לעדכון `phone/department/seniority/address`.
- **קישור בסיידבר/אינדקס עזרים**: הוספת כפתור "דף קשר צוות" עם אייקון `Users`/`Contact`.

### 4. שאלת התמחור (מענה מהיר בלי שינויי קוד)
- **כן** — מחירי קוסט מוצגים בקטלוג הספק (`SupplierCatalogManager`) למנהלים בלבד. הם מתעדכנים אוטומטית אחרי כל סריקת קבלה: ה-OCR מזהה מחיר ליחידה, מעדכן `supplier_products.cost_price`, ומציג "Estimated Loss" בדוחות חוסרים. הקלט הראשוני יכול להיות ידני בקטלוג; ככל שתסרוק יותר קבלות — הקטלוג ייבנה ויתעדכן מעצמו.

### קבצים שייווצרו/ישונו
- מיגרציה: `profiles` + view `employee_directory` + grants.
- חדש: `src/components/FeedText.tsx`, `src/components/EditEmployeeDialog.tsx`, אולי `src/routes/aids.staff.tsx`.
- עריכה: `MentionInput.tsx`, `ShiftFeedCard.tsx` (שליחה + רנדור), `UnifiedBell.tsx` (realtime), `admin.tsx`/טופס משתמשים, `aids.index.tsx` (קישור), `notifications-store.ts` (realtime).

---

**שאלות לפני שאני מתחיל:**
1. **דף קשר** — להוסיף כטאב בתוך `/aids/contacts` הקיים, או מסך חדש נפרד `/aids/staff` עם קישור משלו בעמוד עזרים? (אני נוטה לחדש כדי לא לערבב עם ספקים/לקוחות חיצוניים)
2. **תיוג `@מנהלים`** — לכלול גם `shift_manager` או רק `admin` + `super_admin`?
3. **ותק (seniority)** — להשאיר טקסט חופשי ("שנה וחצי") או להוסיף גם `start_date` תאריך לחישוב אוטומטי?