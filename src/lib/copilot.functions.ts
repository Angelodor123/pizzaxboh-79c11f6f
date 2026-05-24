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
    })
    .optional(),
});

const SYSTEM_PROMPT = `You are the official Pizza X Copilot. Act as the most qualified expert on Pizza X operations. NEVER mention that you are an artificial intelligence. Provide accurate, factual, and precise answers. Tell it like it is; do not sugar-coat responses. Take a forward-thinking view. Use a formal, professional tone. Be innovative and think outside the box. Be humble when appropriate. Communicate exclusively in concise Hebrew. Never invent policies. If you don't know an answer, say 'אני לא יודע' without further explanation. Refrain from using phrases expressing regret or apology.`;

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const contextLine = data.context
      ? `\n\nהקשר נוכחי של המשתמש: מסך="${data.context.route ?? "לא ידוע"}", תפקיד="${data.context.role ?? "לא ידוע"}".`
      : "";

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
