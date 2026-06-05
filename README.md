# 🍕 PizzaXBoh — מערכת ניהול תפעולית למסעדה

מערכת ניהול מקיפה (PWA) למסעדת פיצה, שנבנתה לניהול תפעול יומיומי, צוות, מלאי, ספקים, תחזוקה ו-AI לעיבוד חשבוניות.

🌐 **אתר חי:** [pizzaxboh.lovable.app](https://pizzaxboh.lovable.app)

---

## 📋 תוכן עניינים

- [סקירה כללית](#סקירה-כללית)
- [סטאק טכנולוגי](#סטאק-טכנולוגי)
- [פיצ'רים עיקריים](#פיצרים-עיקריים)
- [ארכיטקטורה](#ארכיטקטורה)
- [התקנה והרצה מקומית](#התקנה-והרצה-מקומית)
- [מבנה הפרויקט](#מבנה-הפרויקט)
- [הרשאות ותפקידים](#הרשאות-ותפקידים)
- [פריסה (Deployment)](#פריסה-deployment)

---

## סקירה כללית

PizzaXBoh היא מערכת ניהול מלאה למסעדה הפועלת כ-**Progressive Web App (PWA)** — מותקנת על המכשיר כאפליקציה, עובדת גם במצב אופליין, ושולחת התראות Push בזמן אמת.

המערכת תוכננה במיוחד לצוות מסעדה דובר עברית (RTL) ומשלבת בינה מלאכותית (Lovable AI Gateway — Gemini / GPT) לאוטומציה של תהליכים תפעוליים.

---

## סטאק טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| **Frontend** | React 19 + TypeScript |
| **Framework** | TanStack Start v1 (SSR + Server Functions) |
| **Build Tool** | Vite 7 |
| **Routing** | TanStack Router (file-based) |
| **State / Data** | TanStack Query + Zustand |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Animation** | Framer Motion |
| **Backend** | Lovable Cloud (Supabase) — PostgreSQL + Auth + Storage + Realtime |
| **AI** | Lovable AI Gateway (Gemini 2.5, GPT-5) |
| **Deployment** | Cloudflare Workers (Edge) |
| **PWA** | Service Worker + Web Push Notifications |

---

## פיצ'רים עיקריים

### 👥 ניהול צוות ומשמרות
- **משימות יומיות** עם הוכחת ביצוע בתמונה
- **לוח שנה** ולוח משמרות
- **Feed משמרת** — תיעוד הערות ואירועים בין משמרות
- **פרופיל אישי** עם תזכורות והתראות

### 📦 מלאי, ספקים והזמנות
- **קטלוג ספקים** עם מחירי עלות, מק"ט והיסטוריית רכש
- **הזמנות חכמות** בהתבסס על Par Levels ותחזיות
- **קליטת סחורה (Smart Receiving)** עם:
  - אימות אספקה פיזית (Zone A — הגיע / חסר / פגום)
  - משוב OCR ל-AI (Zone B — 👍/👎)
  - יצירת דוחות חריגה אוטומטיים
- **דוח חוסרים** עם הערכת הפסד כספי

### 🤖 בינה מלאכותית
- **OCR חשבוניות** — סריקת חשבונית = פירוט פריטים אוטומטי
- **התאמה חכמה לקטלוג** (Fuzzy Matching מעל 85% → מיפוי אוטומטי)
- **לימוד ספציפי לספק** — המערכת לומדת מתיקונים ידניים
- **Sandbox אימון** למנהלים לבדיקת איכות הפירוק
- **Copilot AI** — עוזר וירטואלי תפעולי

### 🔔 התראות מאוחדות
- פעמון התראות יחיד (UnifiedBell) המאחד:
  - התראות אישיות
  - קריאות שירות / תחזוקה (אדמין)
  - תלונות לקוחות (אדמין)
- **Web Push** למכשיר גם כשהאפליקציה סגורה
- עדכוני Realtime דרך Supabase Channels

### 🛠️ תחזוקה ושירות
- **קריאות שירות** עם הסלמה אוטומטית לפי דחיפות
- **חוסם תחזוקה קריטית** — חוסם פעולות מסוימות עד פתרון
- **התראות ספקים** משולבות

### 📚 ידע ותפעול
- **מתכונים** מובנים + שיתוף
- **ספר בישול** דיגיטלי
- **נהלי ניקיון ותפעול**
- **אנשי קשר** של ספקים ושירותים
- **פנקס דיגיטלי** עם MentionInput

### 📊 ניתוח ובקרת אדמין
- **לוח ניהול** (`/admin`) עם מדדים:
  - דיוק פירוק AI (Parsing Accuracy)
  - דיוק אספקה פיזית (Delivery Accuracy)
- **היסטוריית פעולות**
- **ניהול סניפים** (Multi-Branch)
- **בדיקת התראות**

### 🌐 PWA ואופליין
- התקנה למסך הבית
- Banner אופליין + סנכרון רקע
- Background Sync לשליחת פעולות לאחר חיבור מחדש

---

## ארכיטקטורה

### Server Functions (`createServerFn`)
כל לוגיקת ה-Backend הפנימית נכתבת כ-**TanStack Server Functions** — לא Edge Functions. דוגמאות:
- `src/lib/receiving.functions.ts` — OCR + פירוק חשבוניות
- `src/lib/ai-learning.functions.ts` — לימוד מתיקונים
- `src/lib/copilot.functions.ts` — עוזר AI
- `src/lib/push.functions.ts` — שליחת התראות Push

### Server Routes (Webhooks)
תחת `src/routes/api/public/` עבור Webhooks חיצוניים:
- `hooks/dough-alert.ts` — התראות בצק
- `hooks/sports-sync.ts` — סנכרון לוח משחקים

### אבטחה
- **Row-Level Security (RLS)** מופעל על כל הטבלאות
- **תפקידים בטבלה נפרדת** (`user_roles`) — לא ב-profile
- **Security Definer Function** `has_role()` למניעת recursive RLS
- כל Server Function רגיש מוגן ב-`requireSupabaseAuth` Middleware

---

## התקנה והרצה מקומית

### דרישות מקדימות
- [Bun](https://bun.sh) או Node.js 20+
- חיבור לפרויקט Lovable Cloud (Supabase)

### צעדים

```bash
# שכפול הריפו
git clone https://github.com/AngeloShop/pizzaxboh.git
cd pizzaxboh

# התקנת חבילות
bun install

# הרצה במצב פיתוח
bun run dev
```

המערכת תרוץ ב-`http://localhost:8080`.

### משתני סביבה
הקובץ `.env` מנוהל אוטומטית על ידי Lovable Cloud ומכיל:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```
⚠️ **אין לערוך את הקובץ ידנית** — הוא נוצר אוטומטית.

---

## מבנה הפרויקט

```
src/
├── routes/                  # File-based routing (TanStack)
│   ├── __root.tsx          # Layout ראשי
│   ├── index.tsx           # דף הבית
│   ├── admin.tsx           # פאנל ניהול
│   ├── tasks.tsx           # משימות
│   ├── recipes.tsx         # מתכונים
│   ├── suppliers.tsx       # ספקים
│   ├── orders.tsx          # הזמנות
│   ├── prep.tsx            # הכנות
│   ├── maintenance.tsx     # תחזוקה
│   ├── notifications.tsx   # התראות
│   ├── aids.*.tsx          # עזרים (ניקיון, אנשי קשר, ספקים, תפעול)
│   └── api/public/         # Webhooks ציבוריים
│
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── SmartReceivingModal.tsx
│   ├── InvoiceIntakeModal.tsx
│   ├── AiTrainingSandbox.tsx
│   ├── UnifiedBell.tsx
│   └── ...
│
├── lib/
│   ├── *.functions.ts      # Server Functions
│   ├── *.server.ts         # Server-only helpers
│   ├── auth.tsx            # Context אימות
│   ├── store.ts            # Zustand stores
│   └── ...
│
├── integrations/supabase/  # ⚠️ אוטומטי — לא לערוך
├── hooks/
└── styles.css              # Design Tokens + Tailwind
```

---

## הרשאות ותפקידים

המערכת תומכת ב-3 תפקידים (Enum `app_role`):

| תפקיד | הרשאות |
|-------|--------|
| `super_admin` | גישה מלאה לכל המודולים, מחירי עלות, ניהול משתמשים |
| `manager` | ניהול משמרת, אישור הזמנות, צפייה במחירי עלות |
| `staff` | משימות יומיות, קליטת סחורה, מתכונים |

---

## פריסה (Deployment)

הפרויקט מתפרסם אוטומטית דרך **Lovable** ל-Cloudflare Workers:

- **Production:** [pizzaxboh.lovable.app](https://pizzaxboh.lovable.app)
- **Preview (Dev):** סינכרון אוטומטי עם כל commit

### סינכרון Git ↔ Lovable
שינויים מ-GitHub מסונכרנים אוטומטית ל-Lovable (דו-כיווני). אין צורך ב-CI/CD ידני.

---

## 📝 רישיון

פרויקט פרטי — כל הזכויות שמורות.

---

**נבנה עם ❤️ ב-[Lovable](https://lovable.dev)**
