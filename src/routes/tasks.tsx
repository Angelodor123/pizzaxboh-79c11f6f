import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, BookOpen, Loader2, CheckCircle2, CloudSnow, Pencil, Save, AlertTriangle, GripVertical, Flame, Sparkles, MessageSquarePlus } from "lucide-react";
import { notifyTaskComment } from "@/lib/task-comment-push.functions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/skeletons";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toastError } from "@/lib/error-messages";
import { runOrQueue } from "@/lib/offline-queue";
import { QK } from "@/lib/queue-handlers";
import { extractIngredientFromTitle } from "@/lib/ingredient-extract.functions";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  
  extractIngredientName,
  isTaskActiveOn,
  compareTasks,
  type Shift,
  type TaskGroup,
  type Task,
  type DailyTaskLog,
} from "@/lib/tasks";
import { useCookbookStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBranchIdSync } from "@/lib/current-branch";
import { QuickEditTaskDialog } from "@/components/QuickEditTaskDialog";

import { triggerHaptic } from "@/lib/haptics";
import { celebrate } from "@/lib/celebrate";
import { useNotebookStore } from "@/lib/notebook-store";
import { TaskPhotoButton } from "@/components/TaskPhotoEvidence";

type TasksSearch = { edit?: string };

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: 'משימות — Pizza X' },
      { name: "description", content: 'ניהול משימות יומיות לצוות המשמרת.' },
    
      { property: "og:title", content: 'משימות — Pizza X' },
      { property: "og:description", content: 'ניהול משימות יומיות לצוות המשמרת.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/tasks" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/tasks" }],
  }),
  component: TasksPage,
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
});

type LogState = {
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_user_id: string | null;
  comments: string;
  photo_url: string | null;
  admin_verification_status: "none" | "verified" | "rejected";
  rejection_note: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
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
    recurrence_type: "daily",
    recurrence_day: null,
    shift_id: null,
    is_urgent: false,
    manual_order_index: 0,
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
    recurrence_type: "daily",
    recurrence_day: null,
    shift_id: null,
    is_urgent: false,
    manual_order_index: 0,
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
    recurrence_type: "daily",
    recurrence_day: null,
    shift_id: null,
    is_urgent: false,
    manual_order_index: 0,
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

function SortableTaskItem({
  id,
  showHandle,
  children,
}: {
  id: string;
  showHandle: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !showHandle,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style} className="pl-9">
      {showHandle && (
        <button
          type="button"
          aria-label="גרור לסידור"
          title="גרור לסידור מחדש"
          className="absolute top-1/2 -translate-y-1/2 left-1 z-20 h-9 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-neon hover:bg-accent/40 active:bg-accent/60 cursor-grab active:cursor-grabbing touch-none select-none"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden className="leading-none text-[18px] font-bold tracking-[1px]">⠿</span>
        </button>
      )}
      {children}
    </div>
  );
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
  const [extractingTaskId, setExtractingTaskId] = useState<string | null>(null);
  const [confirmShortage, setConfirmShortage] = useState<
    | { taskId: string; name: string; catalogProductId: string | null; unit: string | null }
    | null
  >(null);
  const extractFn = useServerFn(extractIngredientFromTitle);
  const [rejectingTask, setRejectingTask] = useState<{ id: string; name: string } | null>(null);
  const [rejectNoteDraft, setRejectNoteDraft] = useState("");
  const [expandedCompleted, setExpandedCompleted] = useState<Map<string, boolean>>(new Map());
  const [commentOpenMap, setCommentOpenMap] = useState<Map<string, boolean>>(new Map());
  const groupCompletionRef = useRef<Map<string, number>>(new Map());
  const notifyCommentFn = useServerFn(notifyTaskComment);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGroupDragEnd = (groupId: string) => async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const current = tasksForGroup(groupId);
    const oldIndex = current.findIndex((t) => t.id === active.id);
    const newIndex = current.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(current, oldIndex, newIndex);
    // Optimistic state update with new manual_order_index
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      reordered.forEach((t, idx) => {
        const existing = map.get(t.id);
        if (existing) map.set(t.id, { ...existing, manual_order_index: idx + 1 });
      });
      return Array.from(map.values());
    });
    triggerHaptic("light");
    // Persist bulk update — skip virtual placeholders
    const updates = reordered
      .filter((t) => !t.id.startsWith("__virtual_"))
      .map((t, idx) =>
        supabase.from("tasks").update({ manual_order_index: idx + 1 }).eq("id", t.id),
      );
    try {
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) toast.error("שמירת הסדר נכשלה: " + failed.error.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת הסדר נכשלה");
    }
  };


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
        admin_verification_status: l.admin_verification_status ?? "none",
        rejection_note: l.rejection_note ?? null,
        verified_by_name: null,
        verified_at: l.verified_at ?? null,
      });
    });
    setLogs(map);
    return dateStr;
  };

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const reloadAll = useCallback(async () => {
    if (!branchId) return;
    try {
      const tree = await fetchTaskTree(branchId);
      setShifts(tree.shifts);
      setGroups(tree.groups);
      setTasks(tree.tasks);
      await reloadLogs(branchId);
      setOpenShift((prev) => prev ?? tree.shifts[0]?.id ?? null);
    } catch (err) {
      toastError(err, "טעינת המשימות נכשלה.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    let abort = false;
    (async () => {
      setLoading(true);
      await reloadAll();
      if (abort) return;
      setLoading(false);
    })();
    return () => {
      abort = true;
    };
  }, [branchId, reloadAll]);

  // Open Quick-Edit when arriving with ?edit=<taskId> (e.g. from GlobalSearch)
  useEffect(() => {
    if (!search.edit || tasks.length === 0) return;
    const found = tasks.find((t) => t.id === search.edit);
    if (found) {
      setEditingTask(found);
      navigate({ search: {} as any, replace: true });
    }
  }, [search.edit, tasks, navigate]);

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
    const today = new Date();
    const list = tasks.filter((t) => isTaskActiveOn(t, today));
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

  const DIRECT_PREFIX = "__direct_shift__";
  const groupsForShift = (shiftId: string) => {
    const real = groups.filter((g) => g.shift_id === shiftId);
    const hasDirect = allTasks.some((t) => t.shift_id === shiftId && !t.group_id && !t.parent_task_id);
    if (!hasDirect) return real;
    const synthetic: TaskGroup = {
      id: `${DIRECT_PREFIX}${shiftId}`,
      branch_id: "",
      shift_id: shiftId,
      name: "משימות כלליות",
      sort_order: -1,
      active: true,
    };
    return [synthetic, ...real];
  };
  const tasksForGroup = (groupId: string) => {
    if (groupId.startsWith(DIRECT_PREFIX)) {
      const sid = groupId.slice(DIRECT_PREFIX.length);
      return allTasks
        .filter((t) => t.shift_id === sid && !t.group_id && !t.parent_task_id)
        .sort(compareTasks);
    }
    return allTasks
      .filter((t) => t.group_id === groupId && !t.parent_task_id)
      .sort(compareTasks);
  };
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
    const row = {
      branch_id: branchId,
      task_id: taskId,
      log_date: logDate,
      completed: state.completed,
      completed_at: state.completed_at,
      completed_by: state.completed_by,
      completed_by_user_id: state.completed_by_user_id,
      comments: state.comments,
      photo_url: state.photo_url,
      admin_verification_status: state.admin_verification_status,
      rejection_note: state.rejection_note,
      verified_by: state.admin_verification_status === "verified" ? userId : null,
      verified_at: state.verified_at,
    };
    try {
      await runOrQueue(QK.TaskLogUpsert, { rows: [row] }, "שמירת משימה");
    } catch (e) {
      toastError(e, "שמירה נכשלה");
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
      // Re-completing after rejection clears the verification cycle
      admin_verification_status: completed && prev?.admin_verification_status === "rejected" ? "none" : prev?.admin_verification_status ?? "none",
      rejection_note: completed && prev?.admin_verification_status === "rejected" ? null : prev?.rejection_note ?? null,
      verified_by_name: completed && prev?.admin_verification_status === "rejected" ? null : prev?.verified_by_name ?? null,
      verified_at: completed && prev?.admin_verification_status === "rejected" ? null : prev?.verified_at ?? null,
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

  // Super admin: verify / un-verify / reject a completed task.
  const setVerification = async (
    taskId: string,
    status: "none" | "verified" | "rejected",
    note: string | null,
  ) => {
    const prev = logs.get(taskId);
    if (!prev) return;
    const nextState: LogState = {
      ...prev,
      // Rejection un-completes the task so the employee must redo it.
      completed: status === "rejected" ? false : prev.completed,
      completed_at: status === "rejected" ? null : prev.completed_at,
      admin_verification_status: status,
      rejection_note: status === "rejected" ? note : null,
      verified_by_name: status === "verified" ? fullName : null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    };
    setLogs((m) => {
      const next = new Map(m);
      next.set(taskId, nextState);
      return next;
    });
    await persistTask(taskId, nextState);
    triggerHaptic("light");
    toast.success(
      status === "verified"
        ? "המשימה אומתה"
        : status === "rejected"
          ? "המשימה נפסלה והעובד יקבל הערה"
          : "האישור בוטל",
    );
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
      admin_verification_status: prev?.admin_verification_status ?? "none",
      rejection_note: prev?.rejection_note ?? null,
      verified_by_name: prev?.verified_by_name ?? null,
      verified_at: prev?.verified_at ?? null,
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
    const branchId = getActiveBranchIdSync();
    if (!branchId) return;
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
        .eq("branch_id", branchId)
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
        admin_verification_status: prev?.admin_verification_status ?? "none",
        rejection_note: prev?.rejection_note ?? null,
        verified_by_name: prev?.verified_by_name ?? null,
        verified_at: prev?.verified_at ?? null,
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
    // Fire-and-forget push to branch admin + super admins.
    const trimmed = (state.comments ?? "").trim().slice(0, 300);
    if (trimmed && branchId) {
      const taskName = allTasks.find((x) => x.id === taskId)?.name ?? "";
      try {
        void notifyCommentFn({
          data: {
            taskId,
            taskName,
            commentText: trimmed,
            branchId,
          },
        }).catch(() => {});
      } catch {
        /* swallow — push failure must never break save */
      }
    }
  };

  const saveShortage = async (
    name: string,
    catalogProductId: string | null,
    unit: string | null,
  ) => {
    const clean = name.trim();
    if (!clean) {
      toast.error("שם הפריט לא יכול להיות ריק");
      return;
    }
    try {
      await useNotebookStore.getState().addItem("shortages", clean, {
        priority: "urgent",
        catalogProductId: catalogProductId ?? null,
        unit: unit ?? null,
      });
      triggerHaptic("light");
      toast.success(`"${clean}" דווח לחוסרים`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "דיווח חוסר נכשל");
    }
  };

  const reportShortage = async (taskId: string) => {
    const t = allTasks.find((x) => x.id === taskId);
    if (!t) return;
    if (!t.is_purchased_good) {
      toast.error("פריט זה אינו מוגדר כסחורה לרכישה");
      return;
    }
    // If the task already has an explicit raw-material name, save instantly — no AI needed.
    const explicit = (t.ingredient_name ?? "").trim();
    if (explicit) {
      await saveShortage(explicit, null, null);
      return;
    }

    setExtractingTaskId(taskId);
    try {
      const result = await extractFn({ data: { title: t.name } });
      if (result.confidence === "high") {
        await saveShortage(result.name, result.catalogProductId, result.unit);
      } else {
        // Ambiguous — let the user confirm/edit the AI guess.
        const fallback = result.name || extractIngredientName({ name: t.name });
        setConfirmShortage({
          taskId,
          name: fallback,
          catalogProductId: result.catalogProductId,
          unit: result.unit,
        });
      }
    } catch (e) {
      // AI failed → fall back to local heuristic + confirm dialog
      const guess = extractIngredientName({ name: t.name, ingredient_name: t.ingredient_name });
      setConfirmShortage({ taskId, name: guess, catalogProductId: null, unit: null });
      if (e instanceof Error) console.error("extract failed", e);
    } finally {
      setExtractingTaskId(null);
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

  // Group micro-celebration: fire once per group when it hits 100%.
  useEffect(() => {
    for (const g of groups) {
      const gTasks = allTasks.filter((t) => t.group_id === g.id && !t.parent_task_id);
      const gCountable = gTasks.flatMap((t) => {
        const subs = allTasks.filter((x) => x.parent_task_id === t.id);
        return subs.length > 0 ? subs : [t];
      });
      const gDone = gCountable.filter((t) => logs.get(t.id)?.completed).length;
      const prev = groupCompletionRef.current.get(g.id) ?? 0;
      if (gCountable.length > 0 && gDone === gCountable.length && prev < gCountable.length) {
        triggerHaptic("success");
        toast.success("קבוצה הושלמה", { description: `✅ ${g.name}` });
      }
      groupCompletionRef.current.set(g.id, gDone);
    }
  }, [logs, groups, allTasks]);

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
      <div className="max-w-4xl mx-auto px-3 sm:px-4" dir="rtl">
        <ListSkeleton rows={6} />
      </div>
    );
  }

  const openRecipe = recipeOpen ? recipes.find((r) => r.id === recipeOpen) : null;

  return (
    <PullToRefresh onRefresh={reloadAll}>
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




                        {isGroupOpen && (() => {
                          const pendingList = gTasks.filter((t) => {
                            const subs = subtasksFor(t.id);
                            if (subs.length > 0) return !subs.every((s) => logs.get(s.id)?.completed);
                            return !(logs.get(t.id)?.completed);
                          });
                          const completedList = gTasks.filter((t) => !pendingList.includes(t));
                          const isCompletedOpen = expandedCompleted.get(g.id) ?? false;
                          const renderTaskCard = (t: Task) => {
                              const subs = subtasksFor(t.id);
                              if (subs.length > 0) {
                                const subsDone = subs.filter((s) => logs.get(s.id)?.completed).length;
                                const allDone = subsDone === subs.length;
                                return (
                                  <SortableTaskItem key={t.id} id={t.id} showHandle={isSuperAdmin && !t.id.startsWith("__virtual_")}>
                                  <div
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
                                            <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
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
                                  </SortableTaskItem>
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
                              const isUrgent = !done && t.is_urgent === true;
                              return (
                                <SortableTaskItem key={t.id} id={t.id} showHandle={isSuperAdmin && !t.id.startsWith("__virtual_")}>
                                <div
                                  className={`rounded-xl border p-4 transition-all duration-300 ${
                                    log?.admin_verification_status === "verified"
                                      ? "bg-card/40 border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.25)]"
                                      : done
                                        ? "bg-card/40 border-border"
                                        : isUrgent
                                          ? "bg-card border-amber-500/70 shadow-[0_0_8px_rgba(245,158,11,0.4)] hover:border-amber-400 hover:shadow-[0_0_16px_rgba(245,158,11,0.55)]"
                                          : "bg-card border-pink-500/50 shadow-[0_0_4px_rgba(236,72,153,0.3)] hover:border-pink-500/80 hover:shadow-[0_0_14px_rgba(236,72,153,0.5)]"
                                  } ${isPulsing ? "neon-pulse-card" : ""}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <label className="flex items-start gap-3 flex-1 cursor-pointer min-w-0 min-h-[44px]">
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
                                          className={`text-sm font-bold leading-snug transition-all duration-300 flex items-center gap-1.5 flex-wrap ${done ? "line-through text-gray-500" : "text-foreground"}`}
                                        >
                                          {isUrgent && <Flame className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />}
                                          <span>{t.name}</span>
                                          {isUrgent && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                                              דחוף
                                            </span>
                                          )}
                                        </div>
                                        {stamp && (
                                          <div className="text-[11px] text-primary/90 mt-1 leading-snug">
                                            {stamp}
                                          </div>
                                        )}
                                        {log?.admin_verification_status === "verified" && (
                                          <div className="text-[11px] text-emerald-400 font-bold mt-1 leading-snug">
                                            ✅ אושר ע״י {log.verified_by_name ?? "הנהלה"}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                    {isSuperAdmin && done && !t.id.startsWith("__virtual_") && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setVerification(t.id, log?.admin_verification_status === "verified" ? "none" : "verified", null)}
                                          className={`p-1.5 rounded-md transition border ${
                                            log?.admin_verification_status === "verified"
                                              ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                                              : "border-transparent text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                                          }`}
                                          aria-label="אשר ביצוע"
                                          title="אישור מנהל"
                                        >
                                          <span className="text-base leading-none">✓</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setRejectingTask({ id: t.id, name: t.name }); setRejectNoteDraft(log?.rejection_note ?? ""); }}
                                          className={`p-1.5 rounded-md transition border ${
                                            log?.admin_verification_status === "rejected"
                                              ? "bg-rose-500/20 border-rose-500/60 text-rose-300"
                                              : "border-transparent text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                                          }`}
                                          aria-label="פסול ביצוע"
                                          title="פסילת מנהל"
                                        >
                                          <span className="text-base leading-none">✗</span>
                                        </button>
                                      </div>
                                    )}
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

                                  {log?.admin_verification_status === "rejected" && log.rejection_note && (
                                    <div className="mt-3 rounded-lg border-2 border-rose-500/60 bg-rose-500/10 p-3 flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                      <div className="text-right flex-1">
                                        <div className="text-[11px] font-bold text-rose-300 mb-1">⚠️ הערת מנהל — המשימה נפסלה</div>
                                        <div className="text-sm text-rose-100 leading-snug whitespace-pre-wrap">{log.rejection_note}</div>
                                      </div>
                                    </div>
                                  )}


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
                                    {(() => {
                                      const existingComment = (log?.comments ?? "").trim();
                                      const isCommentOpen = commentOpenMap.get(t.id) ?? false;
                                      const showTextarea = isCommentOpen || (!existingComment && false);
                                      const toggleOpen = (open: boolean) =>
                                        setCommentOpenMap((m) => {
                                          const n = new Map(m);
                                          n.set(t.id, open);
                                          return n;
                                        });
                                      return (
                                        <>
                                          {!showTextarea && existingComment && (
                                            <div className="flex items-start justify-between gap-2 text-right">
                                              <button
                                                type="button"
                                                onClick={() => toggleOpen(true)}
                                                className="p-1 rounded-md text-muted-foreground hover:text-neon hover:bg-accent/40 shrink-0 transition"
                                                aria-label="ערוך הערה"
                                                title="ערוך הערה"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                              <div className="text-[11px] text-muted-foreground flex-1 whitespace-pre-wrap leading-snug">
                                                {existingComment}
                                              </div>
                                            </div>
                                          )}
                                          {!showTextarea && !existingComment && (
                                            <button
                                              type="button"
                                              onClick={() => toggleOpen(true)}
                                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-neon transition"
                                            >
                                              <MessageSquarePlus className="h-3.5 w-3.5" />
                                              הוסף הערה
                                            </button>
                                          )}
                                          {showTextarea && (
                                            <>
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
                                                autoFocus
                                              />
                                              <div className="text-[10px] text-muted-foreground text-end mt-0.5 tabular-nums" dir="ltr">
                                                {(log?.comments ?? "").length}/2000
                                              </div>
                                              <div className="mt-2 flex items-center justify-end gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleOpen(false)}
                                                  className="px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition"
                                                >
                                                  ביטול
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    await saveComment(t.id);
                                                    toggleOpen(false);
                                                  }}
                                                  disabled={!t.id || t.id.startsWith("__virtual_")}
                                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-neon/90 text-black hover:bg-neon transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(57,255,20,0.4)]"
                                                  title="שמור הערה"
                                                >
                                                  <Save className="h-3.5 w-3.5" />
                                                  שמור הערה
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {t.is_purchased_good && (
                                      <div className="mt-2 flex justify-start">
                                        <button
                                          type="button"
                                          onClick={() => reportShortage(t.id)}
                                          disabled={extractingTaskId === t.id}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 transition disabled:opacity-60 disabled:cursor-wait"
                                          title="דווח כחוסר"
                                        >
                                          {extractingTaskId === t.id ? (
                                            <>
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              מזהה פריט…
                                            </>
                                          ) : (
                                            <>
                                              <AlertTriangle className="h-3.5 w-3.5" />
                                              דווח כחוסר
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                </SortableTaskItem>
                              );
                            };
                            return (
                              <div className="border-t border-border/60 px-3 sm:px-4 py-4 flex flex-col gap-3 bg-background/30">
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleGroupDragEnd(g.id)}
                                >
                                  <SortableContext
                                    items={pendingList.map((t) => t.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {pendingList.map(renderTaskCard)}
                                  </SortableContext>
                                </DndContext>
                                {completedList.length > 0 && (
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedCompleted((m) => {
                                          const n = new Map(m);
                                          n.set(g.id, !(m.get(g.id) ?? false));
                                          return n;
                                        })
                                      }
                                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background/40 hover:bg-background/60 transition border border-border/40"
                                      aria-expanded={isCompletedOpen}
                                    >
                                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isCompletedOpen ? "rotate-180" : ""}`} />
                                      <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                        הושלם {completedList.length}
                                      </span>
                                    </button>
                                    {isCompletedOpen && (
                                      <div className="mt-3 space-y-3 opacity-60 transition-opacity">
                                        {completedList.map(renderTaskCard)}
                                      </div>
                                    )}
                                  </div>
                                )}
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
                            );
                          })()}
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

      {/* AI-extraction confirmation for "Report Shortage" */}
      <Dialog
        open={!!confirmShortage}
        onOpenChange={(o) => { if (!o) setConfirmShortage(null); }}
      >
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neon" />
              אישור שם הפריט
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              ה-AI לא היה בטוח לחלוטין. ודא או ערוך את שם חומר הגלם לפני השמירה ברשימת החוסרים.
            </p>
            <input
              value={confirmShortage?.name ?? ""}
              onChange={(e) =>
                setConfirmShortage((c) => (c ? { ...c, name: e.target.value } : c))
              }
              maxLength={120}
              dir="rtl"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setConfirmShortage(null)}
              className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-accent"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirmShortage) return;
                const snap = confirmShortage;
                setConfirmShortage(null);
                await saveShortage(snap.name, snap.catalogProductId, snap.unit);
              }}
              className="flex-1 h-10 rounded-md bg-neon text-primary-foreground font-bold text-sm glow-neon inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              שמור חוסר
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super-admin rejection-note prompt */}
      <Dialog
        open={!!rejectingTask}
        onOpenChange={(o) => { if (!o) { setRejectingTask(null); setRejectNoteDraft(""); } }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">פסילת ביצוע משימה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-right">
            <div className="text-sm text-muted-foreground">
              {rejectingTask?.name}
            </div>
            <label className="block text-xs font-bold text-foreground">סיבת פסילה (תוצג לעובד)</label>
            <textarea
              value={rejectNoteDraft}
              onChange={(e) => setRejectNoteDraft(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="לדוגמה: התמונה לא ברורה, יש לחזור ולנקות את האזור…"
              className="w-full bg-background border border-border focus:border-rose-500/60 focus:outline-none rounded-md px-3 py-2 text-sm resize-y"
            />
            <div className="text-[10px] text-muted-foreground tabular-nums text-end" dir="ltr">
              {rejectNoteDraft.length}/500
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => { setRejectingTask(null); setRejectNoteDraft(""); }}
              className="px-3 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-accent"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={!rejectNoteDraft.trim()}
              onClick={async () => {
                if (!rejectingTask || !rejectNoteDraft.trim()) return;
                const id = rejectingTask.id;
                const note = rejectNoteDraft.trim();
                setRejectingTask(null);
                setRejectNoteDraft("");
                await setVerification(id, "rejected", note);
              }}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              פסול ושלח הערה
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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
    </PullToRefresh>
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
