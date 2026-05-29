import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LogCorrectionInput = z.object({
  user_input: z.string().min(1).max(500),
  ai_suggestion: z.record(z.string(), z.any()).default({}),
  resolved_intent: z.record(z.string(), z.any()).default({}),
  context: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/)
    .default("general"),
  branch_id: z.string().uuid().nullable().optional(),
});

/**
 * Persist a single AI correction / override into ai_learning_dictionary.
 * Used wherever the user overrides a Gemini-suggested mapping (task→recipe,
 * task→prep-item, OCR field correction, etc.) so the model learns kitchen
 * terminology over time.
 */
export const logAiCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogCorrectionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase.from("ai_learning_dictionary").insert({
      user_id: userId,
      branch_id: data.branch_id ?? null,
      user_input: data.user_input,
      ai_suggestion: data.ai_suggestion,
      resolved_intent: data.resolved_intent,
      context: data.context,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

/**
 * Fetch the most recent dictionary entries for the current branch.
 * Used server-side to inject a "local kitchen terminology" block into the
 * Gemini system prompt so corrections stick over time.
 */
export async function loadLearningDictionary(
  supabase: any,
  branchId: string | undefined,
  limit = 60,
): Promise<Array<{ user_input: string; resolved_intent: any; context: string }>> {
  try {
    const q = supabase
      .from("ai_learning_dictionary")
      .select("user_input, resolved_intent, context, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (branchId) q.eq("branch_id", branchId);
    const { data } = await q;
    return (data ?? []) as any[];
  } catch {
    return [];
  }
}
