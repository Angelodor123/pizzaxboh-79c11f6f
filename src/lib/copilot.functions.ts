import { createServerFn } from "@tanstack/react-start";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

function isPermissionError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  const code = String(err?.code ?? "");
  return (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("permission denied") ||
    msg.includes("violates row-level")
  );
}

function wrapError(err: any) {
  if (isPermissionError(err)) {
    return { error: "permission_denied", message: "אין לך הרשאה לפעולה הזו (RLS חסם)." };
  }
  return { error: String(err?.message ?? err) };
}

type SbClient = ReturnType<typeof supabaseAdmin.from> extends { select: any } ? any : any;

function buildTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    // ============ INVENTORY ============
    get_inventory_status: tool({
      description:
        "מחזיר מצב מלאי בזמן אמת: פריטי מלאי כלליים (inventory_items) + עדכון בצקים אחרון (dough_updates_log) + ספירת הכנות (prep_log) להיום.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional().describe("מזהה סניף; אם לא יסופק - הסניף של המשתמש"),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const inv = supabase.from("inventory_items").select("id, name, unit, current_stock, branch_id").order("name").limit(200);
          if (bid) inv.eq("branch_id", bid);
          const dough = supabase
            .from("dough_updates_log")
            .select("trays_count, updated_by_name, created_at, branch_id, prep_item_id")
            .order("created_at", { ascending: false })
            .limit(20);
          if (bid) dough.eq("branch_id", bid);
          const { data: today } = await supabase.rpc("operational_today");
          const prepQ = supabase
            .from("prep_log")
            .select("prep_item_id, current_stock, completed, updated_at")
            .eq("log_date", today as any)
            .limit(200);
          const [invR, doughR, prepR] = await Promise.all([inv, dough, prepQ]);
          if (invR.error) return wrapError(invR.error);
          return {
            inventory_items: invR.data ?? [],
            recent_dough_updates: doughR.data ?? [],
            prep_log_today: prepR.data ?? [],
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    update_inventory_count: tool({
      description:
        "מעדכן כמות מלאי. בחר אחד: (א) עדכון פריט מלאי כללי לפי inventory_item_id או name; (ב) רישום עדכון מגשי בצק (dough_trays) - מוסיף שורה חדשה ל-dough_updates_log.",
      inputSchema: z.object({
        kind: z.enum(["inventory_item", "dough_trays"]),
        inventory_item_id: z.string().uuid().optional(),
        item_name: z.string().max(120).optional(),
        new_stock: z.number().optional().describe("ערך מלאי חדש (פריט מלאי כללי)"),
        trays_count: z.number().int().min(0).max(10000).optional().describe("מספר מגשי בצק חדש"),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ kind, inventory_item_id, item_name, new_stock, trays_count, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          if (kind === "dough_trays") {
            if (trays_count == null) return { error: "missing trays_count" };
            if (!bid) return { error: "missing branch_id" };
            // need a prep_item_id (dough). pick first active prep item for branch.
            const { data: prep } = await supabase
              .from("prep_items")
              .select("id, name")
              .eq("branch_id", bid)
              .eq("active", true)
              .ilike("name", "%בצק%")
              .limit(1);
            const prepItemId = prep?.[0]?.id;
            if (!prepItemId) return { error: "no_dough_prep_item", message: "לא מצאתי פריט בצק בסניף." };
            const { data, error } = await supabase
              .from("dough_updates_log")
              .insert({ branch_id: bid, prep_item_id: prepItemId, trays_count, updated_by: userId })
              .select()
              .single();
            if (error) return wrapError(error);
            return { ok: true, updated: data };
          }
          if (kind === "inventory_item") {
            if (new_stock == null) return { error: "missing new_stock" };
            let id = inventory_item_id;
            if (!id) {
              if (!item_name) return { error: "missing item_name or inventory_item_id" };
              const q = supabase.from("inventory_items").select("id").ilike("name", `%${item_name}%`).limit(1);
              if (bid) q.eq("branch_id", bid);
              const { data: found } = await q;
              id = found?.[0]?.id;
              if (!id) return { error: "item_not_found", message: `לא מצאתי פריט בשם "${item_name}".` };
            }
            const { data, error } = await supabase
              .from("inventory_items")
              .update({ current_stock: new_stock })
              .eq("id", id)
              .select()
              .single();
            if (error) return wrapError(error);
            return { ok: true, updated: data };
          }
          return { error: "invalid kind" };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    // ============ DAILY PREP ============
    get_daily_prep_targets: tool({
      description:
        "מחזיר את יעדי ההכנות היומיות (prep_items) של היום לפי יום בשבוע, יחד עם סטטוס המלאי הנוכחי וסיום (prep_log).",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const { data: today } = await supabase.rpc("operational_today");
          const weekdayCols = ["target_sun","target_mon","target_tue","target_wed","target_thu","target_fri","target_sat"];
          const dow = new Date(String(today)).getDay();
          const targetCol = weekdayCols[dow];

          const itemsQ = supabase
            .from("prep_items")
            .select(`id, name, unit, ${targetCol}, branch_id`)
            .eq("active", true)
            .order("sort_order")
            .limit(200);
          if (bid) itemsQ.eq("branch_id", bid);

          const logQ = supabase
            .from("prep_log")
            .select("prep_item_id, current_stock, completed, updated_at")
            .eq("log_date", today as any)
            .limit(500);

          const [itemsR, logR] = await Promise.all([itemsQ, logQ]);
          if (itemsR.error) return wrapError(itemsR.error);
          const items = itemsR.data ?? [];
          const logs = logR.data ?? [];
          const rows = items.map((it: any) => {
            const l = logs.find((x: any) => x.prep_item_id === it.id);
            const target = Number(it[targetCol] ?? 0);
            const stock = Number(l?.current_stock ?? 0);
            return {
              id: it.id,
              name: it.name,
              unit: it.unit,
              target_today: target,
              current_stock: stock,
              completed: !!l?.completed,
              missing: Math.max(0, target - stock),
              updated_at: l?.updated_at ?? null,
            };
          });
          const total = rows.length;
          const done = rows.filter((r: any) => r.completed).length;
          return {
            date: today,
            weekday: dow,
            total_items: total,
            completed_items: done,
            percent: total ? Math.round((done / total) * 100) : 0,
            items: rows,
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    update_prep_quantity: tool({
      description:
        "מעדכן כמות שהוכנה היום עבור פריט הכנה (prep_item). יוצר/מעדכן רשומה ב-prep_log לפי prep_item_id (או prep_item_name) ולתאריך התפעולי של היום.",
      inputSchema: z.object({
        prep_item_id: z.string().uuid().optional(),
        prep_item_name: z.string().max(120).optional(),
        current_stock: z.number().min(0).describe("כמות מלאי/שהוכנה כעת"),
        completed: z.boolean().optional(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ prep_item_id, prep_item_name, current_stock, completed, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          let id = prep_item_id;
          if (!id) {
            if (!prep_item_name) return { error: "missing prep_item_id or prep_item_name" };
            const q = supabase.from("prep_items").select("id").ilike("name", `%${prep_item_name}%`).limit(1);
            if (bid) q.eq("branch_id", bid);
            const { data: found } = await q;
            id = found?.[0]?.id;
            if (!id) return { error: "prep_item_not_found", message: `לא מצאתי הכנה בשם "${prep_item_name}".` };
          }
          const { data: today } = await supabase.rpc("operational_today");
          const payload: any = { prep_item_id: id, log_date: today, current_stock, updated_by: userId, updated_at: new Date().toISOString() };
          if (completed != null) payload.completed = completed;

          // try update first
          const upd = await supabase
            .from("prep_log")
            .update(payload)
            .eq("prep_item_id", id)
            .eq("log_date", today as any)
            .select();
          if (upd.error) return wrapError(upd.error);
          if (upd.data && upd.data.length) return { ok: true, updated: upd.data[0] };

          const ins = await supabase.from("prep_log").insert(payload).select().single();
          if (ins.error) return wrapError(ins.error);
          return { ok: true, inserted: ins.data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    // ============ CHECKLISTS ============
    get_active_checklists: tool({
      description:
        "מחזיר את סטטוס הצ'קליסטים הפעילים (פתיחה/סגירה/משמרות) של היום עם אחוזי השלמה לכל משמרת ולכל קטגוריה.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const { data: today } = await supabase.rpc("operational_today");

          const tasksQ = supabase.from("tasks").select("id, name, group_id, branch_id").eq("active", true).limit(1000);
          if (bid) tasksQ.eq("branch_id", bid);
          const groupsQ = supabase.from("task_groups").select("id, name, shift_id, branch_id").eq("active", true).limit(500);
          if (bid) groupsQ.eq("branch_id", bid);
          const shiftsQ = supabase.from("shifts").select("id, name, branch_id").eq("active", true).limit(100);
          if (bid) shiftsQ.eq("branch_id", bid);
          const logsQ = supabase.from("daily_task_logs").select("task_id, completed, branch_id").eq("log_date", today as any).limit(2000);
          if (bid) logsQ.eq("branch_id", bid);

          const [tasksR, groupsR, shiftsR, logsR] = await Promise.all([tasksQ, groupsQ, shiftsQ, logsQ]);
          if (tasksR.error) return wrapError(tasksR.error);
          const tasks = tasksR.data ?? [];
          const groups = groupsR.data ?? [];
          const shifts = shiftsR.data ?? [];
          const logs = logsR.data ?? [];
          const doneSet = new Set(logs.filter((l: any) => l.completed).map((l: any) => l.task_id));

          const perShift = shifts.map((s: any) => {
            const sgroups = groups.filter((g: any) => g.shift_id === s.id);
            const sgroupIds = sgroups.map((g: any) => g.id);
            const stasks = tasks.filter((t: any) => sgroupIds.includes(t.group_id));
            const total = stasks.length;
            const done = stasks.filter((t: any) => doneSet.has(t.id)).length;
            const per_group = sgroups.map((g: any) => {
              const gtasks = tasks.filter((t: any) => t.group_id === g.id);
              const gd = gtasks.filter((t: any) => doneSet.has(t.id)).length;
              return { group: g.name, total: gtasks.length, completed: gd };
            });
            return { shift: s.name, total, completed: done, percent: total ? Math.round((done / total) * 100) : 0, per_group };
          });

          const total = tasks.length;
          const done = tasks.filter((t: any) => doneSet.has(t.id)).length;
          return {
            date: today,
            overall: { total, completed: done, percent: total ? Math.round((done / total) * 100) : 0 },
            per_shift: perShift,
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    toggle_checklist_task: tool({
      description:
        "מסמן משימה בצ'קליסט כבוצעה או מבטל סימון. מקבל task_id (או task_name לחיפוש), ו-completed (true/false).",
      inputSchema: z.object({
        task_id: z.string().uuid().optional(),
        task_name: z.string().max(200).optional(),
        completed: z.boolean(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ task_id, task_name, completed, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          let id = task_id;
          let resolvedBranch = bid;
          if (!id) {
            if (!task_name) return { error: "missing task_id or task_name" };
            const q = supabase.from("tasks").select("id, branch_id").ilike("name", `%${task_name}%`).eq("active", true).limit(1);
            if (bid) q.eq("branch_id", bid);
            const { data: found } = await q;
            id = found?.[0]?.id;
            resolvedBranch = found?.[0]?.branch_id ?? bid;
            if (!id) return { error: "task_not_found", message: `לא מצאתי משימה בשם "${task_name}".` };
          } else {
            const { data: t } = await supabase.from("tasks").select("branch_id").eq("id", id).single();
            resolvedBranch = t?.branch_id ?? bid;
          }
          if (!resolvedBranch) return { error: "missing branch_id" };
          const { data: today } = await supabase.rpc("operational_today");
          const payload: any = {
            task_id: id,
            branch_id: resolvedBranch,
            log_date: today,
            completed,
            completed_by_user_id: completed ? userId : null,
            completed_at: completed ? new Date().toISOString() : null,
          };
          const upd = await supabase
            .from("daily_task_logs")
            .update(payload)
            .eq("task_id", id)
            .eq("log_date", today as any)
            .eq("branch_id", resolvedBranch)
            .select();
          if (upd.error) return wrapError(upd.error);
          if (upd.data && upd.data.length) return { ok: true, updated: upd.data[0] };
          const ins = await supabase.from("daily_task_logs").insert(payload).select().single();
          if (ins.error) return wrapError(ins.error);
          return { ok: true, inserted: ins.data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    // ============ CALENDAR ============
    get_upcoming_events: tool({
      description: "מחזיר אירועים מלוח השנה (calendar_events) לטווח ימים שצוין.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
        days_ahead: z.number().int().min(1).max(60).default(7),
      }),
      execute: async ({ branch_id, days_ahead }) => {
        const bid = branch_id || branchId;
        try {
          const now = new Date();
          const end = new Date(now.getTime() + days_ahead * 86400000);
          const q = supabase
            .from("calendar_events")
            .select("id, title, category, event_date, start_time, end_time, supplier, recurring_weekday, high_priority, notes, branch_id")
            .or(`event_date.gte.${now.toISOString().slice(0, 10)},recurring_weekday.not.is.null`)
            .lte("event_date", end.toISOString().slice(0, 10))
            .limit(200);
          if (bid) q.eq("branch_id", bid);
          const { data, error } = await q;
          if (error) return wrapError(error);
          return { events: data ?? [], range: { from: now.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) } };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    add_calendar_event: tool({
      description: "מוסיף אירוע תפעולי חדש ללוח השנה (calendar_events). דרוש: title, category, event_date או recurring_weekday.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        category: z.string().min(1).max(60).describe("קטגוריה, למשל: delivery, meeting, maintenance"),
        event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("תאריך חד-פעמי YYYY-MM-DD"),
        recurring_weekday: z.number().int().min(0).max(6).optional().describe("0=ראשון..6=שבת לאירועים חוזרים"),
        start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        notes: z.string().max(1000).optional(),
        high_priority: z.boolean().optional(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async (input) => {
        const bid = input.branch_id || branchId;
        if (!bid) return { error: "missing branch_id" };
        if (!input.event_date && input.recurring_weekday == null) {
          return { error: "missing_date", message: "צריך event_date או recurring_weekday." };
        }
        try {
          const { data, error } = await supabase
            .from("calendar_events")
            .insert({
              branch_id: bid,
              title: input.title,
              category: input.category,
              event_date: input.event_date ?? null,
              recurring_weekday: input.recurring_weekday ?? null,
              start_time: input.start_time ?? null,
              end_time: input.end_time ?? null,
              notes: input.notes ?? null,
              high_priority: input.high_priority ?? false,
              is_auto: false,
              created_by: userId,
            })
            .select()
            .single();
          if (error) return wrapError(error);
          return { ok: true, event: data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    // ============ STAFF (read-only context) ============
    get_staff_directory: tool({
      description:
        "מחזיר רשימת אנשי צוות עם שמות ותפקידים (ללא מידע רגיש כמו טוקנים). משמש כקונטקסט עבור שאלות על מי במשמרת / מי אחראי.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const q = supabase
            .from("user_roles")
            .select("user_id, role, assigned_branch_id, is_active")
            .eq("is_active", true)
            .limit(200);
          if (bid) q.eq("assigned_branch_id", bid);
          const { data: roles, error } = await q;
          if (error) return wrapError(error);
          const userIds = (roles ?? []).map((r: any) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
          return {
            staff: (roles ?? []).map((r: any) => ({
              full_name: profMap.get(r.user_id) ?? null,
              role: r.role,
              branch_id: r.assigned_branch_id,
            })),
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

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
        system: SYSTEM_PROMPT + contextLine + knowledgeBlock + snapshotBlock,
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

