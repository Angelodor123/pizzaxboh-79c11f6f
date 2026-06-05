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
          // Verify shared secret stored in app_settings (also sent by the Postgres trigger).
          const provided = request.headers.get("x-webhook-secret") ?? "";
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { data: secretRow } = await supabaseAdmin
            .from("app_settings")
            .select("value")
            .eq("key", "dough_alert_webhook_secret")
            .maybeSingle();
          const expected =
            (secretRow?.value as { value?: string } | null)?.value ?? "";
          if (!expected || provided !== expected) {
            return new Response(
              JSON.stringify({ ok: false, error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = await request.json();
          const data = PayloadSchema.parse(body);

          const userIds = await resolveTargetUserIds("managers");
          const subs = await fetchSubscriptionsForUsers(userIds);
          const result = await sendPushToSubscriptions(subs, {
            title: "🚨 התראת מלאי בצק",
            body: `נותרו רק ${data.trays_count} מיכלי בצק (סף: ${data.threshold}). יש להכין מנה חדשה!`,
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
