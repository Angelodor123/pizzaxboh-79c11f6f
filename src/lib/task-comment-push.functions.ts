import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a push notification to branch admin(s) and super_admins assigned to
 * the branch when any user saves a comment on a task. Fire-and-forget from
 * the client; failures should never break the save flow.
 */
export const notifyTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        taskName: z.string().min(1).max(200),
        commentText: z.string().min(1).max(300),
        branchId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Collect admins for this branch + all super_admins
    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("user_id, role, assigned_branch_id, is_active")
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const recipientIds = Array.from(
      new Set(
        (rows ?? [])
          .filter(
            (r) =>
              (r.role === "admin" && r.assigned_branch_id === data.branchId) ||
              r.role === "super_admin",
          )
          .map((r) => r.user_id as string)
          .filter((uid) => uid && uid !== userId),
      ),
    );

    if (recipientIds.length === 0) {
      return { sent: 0, failed: 0, subscriptions: 0 };
    }

    const { fetchSubscriptionsForUsers, sendPushToSubscriptions } = await import(
      "@/lib/web-push.server"
    );
    const subs = await fetchSubscriptionsForUsers(recipientIds);
    if (subs.length === 0) {
      return { sent: 0, failed: 0, subscriptions: 0 };
    }

    const snippet = data.commentText.slice(0, 150);
    const result = await sendPushToSubscriptions(subs, {
      title: "הערה חדשה על משימה",
      body: `${data.taskName}\n${snippet}`,
      tag: `task-comment-${data.taskId}`,
      url: "/tasks",
    });
    return { ...result, subscriptions: subs.length };
  });
