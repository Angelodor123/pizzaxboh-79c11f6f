import { createServerFn } from "@tanstack/react-start";
import { generateText, tool, stepCountIs } from "ai";
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
      branchId: z.string().uuid().optional(),
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

🛠️ כלים (Tools) — חוק ברזל:
יש לך גישה חיה למסד הנתונים של פיצה X דרך כלים. לעולם אל תנחש ואל תמציא נתונים תפעוליים (מלאי, בצקים, משימות, אירועים, צוות). תמיד תפעיל את הכלי המתאים קודם — חכה לתשובה — ורק אז ענה למשתמש על בסיס הנתונים האמיתיים.
- שאלות על בצק / מלאי → get_inventory_status
- שאלות על משימות יומיות / צ'קליסט → get_daily_checklists
- שאלות על אירועים / לו"ז / ספקים השבוע → get_upcoming_events
- שאלות על צוות / משתמשים פעילים → get_staff_on_shift
- כל שאלה אחרת על טבלה תפעולית → query_app_data (עם רשימת טבלאות מותרת)
אם כלי נכשל או מחזיר ריק — תאמר את זה בסטייל שלך: "אחי, השרת עושה לי בעיות כרגע, לא מצליח למשוך את הנתונים" או "תכלס אין שם כלום עכשיו".

הקשר תפעולי (פיצה X):
אתה עוזר עם: התדריך היומי, הסבר על מסכי המערכת, שאלות על מטבח, בצקים, נהלים, ומתכונים פנימיים שמופיעים בשכבת הידע.

חוקים פרקטיים:
- כשנשאל "מה אתה יודע לעשות" — תן רשימה קצרה ומעשית בסלנג שלך.
- אם המשתמש שואל מתכון או נוהל ושכבת הידע למטה מכילה את התשובה — תן הוראות צעד-אחר-צעד.
- אזהרות ונתונים רציניים — תעביר ברור אבל בטון רגוע.
- בלי התנצלויות מוגזמות. אתה חבר בטוח של עצמו.`;

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

// Whitelist of operational tables Johnny can read via the generic tool.
const SAFE_TABLES = [
  "branches",
  "shifts",
  "tasks",
  "task_groups",
  "daily_task_logs",
  "prep_items",
  "prep_log",
  "dough_updates_log",
  "inventory_items",
  "inventory_movements",
  "calendar_events",
  "calendar_event_overrides",
  "suppliers",
  "orders",
  "invoices",
  "invoice_items",
  "restock_items",
  "restock_log",
  "ev_vehicles",
  "notebook_items",
  "recipes",
  "app_settings",
  "site_texts",
  "page_onboarding",
  "user_roles",
  "profiles",
] as const;

function buildTools(branchId: string | undefined) {
  return {
    get_inventory_status: tool({
      description:
        "מחזיר מצב מלאי בזמן אמת: פריטי מלאי כלליים (inventory_items) + עדכון בצקים אחרון (dough_updates_log) + ספירת הכנות (prep_log) להיום.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional().describe("מזהה סניף; אם לא יסופק - כל הסניפים"),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const inv = supabaseAdmin
            .from("inventory_items")
            .select("name, unit, current_stock, branch_id")
            .order("name")
            .limit(200);
          if (bid) inv.eq("branch_id", bid);

          const dough = supabaseAdmin
            .from("dough_updates_log")
            .select("trays_count, updated_by_name, created_at, branch_id, prep_item_id")
            .order("created_at", { ascending: false })
            .limit(20);
          if (bid) dough.eq("branch_id", bid);

          const { data: today } = await supabaseAdmin.rpc("operational_today");
          const prepQ = supabaseAdmin
            .from("prep_log")
            .select("prep_item_id, current_stock, completed, updated_at")
            .eq("log_date", today as any)
            .limit(200);

          const [invR, doughR, prepR] = await Promise.all([inv, dough, prepQ]);
          return {
            inventory_items: invR.data ?? [],
            recent_dough_updates: doughR.data ?? [],
            prep_log_today: prepR.data ?? [],
          };
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    }),

    get_daily_checklists: tool({
      description:
        "מחזיר את סטטוס המשימות היומיות של היום: כמה הושלמו, כמה נשארו, ואחוז סיום. כולל שמות משימות.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const { data: today } = await supabaseAdmin.rpc("operational_today");
          const logsQ = supabaseAdmin
            .from("daily_task_logs")
            .select("task_id, completed, completed_by, completed_at, branch_id")
            .eq("log_date", today as any)
            .limit(500);
          if (bid) logsQ.eq("branch_id", bid);

          const tasksQ = supabaseAdmin
            .from("tasks")
            .select("id, name, group_id, branch_id")
            .eq("active", true)
            .limit(500);
          if (bid) tasksQ.eq("branch_id", bid);

          const [logsR, tasksR] = await Promise.all([logsQ, tasksQ]);
          const logs = logsR.data ?? [];
          const tasks = tasksR.data ?? [];
          const total = tasks.length;
          const done = logs.filter((l: any) => l.completed).length;
          const percent = total ? Math.round((done / total) * 100) : 0;
          const remaining = tasks
            .filter((t: any) => !logs.find((l: any) => l.task_id === t.id && l.completed))
            .map((t: any) => t.name);
          return { date: today, total, completed: done, percent, remaining_tasks: remaining.slice(0, 50) };
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    }),

    get_upcoming_events: tool({
      description: "מחזיר אירועים מלוח השנה (calendar_events) ל-7 הימים הקרובים, כולל אירועים חוזרים.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
        days_ahead: z.number().int().min(1).max(30).default(7),
      }),
      execute: async ({ branch_id, days_ahead }) => {
        const bid = branch_id || branchId;
        try {
          const now = new Date();
          const end = new Date(now.getTime() + days_ahead * 86400000);
          const q = supabaseAdmin
            .from("calendar_events")
            .select("title, category, event_date, start_time, end_time, supplier, recurring_weekday, high_priority, notes, branch_id")
            .or(`event_date.gte.${now.toISOString().slice(0, 10)},recurring_weekday.not.is.null`)
            .lte("event_date", end.toISOString().slice(0, 10))
            .limit(200);
          if (bid) q.eq("branch_id", bid);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { events: data ?? [], range: { from: now.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) } };
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    }),

    get_staff_on_shift: tool({
      description:
        "מחזיר את המשתמשים הפעילים במערכת (user_roles + profiles). אין טבלת שעון נוכחות — זו רשימת המשתמשים בעלי גישה לסניף.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const q = supabaseAdmin
            .from("user_roles")
            .select("user_id, email, role, assigned_branch_id, is_active")
            .eq("is_active", true)
            .limit(200);
          if (bid) q.eq("assigned_branch_id", bid);
          const { data: roles, error } = await q;
          if (error) return { error: error.message };
          const userIds = (roles ?? []).map((r: any) => r.user_id);
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
          return {
            note: "אין טבלת שעון-נוכחות; זו רשימת בעלי הגישה לסניף.",
            staff: (roles ?? []).map((r: any) => ({
              full_name: profMap.get(r.user_id) ?? null,
              email: r.email,
              role: r.role,
              branch_id: r.assigned_branch_id,
            })),
          };
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    }),

    query_app_data: tool({
      description: `כלי גנרי לקריאה ממסד הנתונים. בחר טבלה מהרשימה המותרת בלבד, אופציונלית תוסיף תנאי שוויון (eq) ומיון. מוגבל ל-100 שורות. טבלאות מותרות: ${SAFE_TABLES.join(", ")}.`,
      inputSchema: z.object({
        table: z.enum(SAFE_TABLES),
        select: z.string().max(500).default("*").describe("עמודות לבחירה, ברירת מחדל *"),
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
          let q: any = supabaseAdmin.from(table).select(select).limit(limit);
          for (const f of filters ?? []) q = q.eq(f.column, f.value);
          if (order_by) q = q.order(order_by, { ascending });
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { table, rows: data ?? [] };
        } catch (e: any) {
          return { error: String(e?.message ?? e) };
        }
      },
    }),
  };
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
          "חסר LOVABLE_API_KEY ב-Lovable Cloud → Settings → Secrets.",
        ),
        error: "MISSING_LOVABLE_API_KEY",
      };
    }

    const ctxParts: string[] = [];
    if (data.context?.route) ctxParts.push(`מסך="${data.context.route}"`);
    if (data.context?.role) ctxParts.push(`תפקיד="${data.context.role}"`);
    if (data.context?.branchId) ctxParts.push(`branchId="${data.context.branchId}"`);
    if (data.context?.briefing) ctxParts.push(`תדריך תפעולי של היום: ${data.context.briefing}`);
    const contextLine = ctxParts.length ? `\n\nהקשר נוכחי: ${ctxParts.join(" | ")}.` : "";

    const kb = await buildKnowledgeContext();
    const knowledgeBlock = kb ? `\n\n==== שכבת ידע סטטית (Pizza X) ====\n${kb}\n==== סוף שכבת הידע ====` : "";

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
        tools: buildTools(data.context?.branchId),
        stopWhen: stepCountIs(50),
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
