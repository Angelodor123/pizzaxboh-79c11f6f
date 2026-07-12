import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getWeeklyDigest } from "./weekly-digest.functions";

export const triggerWeeklyDigestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    if (today.getDay() !== 0) {
      return { sent: false, message: "לא יום ראשון" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;

    const { data: branches } = await supabase
      .from("branches")
      .select("id, name")
      .eq("active", true);

    const branchList = ((branches ?? []) as Array<{ id: string; name: string }>);
    const digests = await Promise.all(
      branchList.map((b) => getWeeklyDigest({ data: { branchId: b.id, weekOffset: -1 } })),
    );

    const summaryLines = digests.map(
      (d) =>
        `${d.branchName ?? "סניף"}: משימות ${d.taskCompletionPct}%, הוצאות ₪${Math.round(d.totalSpend)}, קריאות ${d.openTickets}`,
    );
    const body = summaryLines.join(" | ").slice(0, 480);

    const { data: superRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const userIds = Array.from(
      new Set(((superRoles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
    );
    if (!userIds.length) {
      return { sent: false, message: "אין מנהלי־על" };
    }

    const { sendPushToUsers } = await import("./push-send.functions");
    await sendPushToUsers({
      data: {
        userIds,
        title: "סיכום שבועי — Pizza X",
        body,
        url: "/admin",
        tag: "weekly-digest",
      },
    });
    return { sent: true, count: userIds.length, branches: digests.length };
  });
