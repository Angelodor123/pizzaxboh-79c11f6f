import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchSubscriptionsForUsers,
  resolveTargetUserIds,
  sendPushToSubscriptions,
} from "@/lib/web-push.server";

/** Admin-only manual broadcast. */
export const broadcastPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        message: z.string().min(1).max(500),
        target: z.enum(["all", "managers"]),
        title: z.string().min(1).max(120).default("Pizza X"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify caller is admin or super_admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    const allowed = (roles ?? []).some(
      (r) => r.role === "admin" || r.role === "super_admin",
    );
    if (!allowed) {
      throw new Error("Unauthorized");
    }

    const userIds = await resolveTargetUserIds(data.target);
    const subs = await fetchSubscriptionsForUsers(userIds);
    const result = await sendPushToSubscriptions(subs, {
      title: data.title,
      body: data.message,
      tag: "broadcast",
    });
    return { ...result, targets: userIds.length, subscriptions: subs.length };
  });
