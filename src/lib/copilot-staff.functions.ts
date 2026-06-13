import { tool } from "ai";
import { z } from "zod";
import { wrapError } from "./copilot-shared";

export function buildStaffTools(supabase: any, branchId: string | undefined, _userId: string) {
  return {
    // ============ STAFF (read-only context) ============
    get_staff_directory: tool({
      description:
        "מחזיר רשימת אנשי צוות עם שמות ותפקידים (ללא מידע רגיש כמו טוקנים). משמש כקונטקסט עבור שאלות על מי במשמרת / מי אחראי.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const q = supabase
            .from("user_roles")
            .select("user_id, role, assigned_branch_id, is_active")
            .eq("is_active", true)
            .limit(200);
          if (bid) q.eq("assigned_branch_id", bid);
          const { data: roles, error } = await q;
          if (error) return wrapError(error);
          const userIds = (roles ?? []).map((r: any) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
          return {
            staff: (roles ?? []).map((r: any) => ({
              full_name: profMap.get(r.user_id) ?? null,
              role: r.role,
              branch_id: r.assigned_branch_id,
            })),
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}
