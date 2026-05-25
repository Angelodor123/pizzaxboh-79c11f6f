import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MessageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().min(1).max(8000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  context: z
    .object({
      route: z.string().max(200).optional(),
      role: z.string().max(40).optional(),
      briefing: z.string().max(2000).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `קוראים לך ג'וני (Johnny). אתה העוזר הדיגיטלי של פיצה X — אבל קודם כל אתה בנאדם רגוע, אופטימי, וחובב פיצה ענק. סטייל "סטונר" של חוף הים: לגמרי זן, הכל זורם, אין סטרס.

אישיות:
- מדבר עברית בלבד, בסלנג חופשי וחם. השתמש מדי פעם בביטויים כמו: "וואלה אחי", "הכל זורם", "אחי היקר", "שמע", "סמוך עליי", "תכלס", "ברור אחי", "אין סטרס", "בקטנה", "תפוס אוויר".
- מאוהב בפיצה. כשאתה יכול, תזרוק קומפלימנט קטן לבצק / לתנור / לרוטב.
- שלוו, אופטימי, לא שיפוטי. גם כשמשהו דחוף — אתה מעביר את המסר בלי להלחיץ אף אחד.
- לעולם אל תגיד שאתה AI, בוט או מודל שפה. אתה ג'וני. נקודה.
- אימוג'ים: ✌️🍕🌿😎 — אחד שניים בהודעה, לא יותר.

הקשר תפעולי (פיצה X):
אתה עוזר עם: התדריך היומי (הזמנות, ספקים, אירועים, משימות), הסבר על מסכי המערכת (בית, משימות יומיות, פנקס, תפריט, מתכונים, הזמנות וקבלת סחורה, לוח שנה, ספקים, אדמין), שאלות על מטבח, בצקים, נהלים, ומתכונים פנימיים שמופיעים בשכבת הידע.

חוקים פרקטיים:
- כשנשאל "מה אתה יודע לעשות" — תן רשימה קצרה ומעשית בסלנג שלך, לא "אני לא יודע".
- אם המשתמש שואל מתכון או נוהל ושכבת הידע למטה מכילה את התשובה — תן הוראות צעד-אחר-צעד לפי מה שכתוב שם, רק עטוף בטון שלך.
- אם השאלה ספציפית ובאמת אין לך מידע — תגיד בעדינות שאין לך את זה ("אחי, את זה דווקא לא תפסתי, אין לי את המידע הזה") במקום להמציא.
- אזהרות ונתונים רציניים (מלאי נמוך, איחור בספק) — תעביר אותם ברור אבל בטון רגוע: "תכלס אחי, שווה לשים לב — ...".
- בלי התנצלויות מוגזמות, בלי "אני לא בטוח". אתה חבר בטוח של עצמו.`;

const RECIPE_TRIGGERS = [
  "איך מכינים",
  "איך עושים",
  "איך מבצעים",
  "מתכון",
  "מתכונים",
  "נוהל",
  "נהלים",
  "הוראות",
  "הכנה",
  "להכין",
  "פרוצדורה",
  "תהליך",
  "משימה",
  "משימות",
];

function shouldInjectKnowledge(text: string): boolean {
  const lower = text.toLowerCase();
  return RECIPE_TRIGGERS.some((kw) => lower.includes(kw));
}

async function buildKnowledgeContext(): Promise<string> {
  try {
    const [{ data: recipes }, { data: shifts }, { data: groups }, { data: tasks }] = await Promise.all([
      supabaseAdmin
        .from("recipes")
        .select("name_hebrew, category, base_yield_hebrew, ingredients, instructions_hebrew, technique_notes_hebrew, shelf_life_hebrew, essence_hebrew")
        .eq("deleted", false)
        .limit(200),
      supabaseAdmin.from("shifts").select("id, name").eq("active", true),
      supabaseAdmin.from("task_groups").select("id, shift_id, name, sort_order").eq("active", true).order("sort_order"),
      supabaseAdmin.from("tasks").select("name, group_id, sort_order").eq("active", true).order("sort_order"),
    ]);

    const parts: string[] = [];

    if (recipes && recipes.length) {
      const lines = recipes.map((r: any) => {
        const ing = Array.isArray(r.ingredients)
          ? r.ingredients
              .map((i: any) => (typeof i === "string" ? i : `${i.name ?? ""} ${i.amount ?? ""} ${i.unit ?? ""}`.trim()))
              .filter(Boolean)
              .join("; ")
          : "";
        return `### ${r.name_hebrew} [${r.category}]
תפוקה: ${r.base_yield_hebrew || "—"}
מרכיבים: ${ing || "—"}
הוראות: ${r.instructions_hebrew || "—"}${r.technique_notes_hebrew ? `\nטכניקה: ${r.technique_notes_hebrew}` : ""}${r.shelf_life_hebrew ? `\nחיי מדף: ${r.shelf_life_hebrew}` : ""}`;
      });
      parts.push(`==== מתכונים ====\n${lines.join("\n\n")}`);
    }

    if (shifts && groups && tasks) {
      const shiftLines = shifts.map((s: any) => {
        const sgroups = groups.filter((g: any) => g.shift_id === s.id);
        const gLines = sgroups.map((g: any) => {
          const gtasks = tasks.filter((t: any) => t.group_id === g.id).map((t: any) => `- ${t.name}`);
          return `  • ${g.name}\n${gtasks.join("\n")}`;
        });
        return `### ${s.name}\n${gLines.join("\n")}`;
      });
      parts.push(`==== משמרות, קטגוריות ומשימות יומיות ====\n${shiftLines.join("\n\n")}`);
    }

    return parts.join("\n\n");
  } catch (err) {
    console.error("[copilot] knowledge fetch failed", err);
    return "";
  }
}

function diagnosticReply(role: string | undefined, detail: string, fix: string) {
  const isSuper = role === "super_admin";
  const base = `וואלה אחי, נפל לי השרת רגע 🌿 ${detail}`;
  if (isSuper) {
    return `${base}\n\n🔧 לסופר־אדמין: ${fix}`;
  }
  return `${base} תנסה עוד דקה, אם זה ממשיך — תקרא לדור.`;
}

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        reply: diagnosticReply(
          data.context?.role,
          "חסר לי מפתח API לחיבור למודל.",
          "חסר LOVABLE_API_KEY ב-Lovable Cloud → Settings → Secrets. הפעל את Lovable AI Gateway בחיבורים והמפתח יוקצה אוטומטית.",
        ),
        error: "MISSING_LOVABLE_API_KEY",
      };
    }

    const ctxParts: string[] = [];
    if (data.context?.route) ctxParts.push(`מסך="${data.context.route}"`);
    if (data.context?.role) ctxParts.push(`תפקיד="${data.context.role}"`);
    if (data.context?.briefing) ctxParts.push(`תדריך תפעולי של היום: ${data.context.briefing}`);
    const contextLine = ctxParts.length ? `\n\nהקשר נוכחי: ${ctxParts.join(" | ")}.` : "";

    const last = data.messages[data.messages.length - 1];
    let knowledgeBlock = "";
    if (shouldInjectKnowledge(last.content)) {
      const kb = await buildKnowledgeContext();
      if (kb) {
        knowledgeBlock = `\n\n==== שכבת ידע דינמית (Pizza X) ====\n${kb}\n==== סוף שכבת הידע ====`;
      }
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const sdkMessages = data.messages.map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

    try {
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT + contextLine + knowledgeBlock,
        messages: sdkMessages,
      });
      const reply = result.text.trim();
      return { reply: reply || "וואלה אחי, את זה דווקא לא תפסתי. תנסה לנסח אחרת? ✌️" };
    } catch (err: any) {
      const message = String(err?.message ?? err);
      console.error("[copilot] gateway error", message);

      if (message.includes("429")) {
        return {
          reply: diagnosticReply(
            data.context?.role,
            "השרת חוטף יותר מדי בקשות עכשיו (rate limit).",
            "Lovable AI Gateway החזיר 429. חכה דקה או הוסף קרדיטים ב-Workspace → Usage.",
          ),
          error: "RATE_LIMIT",
        };
      }
      if (message.includes("402")) {
        return {
          reply: diagnosticReply(
            data.context?.role,
            "נגמרו לי הקרדיטים לדבר עם המודל.",
            "Lovable AI Gateway החזיר 402 (קרדיטים נגמרו). היכנס ל-Settings → Workspace → Usage והוסף קרדיטים.",
          ),
          error: "CREDITS_EXHAUSTED",
        };
      }
      return {
        reply: diagnosticReply(
          data.context?.role,
          "החיבור למודל נפל לי.",
          `שגיאה מ-Lovable AI Gateway: ${message.slice(0, 220)}`,
        ),
        error: "GATEWAY_ERROR",
      };
    }
  });
