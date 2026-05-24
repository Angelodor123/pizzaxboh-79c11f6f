import { supabase } from "@/integrations/supabase/client";
import { getCurrentBranchId } from "@/lib/current-branch";

const LAST_OPEN_KEY = "pizzax-copilot-last-open-date";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hasOpenedToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LAST_OPEN_KEY) === todayKey();
  } catch {
    return true;
  }
}

export function markOpenedToday() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_OPEN_KEY, todayKey());
  } catch {
    /* noop */
  }
}

const HEBREW_WEEKDAYS = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
];

export type DailyBriefing = {
  weekdayHebrew: string;
  isoDate: string;
  suppliers: string[];
  events: { title: string; category: string; time?: string | null; highPriority: boolean }[];
};

export async function fetchDailyBriefing(): Promise<DailyBriefing> {
  const now = new Date();
  const weekday = now.getDay(); // 0=Sunday
  const iso = todayKey();
  const branchId = await getCurrentBranchId();

  const briefing: DailyBriefing = {
    weekdayHebrew: HEBREW_WEEKDAYS[weekday],
    isoDate: iso,
    suppliers: [],
    events: [],
  };

  try {
    // Suppliers delivering today
    let supQ = supabase.from("suppliers").select("name,delivery_weekdays,is_archived,active");
    if (branchId) supQ = supQ.eq("branch_id", branchId);
    const { data: sups } = await supQ;
    briefing.suppliers = (sups ?? [])
      .filter(
        (s: any) =>
          s.active &&
          !s.is_archived &&
          Array.isArray(s.delivery_weekdays) &&
          s.delivery_weekdays.includes(weekday),
      )
      .map((s: any) => s.name as string);

    // Calendar events for today (one-off or recurring) on this branch
    let evQ = supabase
      .from("calendar_events")
      .select("title,category,event_date,recurring_weekday,start_time,high_priority,branch_id");
    if (branchId) evQ = evQ.eq("branch_id", branchId);
    const { data: evs } = await evQ;
    briefing.events = (evs ?? [])
      .filter(
        (e: any) => e.event_date === iso || e.recurring_weekday === weekday,
      )
      .map((e: any) => ({
        title: e.title,
        category: e.category,
        time: e.start_time,
        highPriority: !!e.high_priority,
      }));
  } catch {
    /* noop — return whatever we have */
  }

  return briefing;
}

export function briefingToContext(b: DailyBriefing): string {
  const lines: string[] = [];
  lines.push(`היום ${b.weekdayHebrew} (${b.isoDate}).`);
  if (b.suppliers.length) {
    lines.push(`ספקים אמורים להגיע: ${b.suppliers.join(", ")}.`);
  } else {
    lines.push("אין הגעות ספקים מתוכננות.");
  }
  if (b.events.length) {
    const evTxt = b.events
      .map((e) => `${e.title}${e.time ? ` (${e.time.slice(0, 5)})` : ""}${e.highPriority ? " ⚠️" : ""}`)
      .join("; ");
    lines.push(`אירועים/פעילויות: ${evTxt}.`);
  }
  return lines.join(" ");
}

export const RANDOM_GREETINGS: string[] = [
  "שלום, אני ג'וני, מנהל התפעול הדיגיטלי של Pizza X (נוצרתי על ידי דור המלך, אגב 👑). אני כאן כדי לוודא שהעבודה מתקתקת. צריכים עזרה עם הנהלים?",
  "היי, כאן ג'וני. דור הביא אותי כדי לעשות פה סדר, אבל כולנו יודעים שעומר הבעלים קובע. מה על הפרק היום? 🍕",
  "ג'וני כאן. בואו נוודא שהמשמרת עובדת חלק לפני שישי מתחיל לשאול שאלות. צריכים עזרה בניווט במערכת? 😎",
  "שלום, מנהל התפעול הדיגיטלי לשירותכם. דור דאג שתקבלו פה את העזרה הכי טובה שיש. נתקעתם עם חשבונית? ✌️",
  "היי צוות. אני ג'וני. עומר משלם את חשבון החשמל של השרת שלי, אז כדאי שנעבוד כמו שצריך. במה אפשר לקדם אתכם? 📋",
  "כאן ג'וני. דור תכנת אותי לענות על כל השאלות שלכם, אז אין לנו תירוצים לישי. מה חסר לנו היום? 🍅",
  "אהלן, ג'וני זמין. מנהל התפעול שלכם מוכן לעבודה. צריכים עזרה עם הספקים או המערכת? 🤝",
  "היי, זה ג'וני. כדאי שנסיים את ההכנות בזמן, אם עומר יגלה שזייפנו הוא יחליף אותי במיקרוגל. מה חסר? ⏳",
  "ג'וני כאן. בואו נתקתק עבודה לפני שדור וישי יגיעו ויעשו לשנינו פאנלים. צריכים עזרה עם משהו? 🧹",
  "שלום, אני ג'וני. דור תכנת אותי לדווח על הכל, אז בואו נוודא שהמקרר מלא כדי שאף אחד לא יסתבך עם עומר. מה חסר למשמרת? 🥶",
  "אהלן, כאן ג'וני. אם אנחנו לא מכניסים את החשבוניות בזמן ישי ימחק לי את הקוד, אז בואו נתקתק. מי צריך עזרה? 😅",
  "ג'וני מתייצב. דור אמר לי לא לעשות לכם הנחות, ועומר מסכים איתו. בואו נעבוד נכון. שאלות על נהלים? 🔪",
  "אהלן. ג'וני, מנהל התפעול. בנינו אותי כדי שהכל יתקתק בלי תירוצים. צריכים להזין חשבונית? 🧾",
  "כאן ג'וני. דור וישי מצפים לשלמות, ואני פה לעזור לכם להשיג אותה. איך אני מייעל לכם את העבודה עכשיו? ⏱️",
  "שלום, אני ג'וני מ-Pizza X. נוצרתי כדי שאתם תתרכזו בפיצה ואני במספרים, ככה עומר יהיה מרוצה. מה צריך? 📊",
  "היי. ג'וני בודק דופק למשמרת. ישי על הקו השני מחכה לעדכונים, אז כדאי שנתקתק. דברו אליי. 🔥",
  "ג'וני על הקו. השמועה אומרת שדור לא חס על עוזרים וירטואליים שמפספסים הזמנות, אז בואו נוודא שהכל מוגדר נכון. 🤖",
];

export function randomGreeting(): string {
  return RANDOM_GREETINGS[Math.floor(Math.random() * RANDOM_GREETINGS.length)];
}
