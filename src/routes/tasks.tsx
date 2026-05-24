import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, BookOpen, Save, Loader2, CheckCircle2, CloudSnow } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useActiveBranch } from "@/components/BranchGate";
import {
  fetchTaskTree,
  fetchTodayLogs,
  upsertLogs,
  type Shift,
  type TaskGroup,
  type Task,
  type DailyTaskLog,
} from "@/lib/tasks";
import { useCookbookStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type LogState = {
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_user_id: string | null;
  comments: string;
  dirty: boolean;
};

const VIRTUAL_WINTER_SHIFT_ID = "__virtual_winter__";
const VIRTUAL_WINTER_GROUP_ID = "__virtual_winter_group__";
const VIRTUAL_WINTER_TASKS: Task[] = [
  {
    id: "__virtual_winter_t1__",
    branch_id: "",
    group_id: VIRTUAL_WINTER_GROUP_ID,
    name: "איסוף כריות מישיבת חוץ",
    sort_order: 10,
    active: true,
    recipe_id: null,
    prep_item_id: null,
  },
  {
    id: "__virtual_winter_t2__",
    branch_id: "",
    group_id: VIRTUAL_WINTER_GROUP_ID,
    name: "כיסוי שולחנות חוץ ופינוי תפריטים",
    sort_order: 20,
    active: true,
    recipe_id: null,
    prep_item_id: null,
  },
  {
    id: "__virtual_winter_t3__",
    branch_id: "",
    group_id: VIRTUAL_WINTER_GROUP_ID,
    name: "וידוא תקינות נקזים ופתחי ניקוז",
    sort_order: 30,
    active: true,
    recipe_id: null,
    prep_item_id: null,
  },
];

function useSevereWeather() {
  const [severe, setSevere] = useState(false);
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=31.8928&longitude=35.0061&hourly=precipitation_probability,weather_code,wind_speed_10m&forecast_hours=12&timezone=Asia%2FJerusalem";
        const r = await fetch(url);
        const j = await r.json();
        if (abort) return;
        const probs: number[] = j?.hourly?.precipitation_probability ?? [];
        const winds: number[] = j?.hourly?.wind_speed_10m ?? [];
        const codes: number[] = j?.hourly?.weather_code ?? [];
        const maxProb = Math.max(0, ...probs);
        const maxWind = Math.max(0, ...winds);
        const hasStorm = codes.some((c) => [95, 96, 99, 75, 82, 65].includes(c));
        setSevere(maxProb >= 60 || maxWind >= 40 || hasStorm);
      } catch {
        /* noop */
      }
    })();
    return () => {
      abort = true;
    };
  }, []);
  return severe;
}

function TasksPage() {
  const { fullName, session } = useAuth();
  const userId = session?.user?.id ?? null;
  const branchId = useActiveBranch();
  const recipes = useCookbookStore((s) => s.recipes);
  const winter = useSevereWeather();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Map<string, LogState>>(new Map());
  const [logDate, setLogDate] = useState<string>("");
  const [openShift, setOpenShift] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    let abort = false;
    (async () => {
      setLoading(true);
      const tree = await fetchTaskTree(branchId);
      const todayLogs = await fetchTodayLogs(branchId);
      const { data: today } = await supabase.rpc("operational_today");
      if (abort) return;
      setShifts(tree.shifts);
      setGroups(tree.groups);
      setTasks(tree.tasks);
      setLogDate((today as string) ?? new Date().toISOString().slice(0, 10));
      const map = new Map<string, LogState>();
      todayLogs.forEach((l: DailyTaskLog) => {
        map.set(l.task_id, {
          completed: l.completed,
          completed_at: l.completed_at,
          completed_by: l.completed_by,
          completed_by_user_id: l.completed_by_user_id,
          comments: l.comments ?? "",
          dirty: false,
        });
      });
      setLogs(map);
      setOpenShift(tree.shifts[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      abort = true;
    };
  }, [branchId]);

  const allTasks = useMemo(() => {
    const list = [...tasks];
    if (winter) list.push(...VIRTUAL_WINTER_TASKS);
    return list;
  }, [tasks, winter]);

  const completedCount = useMemo(
    () => allTasks.filter((t) => logs.get(t.id)?.completed).length,
    [allTasks, logs],
  );

  const toggleTask = (taskId: string) => {
    setLogs((m) => {
      const next = new Map(m);
      const prev = next.get(taskId);
      const completed = !(prev?.completed ?? false);
      next.set(taskId, {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? fullName : prev?.completed_by ?? null,
        completed_by_user_id: completed ? userId : prev?.completed_by_user_id ?? null,
        comments: prev?.comments ?? "",
        dirty: true,
      });
      return next;
    });
  };

  const updateComment = (taskId: string, value: string) => {
    if (value.length > 2000) value = value.slice(0, 2000);
    setLogs((m) => {
      const next = new Map(m);
      const prev = next.get(taskId);
      next.set(taskId, {
        completed: prev?.completed ?? false,
        completed_at: prev?.completed_at ?? null,
        completed_by: prev?.completed_by ?? null,
        completed_by_user_id: prev?.completed_by_user_id ?? null,
        comments: value,
        dirty: true,
      });
      return next;
    });
  };

  const groupsForShift = (shiftId: string) =>
    groups.filter((g) => g.shift_id === shiftId);
  const tasksForGroup = (groupId: string) =>
    allTasks.filter((t) => t.group_id === groupId);

  const syncParLevels = async (changedTaskIds: string[]) => {
    // Find groups whose every task is completed AND has a prep_item_id linked
    const affectedGroupIds = new Set<string>();
    changedTaskIds.forEach((tid) => {
      const t = tasks.find((x) => x.id === tid);
      if (t) affectedGroupIds.add(t.group_id);
    });
    for (const gid of affectedGroupIds) {
      const groupTasks = tasks.filter((t) => t.group_id === gid);
      if (groupTasks.length === 0) continue;
      const allDone = groupTasks.every((t) => logs.get(t.id)?.completed);
      if (!allDone) continue;
      const linked = groupTasks.filter((t) => t.prep_item_id);
      if (linked.length === 0) continue;
      // For each linked prep item, set current_stock = today's target
      const dow = new Date().getDay(); // 0..6 Sun..Sat
      const targetCol = ["target_sun", "target_mon", "target_tue", "target_wed", "target_thu", "target_fri", "target_sat"][dow];
      const { data: prepItems } = await supabase
        .from("prep_items")
        .select("*")
        .in("id", linked.map((t) => t.prep_item_id as string));
      if (!prepItems) continue;
      const today = new Date().toISOString().slice(0, 10);
      for (const pi of prepItems) {
        const target = Number((pi as Record<string, unknown>)[targetCol]) || 0;
        await supabase.from("prep_log").upsert(
          {
            prep_item_id: pi.id,
            log_date: today,
            current_stock: target,
            completed: true,
          },
          { onConflict: "prep_item_id,log_date" },
        );
      }
    }
  };

  const save = async () => {
    if (!branchId) return;
    setSaving(true);
    try {
      const dirtyTaskIds: string[] = [];
      const rows = Array.from(logs.entries())
        .filter(([tid, l]) => l.dirty && !tid.startsWith("__virtual_"))
        .map(([tid, l]) => {
          dirtyTaskIds.push(tid);
          return {
            branch_id: branchId,
            task_id: tid,
            log_date: logDate,
            completed: l.completed,
            completed_at: l.completed_at,
            completed_by: l.completed_by,
            completed_by_user_id: l.completed_by_user_id,
            comments: l.comments,
          };
        });
      await upsertLogs(rows);
      // clear dirty flags
      setLogs((m) => {
        const next = new Map(m);
        dirtyTaskIds.forEach((tid) => {
          const cur = next.get(tid);
          if (cur) next.set(tid, { ...cur, dirty: false });
        });
        return next;
      });
      await syncParLevels(dirtyTaskIds);
      toast.success("השינויים נשמרו בהצלחה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = Array.from(logs.values()).filter((l) => l.dirty).length;
  const total = allTasks.length;
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  // Combine real shifts with virtual winter shift when applicable
  const displayShifts: Array<{ id: string; name: string }> = [
    ...shifts.map((s) => ({ id: s.id, name: s.name })),
    ...(winter ? [{ id: VIRTUAL_WINTER_SHIFT_ID, name: "היערכות חורף" }] : []),
  ];

  const displayGroupsForShift = (shiftId: string) => {
    if (shiftId === VIRTUAL_WINTER_SHIFT_ID) {
      return [
        {
          id: VIRTUAL_WINTER_GROUP_ID,
          branch_id: "",
          shift_id: VIRTUAL_WINTER_SHIFT_ID,
          name: "משימות בטיחות וחורף",
          sort_order: 0,
          active: true,
        },
      ];
    }
    return groupsForShift(shiftId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin ml-2" /> טוען משימות…
      </div>
    );
  }

  const openRecipe = recipeOpen ? recipes.find((r) => r.id === recipeOpen) : null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pb-32" dir="rtl">
      {/* Sticky progress */}
      <div className="sticky top-20 sm:top-24 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">משימות יומיות</div>
          <div className="font-display text-sm font-bold">
            <span className="text-neon text-glow-neon">{completedCount}</span>
            <span className="text-muted-foreground">/{total}</span>{" "}
            <span className="text-foreground">משימות הושלמו</span>
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-card border border-border overflow-hidden">
          <div
            className="h-full bg-neon transition-all duration-500"
            style={{ width: `${pct}%`, boxShadow: "0 0 12px hsl(var(--neon))" }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {displayShifts.map((shift) => {
          const isShiftOpen = openShift === shift.id;
          const shiftGroups = displayGroupsForShift(shift.id);
          const shiftTasks = shiftGroups.flatMap((g) => tasksForGroup(g.id));
          const shiftDone = shiftTasks.filter((t) => logs.get(t.id)?.completed).length;
          const isVirtual = shift.id === VIRTUAL_WINTER_SHIFT_ID;
          return (
            <div
              key={shift.id}
              className={`border rounded-lg overflow-hidden ${isVirtual ? "border-sky-500/50 bg-sky-500/5" : "border-border bg-card/40"}`}
            >
              <button
                type="button"
                onClick={() => setOpenShift(isShiftOpen ? null : shift.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 text-right hover:bg-card/60 transition"
              >
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${isShiftOpen ? "rotate-180" : ""}`}
                />
                <div className="flex-1 text-right">
                  <div className="font-display text-lg font-bold flex items-center justify-end gap-2">
                    {isVirtual && <CloudSnow className="h-5 w-5 text-sky-400" />}
                    {shift.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {shiftDone}/{shiftTasks.length} משימות
                  </div>
                </div>
              </button>

              {isShiftOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {shiftGroups.map((g) => {
                    const isGroupOpen = openGroup === g.id;
                    const gTasks = tasksForGroup(g.id);
                    const gDone = gTasks.filter((t) => logs.get(t.id)?.completed).length;
                    const gPct =
                      gTasks.length === 0
                        ? 0
                        : Math.round((gDone / gTasks.length) * 100);
                    return (
                      <div key={g.id} className="bg-background/30">
                        <button
                          type="button"
                          onClick={() => setOpenGroup(isGroupOpen ? null : g.id)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-3 text-right hover:bg-card/40 transition"
                        >
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isGroupOpen ? "rotate-180" : ""}`}
                          />
                          <div className="flex-1 text-right min-w-0">
                            <div className="text-sm font-bold truncate">{g.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-2">
                              <span>
                                {gDone}/{gTasks.length}
                              </span>
                              <div className="w-16 h-1 rounded-full bg-card border border-border overflow-hidden">
                                <div
                                  className={`h-full transition-all ${gPct === 100 ? "bg-emerald-400" : "bg-neon"}`}
                                  style={{ width: `${gPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          {gPct === 100 && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          )}
                        </button>

                        {isGroupOpen && (
                          <ul className="border-t border-border/60 divide-y divide-border/60">
                            {gTasks.map((t) => {
                              const log = logs.get(t.id);
                              const done = log?.completed ?? false;
                              const stamp =
                                done && log?.completed_at
                                  ? formatStamp(log.completed_by, log.completed_at)
                                  : null;
                              const recipe = t.recipe_id
                                ? recipes.find((r) => r.id === t.recipe_id)
                                : null;
                              return (
                                <li key={t.id} className="px-5 py-4 bg-background/40">
                                  <div className="flex items-start justify-between gap-3">
                                    <label className="flex items-start gap-3 flex-1 cursor-pointer min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={done}
                                        onChange={() => toggleTask(t.id)}
                                        className="mt-1 h-5 w-5 accent-[hsl(var(--neon))] shrink-0"
                                      />
                                      <div className="flex-1 min-w-0 text-right">
                                        <div
                                          className={`text-sm font-bold ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
                                        >
                                          {t.name}
                                        </div>
                                        {stamp && (
                                          <div className="text-[11px] text-neon mt-1">
                                            {stamp}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                    {recipe && (
                                      <button
                                        type="button"
                                        onClick={() => setRecipeOpen(recipe.id)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-neon hover:bg-card transition shrink-0"
                                        aria-label="פתיחת מתכון"
                                        title="פתיחת מתכון"
                                      >
                                        <BookOpen className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="mt-2 pr-8">
                                    <label className="block text-[10px] text-muted-foreground text-right mb-1">
                                      הוספת הערה למשימה
                                    </label>
                                    <textarea
                                      value={log?.comments ?? ""}
                                      onChange={(e) =>
                                        updateComment(t.id, e.target.value)
                                      }
                                      maxLength={2000}
                                      rows={2}
                                      placeholder="הערה אופציונלית…"
                                      className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-xs text-right resize-y"
                                    />
                                    <div className="text-[10px] text-muted-foreground text-left mt-0.5">
                                      {(log?.comments ?? "").length}/2000
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                            {gTasks.length === 0 && (
                              <li className="px-5 py-4 text-center text-xs text-muted-foreground">
                                אין משימות בקבוצה זו.
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Persistent save button */}
      <div className="fixed bottom-4 inset-x-0 z-40 px-4 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={save}
          disabled={saving || dirtyCount === 0}
          className="pointer-events-auto inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-6 py-3 rounded-full glow-neon disabled:opacity-60 disabled:cursor-not-allowed transition shadow-2xl"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          שמירת שינויים
          {dirtyCount > 0 && (
            <span className="bg-background/30 px-2 py-0.5 rounded-full text-[11px]">
              {dirtyCount}
            </span>
          )}
        </button>
      </div>

      {/* Recipe drawer */}
      <Sheet open={!!openRecipe} onOpenChange={(o) => !o && setRecipeOpen(null)}>
        <SheetContent
          side="left"
          className="bg-card border-r border-border w-[92%] sm:w-[480px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-right font-display text-xl">
              {openRecipe?.nameHebrew}
            </SheetTitle>
          </SheetHeader>
          {openRecipe && (
            <div className="mt-4 space-y-4 text-right" dir="rtl">
              {openRecipe.essenceHebrew && (
                <p className="text-sm text-muted-foreground">
                  {openRecipe.essenceHebrew}
                </p>
              )}
              {openRecipe.baseYieldHebrew && (
                <div className="text-xs text-neon font-bold">
                  תפוקה: {openRecipe.baseYieldHebrew}
                </div>
              )}
              {openRecipe.ingredients.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    מרכיבים
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {openRecipe.ingredients.map((i, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between border-b border-border/40 py-1"
                      >
                        <span className="text-muted-foreground">
                          {i.quantity} {i.unit}
                        </span>
                        <span className="font-bold">{i.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {openRecipe.instructionsHebrew && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    הוראות
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {openRecipe.instructionsHebrew}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatStamp(name: string | null, iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `בוצע על ידי ${name ?? "—"}, בתאריך ${date} בשעה ${time}`;
}
