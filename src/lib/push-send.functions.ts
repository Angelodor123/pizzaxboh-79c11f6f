import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a Web Push notification to a list of user_ids. Authenticated users only. */
export const sendPushToUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(200),
        title: z.string().min(1).max(120),
        body: z.string().max(500).optional(),
        tag: z.string().max(120).optional(),
        url: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchSubscriptionsForUsers, sendPushToSubscriptions } = await import(
      "@/lib/web-push.server"
    );
    const subs = await fetchSubscriptionsForUsers(data.userIds);
    const result = await sendPushToSubscriptions(subs, {
      title: data.title,
      body: data.body,
      tag: data.tag,
      url: data.url,
    });
    return { ...result, subscriptions: subs.length };
  });
