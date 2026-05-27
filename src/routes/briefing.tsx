import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { useAuth } from "@/lib/auth";
import {
  fetchTaskTree,
  type Task,
  type TaskGroup,
  type Shift,
  type DailyTaskLog,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/briefing")({
  component: ShiftBriefingPage,
});

const LAST_DONE_KEY = "pizzax-briefing-last-done";

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CarryItem {
  taskId: string;
  taskName: string;
  groupName: string;
  shiftName: string;
  logId: string | null;
  logDate: string;
  createdAt: string;
  comments: string;
}

function ShiftBriefingPage() {
  const branchId = useActiveBranch();
  const { session, fullName, email } = useAuth();
  const userId = session?.user?.id ?? null;
  const userLabel = fullName ?? email ?? "briefing";

  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [yesterdayLogs, setYesterdayLogs] = useState<DailyTaskLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<DailyTaskLog[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<CarryItem | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);
  const todayIso = toIso(today);
  const yesterdayIso = toIso(yesterday);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_DONE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.date === todayIso) setDoneAt(parsed.at);
      }
    } catch {
      /* noop */
    }
  }, [todayIso]);

  useEffect(() => {
    if (!branchId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const tree = await fetchTaskTree(branchId);
        const [{ data: yl }, { data: tl }] = await Promise.all([
          supabase
            .from("daily_task_logs")
            .select("*")
            .eq("branch_id", branchId)
            .eq("log_date", yesterdayIso),
          supabase
            .from("daily_task_logs")
            .select("*")
            .eq("branch_id", branchId)
            .eq("log_date", todayIso),
        ]);
        if (!mounted) return;
        setShifts(tree.shifts);
        setGroups(tree.groups);
        setTasks(tree.tasks);
        setYesterdayLogs((yl ?? []) as DailyTaskLog[]);
        setTodayLogs((tl ?? []) as DailyTaskLog[]);
      } catch (e: any) {
        toast.error(e?.message ?? "שגיאה בטעינת התדריך");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [branchId, yesterdayIso, todayIso]);

  const carryItems = useMemo<CarryItem[]>(() => {
    const logsByTask = new Map(yesterdayLogs.map((l) => [l.task_id, l]));
    const grpById = new Map(groups.map((g) => [g.id, g]));
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const items: CarryItem[] = [];
    for (const t of tasks) {
      const log = logsByTask.get(t.id);
      if (!log) continue;
      if (log.completed) continue;
      if ((log.comments || "").startsWith("ARCHIVED:")) continue;
      const grp = grpById.get(t.group_id);
      const shift = grp ? shiftById.get(grp.shift_id) : undefined;
      items.push({
        taskId: t.id,
        taskName: t.name,
        groupName: grp?.name ?? "—",
        shiftName: shift?.name ?? "—",
        logId: log.id,
        logDate: log.log_date,
        createdAt: (log as any).created_at ?? yesterdayIso,
        comments: log.comments ?? "",
      });
    }
    return items;
  }, [tasks, groups, shifts, yesterdayLogs, yesterdayIso]);

  const todayAgenda = useMemo(() => {
    const completedToday = new Set(
      todayLogs.filter((l) => l.completed).map((l) => l.task_id),
    );
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const grpById = new Map(groups.map((g) => [g.id, g]));
    const grouped: Record<string, { shiftName: string; tasks: { task: Task; groupName: string }[] }> = {};
    for (const t of tasks) {
      if (completedToday.has(t.id)) continue;
      const grp = grpById.get(t.group_id);
      const shiftName = (grp && shiftById.get(grp.shift_id)?.name) || "כללי";
      if (!grouped[shiftName]) grouped[shiftName] = { shiftName, tasks: [] };
      grouped[shiftName].tasks.push({ task: t, groupName: grp?.name ?? "—" });
    }
    return Object.values(grouped);
  }, [tasks, groups, shifts, todayLogs]);

  async function reassignToToday(item: CarryItem) {
    if (!branchId) return;
    setBusyId(item.taskId);
    try {
      const { error } = await supabase
        .from("daily_task_logs")
        .upsert(
          {
            branch_id: branchId,
            task_id: item.taskId,
            log_date: todayIso,
            completed: false,
            completed_at: null,
            completed_by: null,
            completed_by_user_id: null,
            comments: `↻ הועברה מ-${item.logDate}`,
          },
          { onConflict: "task_id,log_date" },
        );
      if (error) throw error;
      const { data: tl } = await supabase
        .from("daily_task_logs")
        .select("*")
        .eq("branch_id", branchId)
        .eq("log_date", todayIso);
      setTodayLogs((tl ?? []) as DailyTaskLog[]);
      toast.success(`"${item.taskName}" הועברה למשמרת היום`);
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בהעברת המשימה");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveCarry() {
    if (!archiveTarget || !branchId) return;
    const reason = archiveReason.trim();
    if (!reason) {
      toast.error("יש להזין סיבה לארכוב");
      return;
    }
    setBusyId(archiveTarget.taskId);
    try {
      const { error } = await supabase
        .from("daily_task_logs")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user?.email ?? "briefing",
          completed_by_user_id: user?.id ?? null,
          comments: `ARCHIVED: ${reason}`,
        })
        .eq("id", archiveTarget.logId!);
      if (error) throw error;
      setYesterdayLogs((prev) =>
        prev.map((l) =>
          l.id === archiveTarget.logId
            ? { ...l, completed: true, comments: `ARCHIVED: ${reason}` }
            : l,
        ),
      );
      toast.success("המשימה אורכבה");
      setArchiveTarget(null);
      setArchiveReason("");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בארכוב");
    } finally {
      setBusyId(null);
    }
  }

  async function markBriefingDone() {
    setSubmitting(true);
    try {
      const stamp = new Date().toISOString();
      const payload = {
        date: todayIso,
        at: stamp,
        carryCount: carryItems.length,
        carryTasks: carryItems.map((c) => ({ id: c.taskId, name: c.taskName })),
        todayCount: todayAgenda.reduce((a, s) => a + s.tasks.length, 0),
      };
      try {
        localStorage.setItem(LAST_DONE_KEY, JSON.stringify(payload));
      } catch {
        /* noop */
      }
      setDoneAt(stamp);
      toast.success("התדריך סומן כהושלם ✓");
    } finally {
      setSubmitting(false);
    }
  }

  const carryByShift = useMemo(() => {
    const grouped: Record<string, CarryItem[]> = {};
    for (const c of carryItems) {
      const k = c.shiftName || "כללי";
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(c);
    }
    return Object.entries(grouped);
  }, [carryItems]);

  const dateLabel = today.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="h-6 w-6 text-neon" />
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            תדריך משמרת
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        {doneAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            תדריך הושלם ב-{new Date(doneAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin ml-2" />
          טוען תדריך…
        </div>
      ) : (
        <>
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-lg font-bold">
                משימות מאתמול ({carryItems.length})
              </h2>
            </div>
            {carryItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-4 text-sm text-muted-foreground text-center">
                ✓ אין משימות פתוחות מ-24 השעות האחרונות
              </div>
            ) : (
              <div className="space-y-4">
                {carryByShift.map(([shiftName, items]) => (
                  <div key={shiftName}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      {shiftName}
                    </div>
                    <div className="space-y-2">
                      {items.map((c) => (
                        <div
                          key={c.taskId}
                          className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm leading-tight">
                                {c.taskName}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  פתוחה מ-{new Date(c.createdAt).toLocaleDateString("he-IL")}
                                </span>
                                <span>· {c.groupName}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 shrink-0">
                              Pending
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1 h-11"
                              disabled={busyId === c.taskId}
                              onClick={() => reassignToToday(c)}
                            >
                              <RefreshCw className="h-4 w-4 ml-1" />
                              העבר להיום
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-11"
                              disabled={busyId === c.taskId}
                              onClick={() => {
                                setArchiveTarget(c);
                                setArchiveReason("");
                              }}
                            >
                              <Archive className="h-4 w-4 ml-1" />
                              ארכב
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-5 w-5 text-neon" />
              <h2 className="font-display text-lg font-bold">
                יעדי היום ({todayAgenda.reduce((a, s) => a + s.tasks.length, 0)})
              </h2>
            </div>
            {todayAgenda.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-4 text-sm text-muted-foreground text-center">
                כל המשימות להיום הושלמו 🎉
              </div>
            ) : (
              <div className="space-y-4">
                {todayAgenda.map((section) => (
                  <div
                    key={section.shiftName}
                    className="rounded-xl border-2 border-jungle/30 bg-card p-3"
                  >
                    <div className="text-xs uppercase tracking-wider text-neon font-bold mb-2">
                      {section.shiftName}
                    </div>
                    <ul className="space-y-1.5">
                      {section.tasks.map(({ task, groupName }) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-2 text-sm rounded-md bg-background/40 px-2.5 py-2"
                        >
                          <span className="truncate">{task.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {groupName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Link
                  to="/tasks"
                  className="block text-center text-sm text-neon font-bold py-2 hover:underline"
                >
                  פתח צ'ק-ליסט מלא ←
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      <div className="fixed bottom-0 inset-x-0 border-t border-zinc-800 bg-background/95 backdrop-blur p-3 z-40">
        <div className="max-w-3xl mx-auto">
          <Button
            className="w-full h-12"
            disabled={loading || submitting}
            onClick={markBriefingDone}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 ml-2" />
            )}
            סמן תדריך משמרת כהושלם
          </Button>
        </div>
      </div>

      <Dialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ארכוב משימה</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {archiveTarget?.taskName}
            </p>
            <label className="text-xs font-bold">סיבה לארכוב (חובה)</label>
            <Textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="למשל: כבר לא רלוונטי"
              className="min-h-[88px] text-right"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={archiveCarry}
              disabled={!archiveReason.trim() || busyId === archiveTarget?.taskId}
            >
              ארכב משימה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
