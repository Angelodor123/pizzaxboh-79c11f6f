// Maps Supabase/PostgREST/Postgres errors to friendly Hebrew messages,
// and exposes a single `toastError(err, fallback?)` helper.
import { toast } from "sonner";

type SupabaseLikeError = {
  message?: string;
  code?: string | number;
  details?: string | null;
  hint?: string | null;
  status?: number;
};

// PostgREST/Postgres code → Hebrew
const CODE_MAP: Record<string, string> = {
  "23505": "הרשומה כבר קיימת במערכת (כפילות).",
  "23503": "לא ניתן לבצע פעולה זו — קיימת תלות ברשומה אחרת.",
  "23502": "שדה חובה חסר.",
  "23514": "ערך לא תקין — לא עומד בבדיקת השדה.",
  "22001": "הערך ארוך מדי לשדה זה.",
  "22003": "המספר שהוזן מחוץ לטווח המותר.",
  "22P02": "פורמט לא תקין לערך שהוזן.",
  "42501": "אין לך הרשאה לבצע פעולה זו.",
  "42P01": "טבלה לא קיימת — פנה לתמיכה.",
  "PGRST116": "לא נמצאה רשומה תואמת.",
  "PGRST301": "אין לך הרשאה לצפות במידע זה.",
  "PGRST204": "השדה שניסית לעדכן לא קיים.",
};

const STATUS_MAP: Record<number, string> = {
  401: "אינך מחובר — התחבר מחדש ונסה שוב.",
  403: "אין לך הרשאה לבצע פעולה זו.",
  404: "לא נמצא.",
  408: "החיבור איטי מדי — נסה שוב.",
  409: "התנגשות עם נתונים קיימים.",
  413: "הקובץ או הבקשה גדולים מדי.",
  429: "יותר מדי בקשות — נסה שוב בעוד רגע.",
  500: "שגיאת שרת. נסה שוב.",
  502: "השרת לא זמין כרגע.",
  503: "השירות לא זמין כרגע — נסה שוב בעוד רגע.",
  504: "החיבור לשרת איטי. נסה שוב.",
};

export function toFriendlyMessage(
  err: unknown,
  fallback = "אירעה שגיאה לא צפויה. נסה שוב.",
): string {
  if (!err) return fallback;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "אין חיבור לאינטרנט. הפעולה תנסה להישלח שוב כשהחיבור יחזור.";
  }
  const e = err as SupabaseLikeError;
  const code = e?.code != null ? String(e.code) : "";
  if (code && CODE_MAP[code]) return CODE_MAP[code];
  if (e?.status && STATUS_MAP[e.status]) return STATUS_MAP[e.status];
  const msg = (e?.message || "").toString();
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "בעיית רשת — בדוק את החיבור ונסה שוב.";
  if (/JWT|token|session/i.test(msg))
    return "פג תוקף ההתחברות — התחבר שוב.";
  if (/duplicate key|already exists/i.test(msg))
    return CODE_MAP["23505"];
  if (/violates foreign key/i.test(msg))
    return CODE_MAP["23503"];
  if (/permission denied|row-level security/i.test(msg))
    return CODE_MAP["42501"];
  return msg && msg.length < 140 ? msg : fallback;
}

export function toastError(err: unknown, fallback?: string) {
  const message = toFriendlyMessage(err, fallback);
  // Log raw error to console for debugging — never shown to user.
  // eslint-disable-next-line no-console
  console.error("[app-error]", err);
  toast.error(message);
  return message;
}
