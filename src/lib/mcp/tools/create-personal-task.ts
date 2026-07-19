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
  name: "create_personal_task",
  title: "יצירת משימה אישית",
  description: "Create a new personal task for the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Task title."),
    is_urgent: z.boolean().optional().describe("Mark as urgent (flame)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, is_urgent }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert({ user_id: ctx.getUserId(), title, is_urgent: !!is_urgent })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created task: ${data.title}` }],
      structuredContent: { task: data },
    };
  },
});
