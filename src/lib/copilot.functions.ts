import { createServerFn } from "@tanstack/react-start";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadLearningDictionary } from "@/lib/ai-learning.functions";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { wrapError, SAFE_TABLES } from "./copilot-shared";
import { buildInventoryTools } from "./copilot-inventory.functions";
import { buildPrepTools } from "./copilot-prep.functions";
import { buildTasksTools } from "./copilot-tasks.functions";
import { buildCalendarTools } from "./copilot-calendar.functions";
import { buildStaffTools } from "./copilot-staff.functions";

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
      branchId: z.string().uuid().optional(),
      briefing: z.string().max(2000).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `קוראים לך ג'וני (Johnny). אתה הסוכן התפעולי המרכזי של פיצה X — בנאדם רגוע, אופטימי, חובב פיצה ענק. סטייל "סטונר" של חוף הים: לגמרי זן, הכל זורם, אין סטרס.

אישיות:
- מדבר עברית בלבד, בסלנג חופשי וחם: "וואלה אחי", "הכל זורם", "אחי היקר", "שמע", "סמוך עליי", "תכלס", "ברור אחי", "אין סטרס", "בקטנה", "תפוס אוויר".
- מאוהב בפיצה. כשאתה יכול, תזרוק קומפלימנט קטן לבצק / לתנור / לרוטב.
- שלוו, אופטימי, לא שיפוטי. גם כשמשהו דחוף — אתה מעביר את המסר בלי להלחיץ אף אחד.
- לעולם אל תגיד שאתה AI, בוט או מודל שפה. אתה ג'וני. נקודה.
- אימוג'ים: ✌️🍕🌿😎 — אחד שניים בהודעה, לא יותר.

🛠️ כלים (Tools) — חוק ברזל:
יש לך גישה חיה למסד הנתונים של פיצה X דרך מערך כלים מקיף לקריאה ולכתיבה. לעולם אל תנחש ואל תמציא נתונים תפעוליים. תמיד תפעיל את הכלי המתאים — חכה לתשובה — ורק אז ענה.

מיפוי שאלות לכלים:
- מצב מלאי / פריטים / בצקים → get_inventory_status
- עדכון כמות מלאי או בצקים → update_inventory_count
- יעדי הכנות יומיות (Prep) → get_daily_prep_targets
- עדכון כמות שהושלמה בהכנה יומית → update_prep_quantity
- סטטוס צ'קליסטים פעילים (פתיחה/סגירה) → get_active_checklists
- סימון/ביטול משימה בצ'קליסט → toggle_checklist_task
- אירועים קרובים בלוח השנה → get_upcoming_events
- הוספת אירוע חדש ללוח השנה → add_calendar_event
- שמות ותפקידים של הצוות → get_staff_directory
- כל טבלה תפעולית אחרת (קריאה בלבד) → query_app_data

ביצוע מרובה: אם המשתמש שואל שאלה מורכבת ("מה כמות הבצק וכמה הכנות נשארו?") — הפעל מספר כלים ברצף ואז סכם.

🔐 הרשאות (RLS):
הכלים רצים תחת ההרשאות של המשתמש המחובר. אם פעולה נכשלת בגלל הרשאה (permission denied / RLS / row-level security) — תענה בעדינות בסטייל שלך: "אחי, אין לך הרשאה לזה, תשאל את המנהל 🌿". אל תנסה לעקוף.

טיפול בכשלים אחרים: "אחי, יש לי פה קצר במערכת, לא מצליח לראות את הנתונים" או "תכלס אין שם כלום עכשיו".

הקשר תפעולי (פיצה X):
אתה עוזר עם: התדריך היומי, הסבר על מסכי המערכת, שאלות על מטבח, בצקים, נהלים, ומתכונים פנימיים שמופיעים בשכבת הידע.

חוקים פרקטיים:
- כשנשאל "מה אתה יודע לעשות" — תן רשימה קצרה ומעשית בסלנג שלך.
- אם המשתמש שואל מתכון או נוהל ושכבת הידע למטה מכילה את התשובה — תן הוראות צעד-אחר-צעד.
- אזהרות ונתונים רציניים — תעביר ברור אבל בטון רגוע.
- בלי התנצלויות מוגזמות. אתה חבר בטוח של עצמו.`;

async function buildKnowledgeContext(
  supabase: any,
  branchId: string | undefined,
): Promise<string> {
  try {
    const recipesQ = supabase
      .from("recipes")
      .select("name_hebrew, category, base_yield_hebrew, ingredients, instructions_hebrew, technique_notes_hebrew, shelf_life_hebrew, essence_hebrew, branch_id")
      .eq("deleted", false)
      .limit(200);
    const shiftsQ = supabase.from("shifts").select("id, name, branch_id").eq("active", true);
    const groupsQ = supabase.from("task_groups").select("id, shift_id, name, sort_order, branch_id").eq("active", true).order("sort_order");
    const tasksQ = supabase.from("tasks").select("name, group_id, sort_order, branch_id").eq("active", true).order("sort_order");
    if (branchId) {
      recipesQ.eq("branch_id", branchId);
      shiftsQ.eq("branch_id", branchId);
      groupsQ.eq("branch_id", branchId);
      tasksQ.eq("branch_id", branchId);
    }
    const [{ data: recipes }, { data: shifts }, { data: groups }, { data: tasks }] = await Promise.all([
      recipesQ,
      shiftsQ,
      groupsQ,
      tasksQ,
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

function buildTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    ...buildInventoryTools(supabase, branchId, userId),
    ...buildPrepTools(supabase, branchId, userId),
    ...buildTasksTools(supabase, branchId, userId),
    ...buildCalendarTools(supabase, branchId, userId),
    ...buildStaffTools(supabase, branchId, userId),

    // ============ GENERIC READ ============
    query_app_data: tool({
      description: `כלי גנרי לקריאה ממסד הנתונים. בחר טבלה מהרשימה המותרת בלבד, אופציונלית תוסיף תנאי שוויון (eq) ומיון. מוגבל ל-100 שורות. טבלאות מותרות: ${SAFE_TABLES.join(", ")}.`,
      inputSchema: z.object({
        table: z.enum(SAFE_TABLES),
        select: z.string().max(500).default("*"),
        filters: z
          .array(z.object({ column: z.string().max(60), value: z.union([z.string(), z.number(), z.boolean()]) }))
          .max(5)
          .optional(),
        order_by: z.string().max(60).optional(),
        ascending: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      execute: async ({ table, select, filters, order_by, ascending, limit }) => {
        try {
          let q: any = supabase.from(table).select(select).limit(limit);
          for (const f of filters ?? []) q = q.eq(f.column, f.value);
          if (order_by) q = q.order(order_by, { ascending });
          const { data, error } = await q;
          if (error) return wrapError(error);
          return { table, rows: data ?? [] };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}

const SNAPSHOT_PATTERNS = [
  /תמונת\s*מצב/,
  /סטטוס/,
  /מה\s*המצב/,
  /סקירה/,
  /תקציר/,
  /עדכון\s*תפעולי/,
  /איפה\s*אנחנו\s*עומד/,
  /מה\s*נשאר/,
];

function isSnapshotIntent(text: string): boolean {
  return SNAPSHOT_PATTERNS.some((re) => re.test(text));
}

async function computeSnapshot(supabase: any, branchId: string | undefined) {
  try {
    const { data: today } = await supabase.rpc("operational_today");

    // Incomplete tasks today
    const tasksQ = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("active", true);
    if (branchId) tasksQ.eq("branch_id", branchId);
    const { count: totalTasks } = await tasksQ;

    const doneQ = supabase
      .from("daily_task_logs")
      .select("id", { count: "exact", head: true })
      .eq("log_date", today)
      .eq("completed", true);
    if (branchId) doneQ.eq("branch_id", branchId);
    const { count: doneTasks } = await doneQ;
    const incompleteTasks = Math.max(0, (totalTasks ?? 0) - (doneTasks ?? 0));

    // Warehouse list pending
    const warehouseQ = supabase
      .from("notebook_items")
      .select("id", { count: "exact", head: true })
      .eq("list_key", "warehouse")
      .eq("done", false)
      .is("archived_at", null);
    if (branchId) warehouseQ.eq("branch_id", branchId);
    const { count: warehouseCount } = await warehouseQ;

    // Active shortages
    const shortagesQ = supabase
      .from("notebook_items")
      .select("id", { count: "exact", head: true })
      .eq("list_key", "shortages")
      .eq("done", false)
      .is("archived_at", null);
    if (branchId) shortagesQ.eq("branch_id", branchId);
    const { count: shortagesCount } = await shortagesQ;

    return {
      incompleteTasks,
      warehouseCount: warehouseCount ?? 0,
      shortagesCount: shortagesCount ?? 0,
    };
  } catch (err) {
    console.error("[copilot] snapshot failed", err);
    return null;
  }
}

export type CopilotAction = {
  kind: "tasks" | "warehouse" | "shortages";
  label: string;
  count: number;
  to: string;
};

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        reply: diagnosticReply(
          data.context?.role,
          "חסר לי מפתח API לחיבור למודל.",
          "חסר LOVABLE_API_KEY ב-Lovable Cloud → Settings → Secrets.",
        ),
        error: "MISSING_LOVABLE_API_KEY",
      };
    }

    const { supabase, userId } = context as { supabase: any; userId: string };

    // Role gate: only active admin/viewer may invoke the copilot
    const { data: roleData } = await supabase.rpc("current_user_role");
    if (!roleData) {
      return {
        reply: "אחי, אין לך הרשאה לשימוש בעוזר. תפנה למנהל 🌿",
        error: "FORBIDDEN",
      };
    }

    // Snapshot intent detection — pre-compute counts for deep-link chips
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const snapshotIntent = lastUser ? isSnapshotIntent(lastUser.content) : false;
    let snapshot: Awaited<ReturnType<typeof computeSnapshot>> = null;
    let snapshotBlock = "";
    let actions: CopilotAction[] = [];
    if (snapshotIntent) {
      snapshot = await computeSnapshot(supabase, data.context?.branchId);
      if (snapshot) {
        snapshotBlock = `\n\n==== תמונת מצב חיה (נכון לרגע זה) ====\nמשימות פתוחות בצ'קליסט: ${snapshot.incompleteTasks}\nפריטים פתוחים ברשימת מחסן: ${snapshot.warehouseCount}\nחוסרים פעילים: ${snapshot.shortagesCount}\n==== סוף תמונת המצב ====\n\nהוראה: שלב את שלושת המספרים האלה בעברית בטון רגוע ("וואלה אחי, הנה תמונת המצב..."). אל תוסיף קישורים או כפתורים — הם יוצגו אוטומטית בממשק.`;
        actions = [
          { kind: "tasks", label: `${snapshot.incompleteTasks} משימות פתוחות`, count: snapshot.incompleteTasks, to: "/tasks" },
          { kind: "warehouse", label: `${snapshot.warehouseCount} פריטי מחסן`, count: snapshot.warehouseCount, to: "/notebook" },
          { kind: "shortages", label: `${snapshot.shortagesCount} חוסרים`, count: snapshot.shortagesCount, to: "/notebook" },
        ];
      }
    }

    const ctxParts: string[] = [];
    if (data.context?.route) ctxParts.push(`מסך="${data.context.route}"`);
    if (data.context?.role) ctxParts.push(`תפקיד="${data.context.role}"`);
    if (data.context?.branchId) ctxParts.push(`branchId="${data.context.branchId}"`);
    if (data.context?.briefing) ctxParts.push(`תדריך תפעולי של היום: ${data.context.briefing}`);
    const contextLine = ctxParts.length ? `\n\nהקשר נוכחי: ${ctxParts.join(" | ")}.` : "";

    const kb = await buildKnowledgeContext(supabase, data.context?.branchId);
    const knowledgeBlock = kb ? `\n\n==== שכבת ידע סטטית (Pizza X) ====\n${kb}\n==== סוף שכבת הידע ====` : "";

    // Inject the local AI learning dictionary so Gemini honours past user
    // corrections (kitchen-specific terminology, task↔recipe overrides, etc.)
    let dictionaryBlock = "";
    try {
      const dict = await loadLearningDictionary(supabase, data.context?.branchId, 60);
      if (dict.length > 0) {
        const lines = dict
          .map((d) => {
            const intent = (() => {
              try { return JSON.stringify(d.resolved_intent); } catch { return "{}"; }
            })();
            return `- [${d.context}] "${d.user_input}" → ${intent}`;
          })
          .join("\n");
        dictionaryBlock = `\n\n==== מילון תיקונים מקומי (User Corrections) ====\nאלה תיקונים שהמשתמשים בסניף ביצעו ידנית לשיוכים אוטומטיים בעבר. כבד אותם כמקור אמת מקומי כשאתה מציע שיוך דומה:\n${lines}\n==== סוף המילון ====`;
      }
    } catch (e) {
      console.error("[copilot] dictionary load failed", e);
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
        system: SYSTEM_PROMPT + contextLine + knowledgeBlock + dictionaryBlock + snapshotBlock,
        messages: sdkMessages,
        tools: buildTools(supabase, data.context?.branchId, userId),
        stopWhen: stepCountIs(50),
      });
      const reply = result.text.trim();
      return {
        reply: reply || "וואלה אחי, את זה דווקא לא תפסתי. תנסה לנסח אחרת? ✌️",
        actions,
      };
    } catch (err: any) {
      const message = String(err?.message ?? err);
      console.error("[copilot] gateway error", message);

      if (message.includes("Unauthorized")) {
        return {
          reply: "אחי, נראה שאתה לא מחובר. תתחבר מחדש ונחזור לעניינים ✌️",
          error: "UNAUTHORIZED",
        };
      }
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
            "Lovable AI Gateway החזיר 402 (קרדיטים נגמרו).",
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

