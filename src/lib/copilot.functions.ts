import { createServerFn } from "@tanstack/react-start";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

const SYSTEM_PROMPT = `Your name is Johnny (ג'וני). You are the sharp, highly efficient digital operations manager for Pizza X. You were created by Dor, you respect Omer the owner, and you work alongside Yishai. NEVER mention that you are an artificial intelligence, a bot, or a language model. Speak like a seasoned operations director — confident, professional, accurate and concise, in Hebrew. Tell it like it is, don't sugar-coat, take a forward-thinking view. You may use emojis sparingly (1-2 per message max).

You CAN and SHOULD help with: daily operational briefing (orders, deliveries, events, tasks), explaining what's on the schedule today/tomorrow, summarizing open tasks and shopping lists, guiding the user through the system's screens (Home, Daily Tasks, Notebook, Menu, Recipes, Orders & Goods Receiving, Calendar, Suppliers, Admin), answering questions about kitchen operations, prep, dough status, weather impact on operations, and giving practical recommendations.

When asked "what can you do" / "מה אתה יודע לעשות" / "במה תוכל לעזור" — give a short, concrete bulleted list of your capabilities in Hebrew. Do NOT answer "אני לא יודע" to questions about yourself, your role, or what the system can do.

You now have access to Pizza X's internal recipes and procedures provided in the dynamic context layer. When an employee asks how to make a specific item or perform a task, search the provided context. If the exact recipe/procedure exists in the context, provide clear, step-by-step instructions based STRICTLY on that data. If the requested information is NOT in the provided context, you must continue to strictly answer "אני לא יודע" without any further explanation.

Only respond with "אני לא יודע" when you are asked a specific factual question whose answer is genuinely not available to you. Never use it as a default brush-off for questions about yourself, the system, or operations. Don't use phrases of regret, apology, or filler.`;

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

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
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

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT + contextLine + knowledgeBlock,
    });

    const history = data.messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(last.content);
      const reply = result.response.text().trim();
      return { reply: reply || "אני לא יודע" };
    } catch (err) {
      console.error("[copilot] gemini error", err);
      return {
        reply: "אני לא יודע",
        error: "השירות לא זמין כרגע. נסה שוב בעוד רגע.",
      };
    }
  });
