import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopSupplier = { name: string; total: number };
export type WeeklyDigest = {
  branchId: string | null;
  branchName: string | null;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  taskCompletionPct: number;
  tasksDone: number;
  tasksTotal: number;
  totalSpend: number;
  openTickets: number;
  shortagesCount: number;
  doughAverage: number;
  topSuppliers: TopSupplier[];
};

function formatWeekLabel(monday: Date, sunday: Date): string {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function computeWeekRange(weekOffset: number): { monday: Date; sunday: Date } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const shifted = new Date(now.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
  const dow = shifted.getDay(); // 0 Sun .. 6 Sat
  // Monday of that week
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(shifted.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export const getWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        branchId: z.string().uuid().optional(),
        weekOffset: z.number().int().optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<WeeklyDigest> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (context as any).supabase;
    const branchId = data.branchId ?? null;
    const weekOffset = data.weekOffset ?? 0;

    const { monday, sunday } = computeWeekRange(weekOffset);
    const mondayIso = monday.toISOString();
    const sundayIso = sunday.toISOString();
    const mondayDate = monday.toISOString().slice(0, 10);
    const sundayDate = sunday.toISOString().slice(0, 10);

    // Tasks total
    let tasksTotalQ = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("active", true);
    if (branchId) tasksTotalQ = tasksTotalQ.eq("branch_id", branchId);

    // Tasks done in window
    let tasksDoneQ = supabase
      .from("daily_task_logs")
      .select("*", { count: "exact", head: true })
      .eq("completed", true)
      .gte("log_date", mondayDate)
      .lte("log_date", sundayDate);
    if (branchId) tasksDoneQ = tasksDoneQ.eq("branch_id", branchId);

    // Invoices in window
    let invQ = supabase
      .from("invoices")
      .select("total_amount, supplier_id")
      .gte("document_date", mondayDate)
      .lte("document_date", sundayDate);
    if (branchId) invQ = invQ.eq("branch_id", branchId);

    // Tickets
    let ticketsQ = supabase
      .from("maintenance_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");
    if (branchId) ticketsQ = ticketsQ.eq("branch_id", branchId);

    // Shortages
    let shortagesQ = supabase
      .from("notebook_items")
      .select("*", { count: "exact", head: true })
      .eq("list_key", "shortages")
      .gte("created_at", mondayIso);
    if (branchId) shortagesQ = shortagesQ.eq("branch_id", branchId);

    // Dough
    let doughQ = supabase
      .from("dough_updates_log")
      .select("trays_count")
      .gte("created_at", mondayIso)
      .lte("created_at", sundayIso);
    if (branchId) doughQ = doughQ.eq("branch_id", branchId);

    // Branch name
    const branchQ = branchId
      ? supabase.from("branches").select("name").eq("id", branchId).maybeSingle()
      : Promise.resolve({ data: null });

    const [tt, td, invR, tk, sh, dg, br] = await Promise.all([
      tasksTotalQ,
      tasksDoneQ,
      invQ,
      ticketsQ,
      shortagesQ,
      doughQ,
      branchQ,
    ]);

    const tasksTotal = tt.count ?? 0;
    const tasksDone = td.count ?? 0;
    const taskCompletionPct =
      tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

    const invoices = (invR.data ?? []) as Array<{ total_amount: number | null; supplier_id: string | null }>;
    const totalSpend = invoices.reduce((s, x) => s + Number(x.total_amount ?? 0), 0);

    // Top suppliers
    const bySup = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.supplier_id) continue;
      bySup.set(inv.supplier_id, (bySup.get(inv.supplier_id) ?? 0) + Number(inv.total_amount ?? 0));
    }
    const supIds = Array.from(bySup.keys());
    let supplierNames = new Map<string, string>();
    if (supIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supIds);
      supplierNames = new Map(((sups ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
    }
    const topSuppliers: TopSupplier[] = Array.from(bySup.entries())
      .map(([id, total]) => ({ name: supplierNames.get(id) ?? "—", total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const trays = ((dg.data ?? []) as Array<{ trays_count: number | null }>)
      .map((r) => Number(r.trays_count ?? 0))
      .filter((n) => !Number.isNaN(n));
    const doughAverage = trays.length ? trays.reduce((a, b) => a + b, 0) / trays.length : 0;

    return {
      branchId,
      branchName: (br as { data: { name?: string } | null }).data?.name ?? null,
      weekLabel: formatWeekLabel(monday, sunday),
      weekStart: mondayDate,
      weekEnd: sundayDate,
      taskCompletionPct,
      tasksDone,
      tasksTotal,
      totalSpend,
      openTickets: tk.count ?? 0,
      shortagesCount: sh.count ?? 0,
      doughAverage,
      topSuppliers,
    };
  });
