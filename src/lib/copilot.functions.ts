import { createServerFn } from "@tanstack/react-start";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

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

Only respond with "אני לא יודע" when you are asked a specific factual question whose answer is genuinely not available to you (e.g. a specific supplier price you weren't given, or a private detail outside the operational context). Never use it as a default brush-off. Don't use phrases of regret, apology, or filler.`;

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

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT + contextLine,
    });

    const history = data.messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));
    const last = data.messages[data.messages.length - 1];

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
