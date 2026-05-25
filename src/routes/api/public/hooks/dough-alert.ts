import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  fetchSubscriptionsForUsers,
  resolveTargetUserIds,
  sendPushToSubscriptions,
} from "@/lib/web-push.server";

const PayloadSchema = z.object({
  trays_count: z.number(),
  threshold: z.number(),
  branch_id: z.string().uuid().nullable().optional(),
  updated_by_name: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/public/hooks/dough-alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const data = PayloadSchema.parse(body);

          const userIds = await resolveTargetUserIds("managers");
          const subs = await fetchSubscriptionsForUsers(userIds);
          const result = await sendPushToSubscriptions(subs, {
            title: "🚨 התראת מלאי בצק",
            body: `נותרו רק ${data.trays_count} מגשי בצק (סף: ${data.threshold}). יש להכין מנה חדשה!`,
            tag: "dough-alert",
            url: "/",
          });

          return new Response(
            JSON.stringify({ ok: true, ...result }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          console.error("dough-alert error", e);
          return new Response(
            JSON.stringify({ ok: false, error: String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
