import { tool } from "ai";
import { z } from "zod";
import { wrapError } from "./copilot-shared";

export function buildTasksTools(supabase: any, branchId: string | undefined, userId: string) {
  return {
    // ============ CHECKLISTS ============
    get_active_checklists: tool({
      description:
        "מחזיר את סטטוס הצ'קליסטים הפעילים (פתיחה/סגירה/משמרות) של היום עם אחוזי השלמה לכל משמרת ולכל קטגוריה.",
      inputSchema: z.object({
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ branch_id }) => {
        const bid = branch_id || branchId;
        try {
          const { data: today } = await supabase.rpc("operational_today");

          const tasksQ = supabase.from("tasks").select("id, name, group_id, branch_id").eq("active", true).limit(1000);
          if (bid) tasksQ.eq("branch_id", bid);
          const groupsQ = supabase.from("task_groups").select("id, name, shift_id, branch_id").eq("active", true).limit(500);
          if (bid) groupsQ.eq("branch_id", bid);
          const shiftsQ = supabase.from("shifts").select("id, name, branch_id").eq("active", true).limit(100);
          if (bid) shiftsQ.eq("branch_id", bid);
          const logsQ = supabase.from("daily_task_logs").select("task_id, completed, branch_id").eq("log_date", today as any).limit(2000);
          if (bid) logsQ.eq("branch_id", bid);

          const [tasksR, groupsR, shiftsR, logsR] = await Promise.all([tasksQ, groupsQ, shiftsQ, logsQ]);
          if (tasksR.error) return wrapError(tasksR.error);
          const tasks = tasksR.data ?? [];
          const groups = groupsR.data ?? [];
          const shifts = shiftsR.data ?? [];
          const logs = logsR.data ?? [];
          const doneSet = new Set(logs.filter((l: any) => l.completed).map((l: any) => l.task_id));

          const perShift = shifts.map((s: any) => {
            const sgroups = groups.filter((g: any) => g.shift_id === s.id);
            const sgroupIds = sgroups.map((g: any) => g.id);
            const stasks = tasks.filter((t: any) => sgroupIds.includes(t.group_id));
            const total = stasks.length;
            const done = stasks.filter((t: any) => doneSet.has(t.id)).length;
            const per_group = sgroups.map((g: any) => {
              const gtasks = tasks.filter((t: any) => t.group_id === g.id);
              const gd = gtasks.filter((t: any) => doneSet.has(t.id)).length;
              return { group: g.name, total: gtasks.length, completed: gd };
            });
            return { shift: s.name, total, completed: done, percent: total ? Math.round((done / total) * 100) : 0, per_group };
          });

          const total = tasks.length;
          const done = tasks.filter((t: any) => doneSet.has(t.id)).length;
          return {
            date: today,
            overall: { total, completed: done, percent: total ? Math.round((done / total) * 100) : 0 },
            per_shift: perShift,
          };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),

    toggle_checklist_task: tool({
      description:
        "מסמן משימה בצ'קליסט כבוצעה או מבטל סימון. מקבל task_id (או task_name לחיפוש), ו-completed (true/false).",
      inputSchema: z.object({
        task_id: z.string().uuid().optional(),
        task_name: z.string().max(200).optional(),
        completed: z.boolean(),
        branch_id: z.string().uuid().optional(),
      }),
      execute: async ({ task_id, task_name, completed, branch_id }) => {
        const bid = branch_id || branchId;
        try {
          let id = task_id;
          let resolvedBranch = bid;
          if (!id) {
            if (!task_name) return { error: "missing task_id or task_name" };
            const q = supabase.from("tasks").select("id, branch_id").ilike("name", `%${task_name}%`).eq("active", true).limit(1);
            if (bid) q.eq("branch_id", bid);
            const { data: found } = await q;
            id = found?.[0]?.id;
            resolvedBranch = found?.[0]?.branch_id ?? bid;
            if (!id) return { error: "task_not_found", message: `לא מצאתי משימה בשם "${task_name}".` };
          } else {
            const { data: t } = await supabase.from("tasks").select("branch_id").eq("id", id).single();
            resolvedBranch = t?.branch_id ?? bid;
          }
          if (!resolvedBranch) return { error: "missing branch_id" };
          const { data: today } = await supabase.rpc("operational_today");
          const payload: any = {
            task_id: id,
            branch_id: resolvedBranch,
            log_date: today,
            completed,
            completed_by_user_id: completed ? userId : null,
            completed_at: completed ? new Date().toISOString() : null,
          };
          const upd = await supabase
            .from("daily_task_logs")
            .update(payload)
            .eq("task_id", id)
            .eq("log_date", today as any)
            .eq("branch_id", resolvedBranch)
            .select();
          if (upd.error) return wrapError(upd.error);
          if (upd.data && upd.data.length) return { ok: true, updated: upd.data[0] };
          const ins = await supabase.from("daily_task_logs").insert(payload).select().single();
          if (ins.error) return wrapError(ins.error);
          return { ok: true, inserted: ins.data };
        } catch (e: any) {
          return wrapError(e);
        }
      },
    }),
  };
}
