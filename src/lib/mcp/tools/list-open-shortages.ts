import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_open_shortages",
  title: "רשימת חוסרים פתוחים",
  description:
    "Return open (not completed) shortage items across branches the signed-in user has access to. RLS scopes the result to that user.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .optional()
      .describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("shortage_items")
      .select("id, name, quantity, unit, notes, branch_id, created_at, status")
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { shortages: data ?? [] },
    };
  },
});
