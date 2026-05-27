import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, Loader2, CheckCircle2, CloudSnow, Pencil, Save, AlertTriangle } from "lucide-react";
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
  extractIngredientName,
  type Shift,
  type TaskGroup,
  type Task,
  type DailyTaskLog,
} from "@/lib/tasks";
import { useCookbookStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { QuickEditTaskDialog } from "@/components/QuickEditTaskDialog";
import { triggerHaptic } from "@/lib/haptics";
import { celebrate } from "@/lib/celebrate";
import { useNotebookStore } from "@/lib/notebook-store";
import { TaskPhotoButton } from "@/components/TaskPhotoEvidence";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type LogState = {
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_user_id: string | null;
  comments: string;
  photo_url: string | null;
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
    ingredient_name: null,
    is_purchased_good: false,
    requires_photo: false,
    parent_task_id: null,
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
    ingredient_name: null,
    is_purchased_good: false,
    requires_photo: false,
    parent_task_id: null,
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
    ingredient_name: null,
    is_purchased_good: false,
    requires_photo: false,
    parent_task_id: null,
  },
];

// Map a group name to a contextual emoji prefix. Matches by exact or partial
// name so renamed groups keep visual scanning intact.
const GROUP_EMOJI_MAP: Array<{ match: RegExp; emoji: string }> = [
  { match: /בקרת מלאי והעמדת סירים/, emoji: "📋" },
  { match: /הכנות פס/, emoji: "🔪" },
  { match: /הכנת רטבים|^רטבים$/, emoji: "🍅" },
  { match: /מטבלים|דיפים/, emoji: "🥣" },
  { match: /איולים/, emoji: "🧄" },
  { match: /עלים|ירוקים/, emoji: "🥬" },
  { match: /סקוויזרים.*מלוח|מלוח.*סקוויזר/, emoji: "🧂" },
  { match: /סקוויזרים.*מתוק|מתוק.*סקוויזר/, emoji: "🍯" },
  { match: /שקיות|מארזים|טייק/, emoji: "🛍️" },
  { match: /תפעול|ארגון המטבח/, emoji: "📦" },
  { match: /ספקים|לוגיסטיק|מחסן/, emoji: "🚚" },
  { match: /ניקיון.*ציוד.*מכונ|מכונות|כיורים/, emoji: "🧽" },
  { match: /ניקיון|תחזוק/, emoji: "🧹" },
  { match: /פס הכנות|ניהול מלאי/, emoji: "🔄" },
  { match: /מסעדה|ישיבת חוץ/, emoji: "🪑" },
  { match: /אדמיניסטרצי|אשפה|סגירת משמרת/, emoji: "🗑️" },
  { match: /יציאה|סגירה סופית|צ.?ק ליסט/, emoji: "🔒" },
  { match: /הכנ/, emoji: "🍳" },
  { match: /השלמ|סופר/, emoji: "🛒" },
];

function emojiForGroup(name: string): string {
  // Already starts with emoji? Keep as-is.
  if (/^\p{Extended_Pictographic}/u.test(name)) return "";
  for (const { match, emoji } of GROUP_EMOJI_MAP) {
    if (match.test(name)) return emoji;
  }
  return "📌";
}

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
  const { fullName, session, isSuperAdmin } = useAuth();
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
  const [recipeOpen, setRecipeOpen] = useState<string | null>(null);
  const [pulsingTaskId, setPulsingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Refs for smooth scroll-into-view on accordion open
  const shiftRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const groupRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    if (!openShift) return;
    const el = shiftRefs.current.get(openShift);
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [openShift]);

  useEffect(() => {
    if (!openGroup) return;
    const el = groupRefs.current.get(openGroup);
    if (el) {
      // Wait one frame so the expanded content is in the DOM before scrolling
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [openGroup]);


  const reloadLogs = async (branch: string, expectedDate?: string) => {
    const todayLogs = await fetchTodayLogs(branch);
    const { data: today } = await supabase.rpc("operational_today");
    const dateStr = (today as string) ?? new Date().toISOString().slice(0, 10);
    setLogDate(dateStr);
    const map = new Map<string, LogState>();
    todayLogs.forEach((l: DailyTaskLog) => {
      map.set(l.task_id, {
        completed: l.completed,
        completed_at: l.completed_at,
        completed_by: l.completed_by,
        completed_by_user_id: l.completed_by_user_id,
        comments: l.comments ?? "",
        photo_url: l.photo_url ?? null,
      });
    });
    setLogs(map);
    return dateStr;
  };

  useEffect(() => {
    if (!branchId) return;
    let abort = false;
    (async () => {
      setLoading(true);
      const tree = await fetchTaskTree(branchId);
      if (abort) return;
      setShifts(tree.shifts);
      setGroups(tree.groups);
      setTasks(tree.tasks);
      await reloadLogs(branchId);
      setOpenShift(tree.shifts[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Auto-refresh when the operational day rolls over (5am Asia/Jerusalem),
  // or when the user returns to the tab after the boundary.
  useEffect(() => {
    if (!branchId) return;
    const check = async () => {
      const { data: today } = await supabase.rpc("operational_today");
      const dateStr = today as string;
      if (dateStr && dateStr !== logDate) {
        await reloadLogs(branchId);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => void check(), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, logDate]);



  const allTasks = useMemo(() => {
    const list = [...tasks];
    if (winter) list.push(...VIRTUAL_WINTER_TASKS);
    return list;
  }, [tasks, winter]);

  const hasChildren = useMemo(() => {
    const s = new Set<string>();
    for (const t of allTasks) if (t.parent_task_id) s.add(t.parent_task_id);
    return s;
  }, [allTasks]);

  const countableTasks = useMemo(
    () => allTasks.filter((t) => !hasChildren.has(t.id)),
    [allTasks, hasChildren],
  );

  const completedCount = useMemo(
    () => countableTasks.filter((t) => logs.get(t.id)?.completed).length,
    [countableTasks, logs],
  );

  const groupsForShift = (shiftId: string) =>
    groups.filter((g) => g.shift_id === shiftId);
  const tasksForGroup = (groupId: string) =>
    allTasks
      .filter((t) => t.group_id === groupId && !t.parent_task_id)
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const subtasksFor = (parentId: string) =>
    allTasks
      .filter((t) => t.parent_task_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "he"));

  const syncParLevelsForTask = async (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const groupTasks = tasks.filter((x) => x.group_id === t.group_id);
    if (groupTasks.length === 0) return;
    const allDone = groupTasks.every((x) => logs.get(x.id)?.completed);
    if (!allDone) return;
    const linked = groupTasks.filter((x) => x.prep_item_id);
    if (linked.length === 0) return;
    const dow = new Date().getDay();
    const targetCol = ["target_sun", "target_mon", "target_tue", "target_wed", "target_thu", "target_fri", "target_sat"][dow];
    const { data: prepItems } = await supabase
      .from("prep_items")
      .select("*")
      .in("id", linked.map((x) => x.prep_item_id as string));
    if (!prepItems) return;
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
  };

  // Persist a single task's log row immediately.
  const persistTask = async (taskId: string, state: LogState) => {
    if (!branchId || taskId.startsWith("__virtual_")) return;
    try {
      await upsertLogs([
        {
          branch_id: branchId,
          task_id: taskId,
          log_date: logDate,
          completed: state.completed,
          completed_at: state.completed_at,
          completed_by: state.completed_by,
          completed_by_user_id: state.completed_by_user_id,
          comments: state.comments,
          photo_url: state.photo_url,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    }
  };

  const toggleTask = (taskId: string) => {
    const prev = logs.get(taskId);
    const completed = !(prev?.completed ?? false);
    const task = allTasks.find((x) => x.id === taskId);
    // Block completion if photo is required and missing
    if (completed && task?.requires_photo && !prev?.photo_url) {
      toast.error("יש להעלות תמונה לפני סימון המשימה כבוצעה");
      return;
    }
    const nextState: LogState = {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? fullName : prev?.completed_by ?? null,
      completed_by_user_id: completed ? userId : prev?.completed_by_user_id ?? null,
      comments: prev?.comments ?? "",
      photo_url: prev?.photo_url ?? null,
    };
    setLogs((m) => {
      const next = new Map(m);
      next.set(taskId, nextState);
      return next;
    });
    if (completed) {
      setPulsingTaskId(taskId);
      setTimeout(() => setPulsingTaskId((cur) => (cur === taskId ? null : cur)), 650);
      triggerHaptic("light");
    }
    const taskName = task?.name ?? "";
    void persistTask(taskId, nextState).then(() => syncParLevelsForTask(taskId));
    if (nextState.completed && taskName) {
      void scanNotebookForMatch(taskName);
    }
  };

  const handlePhotoUploaded = (taskId: string, path: string) => {
    const prev = logs.get(taskId);
    const nextState: LogState = {
      completed: prev?.completed ?? false,
      completed_at: prev?.completed_at ?? null,
      completed_by: prev?.completed_by ?? null,
      completed_by_user_id: prev?.completed_by_user_id ?? null,
      comments: prev?.comments ?? "",
      photo_url: path,
    };
    setLogs((m) => {
      const next = new Map(m);
      next.set(taskId, nextState);
      return next;
    });
    void persistTask(taskId, nextState);
  };

  // Lightweight keyword matching against active notebook tasks.
  const scanNotebookForMatch = async (taskName: string) => {
    const stop = new Set([
      "של", "את", "על", "עם", "אל", "כל", "זה", "זו", "או", "גם",
      "ל", "מ", "ב", "ה", "ו", "ש",
    ]);
    const words = taskName
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !stop.has(w));
    if (words.length === 0) return;
    try {
      const { data } = await supabase
        .from("notebook_items")
        .select("id,text,list_key,done,archived_at")
        .is("archived_at", null)
        .eq("done", false)
        .eq("list_key", "tasks");
      const rows = (data ?? []) as Array<{ id: string; text: string }>;
      const match = rows.find((r) => words.some((w) => r.text.includes(w)));
      if (!match) return;
      toast(`נמצאה משימה תואמת בפנקס: ${match.text}`, {
        description: "לסמן כבוצעה?",
        action: {
          label: "סמן כבוצע",
          onClick: async () => {
            const { error } = await supabase
              .from("notebook_items")
              .update({ done: true })
              .eq("id", match.id);
            if (error) {
              toast.error("עדכון פנקס נכשל");
            } else {
              toast.success("המשימה בפנקס סומנה כבוצעה");
            }
          },
        },
        duration: 8000,
      });
    } catch {
      /* noop */
    }
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
        photo_url: prev?.photo_url ?? null,
      });
      return next;
    });
  };

  const saveComment = async (taskId: string) => {
    const state = logs.get(taskId);
    if (!state) return;
    await persistTask(taskId, state);
    triggerHaptic("light");
    toast.success("הערה נשמרה");
  };

  const reportShortage = async (taskId: string) => {
    const t = allTasks.find((x) => x.id === taskId);
    if (!t) return;
    if (!t.is_purchased_good) {
      toast.error("פריט זה אינו מוגדר כסחורה לרכישה");
      return;
    }
    const itemName = extractIngredientName({
      name: t.name,
      ingredient_name: t.ingredient_name,
    });
    try {
      await useNotebookStore.getState().addItem("shortages", itemName, "urgent");
      triggerHaptic("light");
      toast.success("דווח לחוסרים בהצלחה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "דיווח חוסר נכשל");
    }
  };

  const total = countableTasks.length;
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  const prevPctRef = useRef(pct);
  useEffect(() => {
    if (total > 0 && pct === 100 && prevPctRef.current < 100) {
      void celebrate();
    }
    prevPctRef.current = pct;
  }, [pct, total]);

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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pb-10" dir="rtl">
      {/* Sticky progress */}
      <div className="sticky top-20 sm:top-24 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground shrink-0">משימות יומיות</div>
          <div className="font-display text-sm font-bold flex items-baseline gap-1.5">
            <bdi className="tabular-nums">
              <span className="text-neon text-glow-neon">{completedCount}</span>
              <span className="text-muted-foreground">/{total}</span>
            </bdi>
            <span className="text-foreground">משימות הושלמו</span>
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-card border border-border overflow-hidden">
          <div
            className="h-full bg-neon transition-all duration-500"
            style={{ width: `${pct}%`, boxShadow: "0 0 12px var(--neon)" }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`התקדמות יומית: ${pct} אחוז`}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {displayShifts.map((shift) => {
          const isShiftOpen = openShift === shift.id;
          const shiftGroups = displayGroupsForShift(shift.id);
          const shiftTopTasks = shiftGroups.flatMap((g) => tasksForGroup(g.id));
          const shiftTasks = shiftTopTasks.flatMap((t) => {
            const subs = subtasksFor(t.id);
            return subs.length > 0 ? subs : [t];
          });
          const shiftDone = shiftTasks.filter((t) => logs.get(t.id)?.completed).length;
          const isVirtual = shift.id === VIRTUAL_WINTER_SHIFT_ID;
          return (
            <div
              key={shift.id}
              ref={(el) => {
                shiftRefs.current.set(shift.id, el);
              }}
              className={`scroll-mt-36 border rounded-lg overflow-hidden ${isVirtual ? "border-info/50 bg-info/5" : "border-border bg-card/40"}`}
            >

              <button
                type="button"
                onClick={() => setOpenShift(isShiftOpen ? null : shift.id)}
                aria-expanded={isShiftOpen}
                aria-label={`${shift.name} — ${shiftDone} מתוך ${shiftTasks.length} משימות`}
                className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 hover:bg-card/60 transition"
              >
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${isShiftOpen ? "rotate-180" : ""}`}
                />
                <div className="text-center min-w-0">
                  <div className="font-display text-lg font-bold flex items-center justify-center gap-2 leading-tight">
                    {isVirtual && <CloudSnow className="h-5 w-5 text-info shrink-0" />}
                    <span className="truncate">{shift.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                    <bdi>{shiftDone}/{shiftTasks.length}</bdi> משימות
                  </div>
                </div>
                <span className="w-5" aria-hidden />
              </button>


              {isShiftOpen && (
                <div className="p-3 sm:p-4 space-y-4 bg-background/20">
                  {shiftGroups.map((g) => {
                    const isGroupOpen = openGroup === g.id;
                    const gTasks = tasksForGroup(g.id);
                    const gCountable = gTasks.flatMap((t) => {
                      const subs = subtasksFor(t.id);
                      return subs.length > 0 ? subs : [t];
                    });
                    const gDone = gCountable.filter((t) => logs.get(t.id)?.completed).length;
                    const gPct =
                      gCountable.length === 0
                        ? 0
                        : Math.round((gDone / gCountable.length) * 100);
                    const emoji = emojiForGroup(g.name);
                    return (
                      <div
                        key={g.id}
                        ref={(el) => {
                          groupRefs.current.set(g.id, el);
                        }}
                        className="scroll-mt-36 rounded-xl bg-gray-800/80 border border-border overflow-hidden shadow-sm mb-2"
                      >

                        <button
                          type="button"
                          onClick={() => setOpenGroup(isGroupOpen ? null : g.id)}
                          aria-expanded={isGroupOpen}
                          aria-label={`${g.name} — ${gDone} מתוך ${gCountable.length}`}
                          className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-5 py-4 hover:bg-gray-800 transition"
                        >
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isGroupOpen ? "rotate-180" : ""}`}
                          />
                          <div className="text-center min-w-0">
                            <div className="text-sm font-bold leading-snug break-words flex items-center justify-center gap-1.5 text-foreground">
                              {gPct === 100 && (
                                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                              )}
                              <span>
                                {emoji ? `${emoji} ` : ""}
                                {g.name}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-2">
                              <bdi className="tabular-nums">{gDone}/{gCountable.length}</bdi>
                              <div className="w-20 h-1 rounded-full bg-background/60 border border-border overflow-hidden">
                                <div
                                  className={`h-full transition-all ${gPct === 100 ? "bg-success" : "bg-neon"}`}
                                  style={{ width: `${gPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <span className="w-4" aria-hidden />
                        </button>




                        {isGroupOpen && (
                          <div className="border-t border-border/60 px-3 sm:px-4 py-4 flex flex-col gap-3 bg-background/30">
                            {gTasks.map((t) => {
                              const subs = subtasksFor(t.id);
                              if (subs.length > 0) {
                                const subsDone = subs.filter((s) => logs.get(s.id)?.completed).length;
                                const allDone = subsDone === subs.length;
                                return (
                                  <div
                                    key={t.id}
                                    className={`rounded-xl border p-4 transition-all duration-300 ${
                                      allDone
                                        ? "bg-card/40 border-border"
                                        : "bg-card border-pink-500/50 shadow-[0_0_4px_rgba(236,72,153,0.3)]"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                      <div className={`text-sm font-bold leading-snug flex-1 text-right ${allDone ? "text-gray-500" : "text-foreground"}`}>
                                        {t.name}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                        <bdi>{subsDone}/{subs.length}</bdi>
                                      </div>
                                      {isSuperAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingTask(t)}
                                          className="p-1.5 rounded-md text-muted-foreground hover:text-neon hover:bg-accent transition shrink-0"
                                          aria-label={`עריכת משימה: ${t.name}`}
                                          title="עריכה מהירה"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="space-y-3">
                                      {subs.map((s) => {
                                        const slog = logs.get(s.id);
                                        const sdone = slog?.completed ?? false;
                                        const sstamp = sdone && slog?.completed_at
                                          ? formatStamp(slog.completed_by, slog.completed_at)
                                          : null;
                                        return (
                                          <div
                                            key={s.id}
                                            className={`rounded-lg border p-3 ${sdone ? "bg-background/30 border-border" : "bg-background/50 border-pink-500/30"}`}
                                          >
                                            <label className="flex items-start gap-3 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={sdone}
                                                onChange={() => toggleTask(s.id)}
                                                aria-label={`סמן כבוצע: ${s.name}`}
                                                className={`mt-0.5 h-5 w-5 shrink-0 ${sdone ? "accent-[#39FF14]" : "accent-primary"}`}
                                              />
                                              <div className="flex-1 min-w-0 text-right">
                                                <div className={`text-sm font-bold leading-snug ${sdone ? "line-through text-gray-500" : "text-foreground"}`}>
                                                  {s.name}
                                                </div>
                                                {sstamp && (
                                                  <div className="text-[11px] text-primary/90 mt-1 leading-snug">{sstamp}</div>
                                                )}
                                              </div>
                                            </label>
                                            {s.requires_photo && branchId && (
                                              <div className="mt-2 rounded-lg border border-pink-500/30 bg-pink-500/5 p-2.5">
                                                <div className="text-[11px] text-pink-200/90 font-bold mb-2 text-right">
                                                  📷 נדרשת תמונת ביצוע
                                                </div>
                                                <TaskPhotoButton
                                                  taskId={s.id}
                                                  branchId={branchId}
                                                  userId={userId}
                                                  existingPath={slog?.photo_url ?? null}
                                                  onUploaded={(path: string) => handlePhotoUploaded(s.id, path)}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              const log = logs.get(t.id);
                              const done = log?.completed ?? false;
                              const isPulsing = pulsingTaskId === t.id;
                              const stamp =
                                done && log?.completed_at
                                  ? formatStamp(log.completed_by, log.completed_at)
                                  : null;
                              const recipe = t.recipe_id
                                ? recipes.find((r) => r.id === t.recipe_id)
                                : null;
                              return (
                                <div
                                  key={t.id}
                                  className={`rounded-xl border p-4 transition-all duration-300 ${
                                    done
                                      ? "bg-card/40 border-border"
                                      : "bg-card border-pink-500/50 shadow-[0_0_4px_rgba(236,72,153,0.3)] hover:border-pink-500/80 hover:shadow-[0_0_14px_rgba(236,72,153,0.5)]"
                                  } ${isPulsing ? "neon-pulse-card" : ""}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <label className="flex items-start gap-3 flex-1 cursor-pointer min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={done}
                                        onChange={() => toggleTask(t.id)}
                                        aria-label={`סמן כבוצע: ${t.name}`}
                                        className={`mt-0.5 h-5 w-5 shrink-0 transition-all duration-200 ${
                                          done ? "accent-[#39FF14]" : "accent-primary"
                                        } ${isPulsing ? "neon-check" : ""}`}
                                      />
                                      <div className="flex-1 min-w-0 text-right">
                                        <div
                                          className={`text-sm font-bold leading-snug transition-all duration-300 ${done ? "line-through text-gray-500" : "text-foreground"}`}
                                        >
                                          {t.name}
                                        </div>
                                        {stamp && (
                                          <div className="text-[11px] text-primary/90 mt-1 leading-snug">
                                            {stamp}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                    {recipe && (
                                      <button
                                        type="button"
                                        onClick={() => setRecipeOpen(recipe.id)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition shrink-0"
                                        aria-label={`פתיחת מתכון: ${recipe.nameHebrew ?? t.name}`}
                                        title="פתיחת מתכון"
                                      >
                                        <BookOpen className="h-4 w-4" />
                                      </button>
                                    )}
                                    {isSuperAdmin && !t.id.startsWith("__virtual_") && (
                                      <button
                                        type="button"
                                        onClick={() => setEditingTask(t)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-neon hover:bg-accent transition shrink-0"
                                        aria-label={`עריכת משימה: ${t.name}`}
                                        title="עריכה מהירה"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>

                                  {t.requires_photo && !t.id.startsWith("__virtual_") && branchId && (
                                    <div className="mt-3 rounded-lg border border-pink-500/30 bg-pink-500/5 p-3">
                                      <div className="text-[11px] text-pink-200/90 font-bold mb-2 text-right">
                                        📷 משימה זו דורשת תמונת ביצוע
                                      </div>
                                      <TaskPhotoButton
                                        taskId={t.id}
                                        branchId={branchId}
                                        userId={userId}
                                        existingPath={log?.photo_url ?? null}
                                        onUploaded={(path: string) => handlePhotoUploaded(t.id, path)}
                                      />
                                    </div>
                                  )}


                                  <div className="mt-3">
                                    <label
                                      htmlFor={`note-${t.id}`}
                                      className="block text-[11px] text-muted-foreground text-right mb-1"
                                    >
                                      הוספת הערה למשימה
                                    </label>
                                    <textarea
                                      id={`note-${t.id}`}
                                      value={log?.comments ?? ""}
                                      onChange={(e) =>
                                        updateComment(t.id, e.target.value)
                                      }
                                      maxLength={2000}
                                      rows={2}
                                      placeholder="הערה אופציונלית…"
                                      className="w-full bg-background/60 border border-border focus:border-primary/60 focus:outline-none rounded-md px-2 py-1.5 text-xs text-right resize-y transition"
                                    />
                                    <div className="text-[10px] text-muted-foreground text-end mt-0.5 tabular-nums" dir="ltr">
                                      {(log?.comments ?? "").length}/2000
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                                      {t.is_purchased_good ? (
                                        <button
                                          type="button"
                                          onClick={() => reportShortage(t.id)}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 transition"
                                          title="דווח כחוסר"
                                        >
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          דווח כחוסר
                                        </button>
                                      ) : (
                                        <span />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => saveComment(t.id)}
                                        disabled={!t.id || t.id.startsWith("__virtual_")}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-neon/90 text-black hover:bg-neon transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(57,255,20,0.4)]"
                                        title="שמור הערה"
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                        שמור הערה
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {gTasks.length === 0 && (
                              <div className="px-5 py-4 text-center text-xs text-muted-foreground">
                                אין משימות בקבוצה זו.
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenGroup(null);
                                requestAnimationFrame(() => {
                                  groupRefs.current
                                    .get(g.id)
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                });
                              }}
                              aria-label={`סגור קטגוריה: ${g.name}`}
                              className="w-full mt-4 py-3 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-800/50"
                            >
                              <ChevronUp className="h-4 w-4" />
                              <span>סגור קטגוריה</span>
                            </button>
                          </div>
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


      {/* Super-admin quick edit */}
      <QuickEditTaskDialog
        task={editingTask}
        branchId={branchId}
        onClose={() => setEditingTask(null)}
        onSaved={(updated) =>
          setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        }
        onDeleted={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
      />

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
