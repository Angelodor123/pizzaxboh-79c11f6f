# תכנית הטמעה — חבילת עדכון מקיפה

הבקשה רחבה מאוד וכוללת תשתיות חדשות (Web Push, WebAuthn, Service Worker מלא). לפני שאני קופץ למימוש, חשוב שנסכים על ההיקף והגישה — חלק מהרכיבים דורשים מפתחות/קונפיגורציה ייעודית.

---

## חלק 1 — אזור אישי `/my-profile` ✅ פשוט

- ראוט חדש תחת `_authenticated/my-profile.tsx`
- ברכה אישית עם השם מ-`profiles.full_name`
- כרטיס סיכום: התפקיד, הסניף, תאריך הצטרפות, סטטוס NDA
- קישורים מהירים: "מדריך לעובד" → `/guide`, "ה-NDA שלי" (מודאל קריאה בלבד של מסמך ה-NDA)
- כפתור גישה מסרגל הניווט הראשי

**עלות:** קובץ ראוט אחד + עדכון תפריט. ללא מיגרציה.

---

## חלק 2 — ביומטרי + אופליין ⚠️ מורכב

### 2A — WebAuthn / Passkeys
Supabase Auth **לא** תומך ב-passkeys נטיב. האפשרויות:
- **(מומלץ)** WebAuthn מקומי — נשמור credential ID ב-localStorage + טבלה `user_passkeys`, ולאחר אימות ביומטרי מוצלח נשלוף refresh token שמור ונחדש סשן. דורש זהירות אבטחתית.
- **חלופה פשוטה:** "Quick Unlock" — לאחר התחברות רגילה, נשמור flag מוצפן ונפעיל `navigator.credentials.get()` עם PublicKey רק כדי לבטל-נעילה של סשן קיים שעדיין תקף ב-Supabase (refresh token חי ~30 ימים).

**הצעה:** ניישם את החלופה הפשוטה (Quick Unlock) — מציג FaceID/טביעה רק כשיש סשן Supabase תקף; חוסך תשתית קריפטוגרפית מלאה. אם רוצים passkeys אמיתיים — נצטרך שיחה נפרדת.

### 2B — Service Worker אופליין
**אזהרה:** ה-SW הנוכחי (`public/sw.js`) הוא kill-switch בלבד (מנקה caches). הוספת caching מלא תשבור עדכונים בתצוגה המקדימה של Lovable וגם עלולה להגיש תוכן ישן באתר המפורסם.

**הצעה מאוזנת:**
- App Shell cache (HTML, JS, CSS) רק בפרודקשן (`pizzaxboh.lovable.app`), בגישת `NetworkFirst` עם timeout 3 שניות
- React Query: כבר משתמש ב-cache ב-memory; נוסיף `persistQueryClient` ל-localStorage עבור הקריאות החשובות
- לא ניגע ב-`id-preview--*` ובאייפריימים

### 2C — באנר אופליין + חסימת mutations
- hook `useOnlineStatus` עם listener על `online`/`offline`
- באנר ענברי קבוע למעלה כשאין רשת
- wrapper סביב mutations שמציג toast בעברית אם `!navigator.onLine`

---

## חלק 3 — פאנל התראות מנהל ⚠️ מורכב מאוד

### 3A — Web Push Notifications
דורש:
1. **VAPID keys** — צריך לייצר זוג מפתחות (`bun add web-push` + סקריפט) ולהוסיף כ-secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
2. **טבלה חדשה** `push_subscriptions` (user_id, endpoint, p256dh, auth, branch_id, created_at)
3. **SW push handler** — מאזין ל-`push` event ומציג notification
4. **Server function** `subscribeToPush` — שומר subscription
5. **Server function** `sendPushToUsers` — שולח ל-endpoints (דרך `web-push` בספריית Worker-compatible — ייתכן שנצטרך fetch ידני ל-FCM/Apple עם VAPID JWT, כי `web-push` הוא Node-only)

**הערה קריטית:** ה-Worker runtime לא תומך ב-`web-push` המקורי. נצטרך מימוש VAPID JWT ידני עם `crypto.subtle` — אפשרי אבל ~150 שורות.

### 3B — מסך `/admin/alerts`
- ראוט חדש תחת `_authenticated/admin/alerts.tsx`, מוגן ל-`admin`+`super_admin`
- שדה לסף מגשי בצק (נשמר ב-`app_settings` בקליד `dough_alert_threshold`, ברירת מחדל 15)
- טופס broadcast: textarea + select יעד ("כל הצוות"/"מנהלים בלבד") + כפתור שליחה

### 3C — טריגר אוטומטי
- Database trigger על `dough_updates_log` אחרי INSERT
- אם `trays_count < threshold` — `pg_net.http_post` ל-`/api/public/hooks/dough-alert`
- ה-route שולח push לכל המנהלים+super_admins הרשומים
- צריך להפעיל `pg_net` extension

---

## שאלות לפני שאני מתחיל

1. **WebAuthn:** האם להסתפק ב-"Quick Unlock" (פשוט, יציב) או דרוש passkeys מלא (מורכב יותר, שבועיים+ פיתוח)?
2. **Web Push:** האם להמשיך עם מימוש VAPID ידני ב-Worker? לחילופין — להשתמש ב-`notify()` הקיים (`src/lib/notifications.ts`) שעובד רק כשהטאב פתוח, אבל בלי backend push?
3. **היקף:** האם להגיש את כל שלושת החלקים בבת אחת (גדול, סיכון לבאגים), או לפצל לסבבים — קודם חלק 1 + חלק 2C (פשוטים), אחר כך 2A+2B, ואחרון 3?

ההמלצה שלי: **פיצול לשלושה PRs** כדי לוודא שכל חלק נבדק ויציב לפני המעבר לבא.