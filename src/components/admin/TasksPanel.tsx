import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { useAuth } from "@/lib/auth";
import {
  fetchTaskTree,
  recurrenceLabel,
  WEEKDAY_HE,
  type Shift,
  type TaskGroup,
  type Task,
  type RecurrenceType,
} from "@/lib/tasks";
import { useCookbookStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------- Themed prompt / confirm modals ----------

type PromptState = {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  onConfirm?: (value: string) => void;
};

type ConfirmState = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
};

function PromptModal({
  state,
  onClose,
}: {
  state: PromptState;
  onClose: () => void;
}) {
  const [value, setValue] = useState(state.initial ?? "");
  useEffect(() => {
    if (state.open) setValue(state.initial ?? "");
  }, [state.open, state.initial]);

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="bg-zinc-900 border border-zinc-800/50 text-zinc-100 sm:max-w-md"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="text-zinc-100 text-right">{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription className="text-zinc-400 text-right">
              {state.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={state.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              state.onConfirm?.(value.trim());
              onClose();
            }
          }}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-right text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
        />
        <DialogFooter className="flex flex-row-reverse gap-2 sm:flex-row-reverse">
          <button
            onClick={() => {
              if (!value.trim()) return;
              state.onConfirm?.(value.trim());
              onClose();
            }}
            className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
            disabled={!value.trim()}
          >
            {state.confirmLabel ?? "שמור"}
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm transition-colors"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="bg-zinc-900 border border-zinc-800/50 text-zinc-100 sm:max-w-md"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="text-zinc-100 text-right">{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription className="text-zinc-400 text-right">
              {state.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-row-reverse gap-2 sm:flex-row-reverse">
          <button
            onClick={() => {
              state.onConfirm?.();
              onClose();
            }}
            className={
              state.destructive
                ? "bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
                : "bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
            }
          >
            {state.confirmLabel ?? "אישור"}
          </button>
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm transition-colors"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- New Task modal (with scheduling) ----------

type NewTaskState = {
  open: boolean;
  parentName: string;
  shiftId?: string;
  groupId?: string;
  onConfirm?: (v: { name: string; recurrence_type: RecurrenceType; recurrence_day: number | null }) => void;
};

function NewTaskModal({ state, onClose }: { state: NewTaskState; onClose: () => void }) {
  const [name, setName] = useState("");
  const [rtype, setRtype] = useState<RecurrenceType>("daily");
  const [rday, setRday] = useState<number>(0);
  const [rdom, setRdom] = useState<number>(1);

  useEffect(() => {
    if (state.open) {
      setName(""); setRtype("daily"); setRday(0); setRdom(1);
    }
  }, [state.open]);

  const submit = () => {
    if (!name.trim()) return;
    const recurrence_day =
      rtype === "weekly" ? rday : rtype === "monthly" ? rdom : null;
    state.onConfirm?.({ name: name.trim(), recurrence_type: rtype, recurrence_day });
    onClose();
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="bg-zinc-900 border border-zinc-800/50 text-zinc-100 sm:max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle className="text-zinc-100 text-right">משימה חדשה</DialogTitle>
          <DialogDescription className="text-zinc-400 text-right">
            תתווסף תחת: {state.parentName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1 text-right">שם המשימה</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם המשימה"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }}
              className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-md px-3 text-sm text-right text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1 text-right">תדירות</label>
            <select
              value={rtype}
              onChange={(e) => setRtype(e.target.value as RecurrenceType)}
              className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-md px-3 text-sm text-right text-zinc-100 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            >
              <option value="daily">יומי</option>
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
              <option value="as_needed">לפי צורך</option>
            </select>
          </div>
          {rtype === "weekly" && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1 text-right">יום בשבוע</label>
              <select
                value={rday}
                onChange={(e) => setRday(Number(e.target.value))}
                className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-md px-3 text-sm text-right text-zinc-100 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              >
                {WEEKDAY_HE.map((d, i) => <option key={i} value={i}>יום {d}</option>)}
              </select>
            </div>
          )}
          {rtype === "monthly" && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1 text-right">יום בחודש (1-31)</label>
              <input
                type="number" min={1} max={31}
                value={rdom}
                onChange={(e) => setRdom(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-md px-3 text-sm text-right text-zinc-100 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-row-reverse gap-2 sm:flex-row-reverse">
          <button onClick={submit} disabled={!name.trim()}
            className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50">
            הוסף משימה
          </button>
          <button onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm transition-colors">
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main panel ----------

export function TasksPanel() {
  const { isSuperAdmin } = useAuth();
  const branchId = useActiveBranch();
  const recipes = useCookbookStore((s) => s.recipes);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [promptState, setPromptState] = useState<PromptState>({ open: false, title: "" });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: "" });
  const [newTaskState, setNewTaskState] = useState<NewTaskState>({ open: false, parentName: "" });

  const askPrompt = (s: Omit<PromptState, "open">) =>
    setPromptState({ ...s, open: true });
  const askConfirm = (s: Omit<ConfirmState, "open">) =>
    setConfirmState({ ...s, open: true });

  const reload = async () => {
    if (!branchId) return;
    setLoading(true);
    const tree = await fetchTaskTree(branchId);
    setShifts(tree.shifts);
    setGroups(tree.groups);
    setTasks(tree.tasks);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [branchId]);

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-border rounded-md">
        ניהול משימות קבועות זמין לסופר-אדמין בלבד.
      </div>
    );
  }
  if (!branchId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-border rounded-md">
        יש לבחור סניף תחילה.
      </div>
    );
  }

  const addShift = () =>
    askPrompt({
      title: "אזור / משמרת חדשה",
      placeholder: "שם האזור או המשמרת",
      confirmLabel: "הוסף",
      onConfirm: async (name) => {
        const so = (Math.max(0, ...shifts.map((s) => s.sort_order)) || 0) + 10;
        const { error } = await supabase.from("shifts").insert({
          branch_id: branchId,
          name,
          sort_order: so,
        });
        if (error) return toast.error(error.message);
        toast.success("נוסף בהצלחה");
        reload();
      },
    });

  const renameShift = (s: Shift) =>
    askPrompt({
      title: "שינוי שם האזור / המשמרת",
      initial: s.name,
      placeholder: "שם חדש",
      onConfirm: async (name) => {
        if (name === s.name) return;
        const { error } = await supabase.from("shifts").update({ name }).eq("id", s.id);
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const deleteShift = (s: Shift) =>
    askConfirm({
      title: `מחיקת "${s.name}"`,
      description: "פעולה זו תמחק את כל הקטגוריות והמשימות מתחתיו.",
      confirmLabel: "מחק",
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("shifts").delete().eq("id", s.id);
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const moveShift = async (s: Shift, dir: -1 | 1) => {
    const sorted = [...shifts].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("shifts").update({ sort_order: swap.sort_order }).eq("id", s.id),
      supabase.from("shifts").update({ sort_order: s.sort_order }).eq("id", swap.id),
    ]);
    reload();
  };

  const addGroup = (shiftId: string) =>
    askPrompt({
      title: "קטגוריה חדשה",
      placeholder: "שם הקטגוריה",
      confirmLabel: "הוסף קטגוריה",
      onConfirm: async (name) => {
        const siblings = groups.filter((g) => g.shift_id === shiftId);
        const so = (Math.max(0, ...siblings.map((g) => g.sort_order)) || 0) + 10;
        const { error } = await supabase.from("task_groups").insert({
          branch_id: branchId,
          shift_id: shiftId,
          name,
          sort_order: so,
        });
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const renameGroup = (g: TaskGroup) =>
    askPrompt({
      title: "שינוי שם הקטגוריה",
      initial: g.name,
      placeholder: "שם חדש",
      onConfirm: async (name) => {
        if (name === g.name) return;
        const { error } = await supabase.from("task_groups").update({ name }).eq("id", g.id);
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const deleteGroup = (g: TaskGroup) =>
    askConfirm({
      title: `מחיקת קטגוריה "${g.name}"`,
      description: "פעולה זו תמחק את כל המשימות שמתחת לקטגוריה זו.",
      confirmLabel: "מחק",
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("task_groups").delete().eq("id", g.id);
        if (error) return toast.error(error.message);
        reload();
      },
    });

  // Add a task — under a Category (groupId set) OR directly under an Area (shiftId set).
  const addTaskTo = (opts: { shiftId?: string; groupId?: string; parentName: string }) =>
    setNewTaskState({
      open: true,
      parentName: opts.parentName,
      shiftId: opts.shiftId,
      groupId: opts.groupId,
      onConfirm: async ({ name, recurrence_type, recurrence_day }) => {
        const siblings = opts.groupId
          ? tasks.filter((t) => t.group_id === opts.groupId)
          : tasks.filter((t) => t.shift_id === opts.shiftId && !t.group_id);
        const so = (Math.max(0, ...siblings.map((t) => t.sort_order)) || 0) + 10;
        const { error } = await supabase.from("tasks").insert({
          branch_id: branchId,
          group_id: opts.groupId ?? null,
          shift_id: opts.groupId ? null : (opts.shiftId ?? null),
          name,
          sort_order: so,
          recurrence_type,
          recurrence_day,
        });
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const updateTask = async (t: Task, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const deleteTask = (t: Task) =>
    askConfirm({
      title: `מחיקת משימה "${t.name}"`,
      confirmLabel: "מחק",
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("tasks").delete().eq("id", t.id);
        if (error) return toast.error(error.message);
        reload();
      },
    });

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin ml-2" /> טוען…
      </div>
    );
  }

  return (
    <section dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          onClick={addShift}
          className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-3 py-2 rounded-md glow-neon text-sm"
        >
          <Plus className="h-4 w-4" /> אזור / משמרת חדשה
        </button>
        <h2 className="font-display text-xl font-bold text-right">
          ניהול <span className="text-neon text-glow-neon">משימות קבועות</span>
        </h2>
      </div>

      <div className="space-y-3">
        {shifts.map((s) => {
          const shiftGroups = groups.filter((g) => g.shift_id === s.id);
          const directTasks = tasks
            .filter((t) => t.shift_id === s.id && !t.group_id && !t.parent_task_id)
            .sort((a, b) => a.sort_order - b.sort_order);
          const isOpen = expanded.has(s.id);
          return (
            <div key={s.id} className="border border-border rounded-lg overflow-hidden bg-card/40">
              {/* Level 1 — Area/Shift header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card/60">
                <div className="flex items-center gap-1">
                  <button onClick={() => moveShift(s, -1)} className="p-1 text-muted-foreground hover:text-neon" aria-label="העלה"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => moveShift(s, 1)} className="p-1 text-muted-foreground hover:text-neon" aria-label="הורד"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => renameShift(s)} className="p-1 text-muted-foreground hover:text-neon" aria-label="ערוך"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteShift(s)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="מחק"><Trash2 className="h-4 w-4" /></button>
                </div>
                <button
                  onClick={() => toggle(s.id)}
                  className="flex-1 text-right font-display text-base font-bold"
                >
                  {s.name}
                </button>
              </div>

              {isOpen && (
                <div className="p-3 space-y-3 bg-background/20">
                  {/* Direct tasks (Level 3 under Area) */}
                  {directTasks.length > 0 && (
                    <ul className="pr-3 border-r-2 border-pink-500/40 divide-y divide-border/60 bg-background/30 rounded-md">
                      {directTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          recipes={recipes}
                          onUpdate={(patch) => updateTask(t, patch)}
                          onDelete={() => deleteTask(t)}
                        />
                      ))}
                    </ul>
                  )}

                  {/* Categories (Level 2) — indented */}
                  {shiftGroups.length > 0 && (
                    <div className="pr-3 space-y-2 border-r-2 border-neon/40">
                      {shiftGroups.map((g) => {
                        const groupTasks = tasks
                          .filter((t) => t.group_id === g.id && !t.parent_task_id)
                          .sort((a, b) => a.sort_order - b.sort_order);
                        const gOpen = expanded.has(g.id);
                        return (
                          <div key={g.id} className="rounded-md border border-border/70 bg-card/40 overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card/60">
                              <div className="flex items-center gap-1">
                                <button onClick={() => renameGroup(g)} className="p-1 text-muted-foreground hover:text-neon" aria-label="ערוך"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => deleteGroup(g)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="מחק"><Trash2 className="h-3.5 w-3.5" /></button>
                                <button
                                  onClick={() => addTaskTo({ groupId: g.id, parentName: g.name })}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-pink-600/90 hover:bg-pink-600 text-white text-[11px] font-bold"
                                  aria-label="הוסף משימה לקטגוריה"
                                >
                                  <Plus className="h-3 w-3" /> משימה
                                </button>
                              </div>
                              <button
                                onClick={() => toggle(g.id)}
                                className="flex-1 text-right text-sm font-bold"
                              >
                                {g.name}
                                <span className="mr-2 text-[11px] text-muted-foreground font-normal">({groupTasks.length})</span>
                              </button>
                            </div>
                            {gOpen && (
                              <ul className="pr-3 border-r-2 border-pink-500/30 divide-y divide-border/60">
                                {groupTasks.map((t) => (
                                  <TaskRow
                                    key={t.id}
                                    task={t}
                                    recipes={recipes}
                                    onUpdate={(patch) => updateTask(t, patch)}
                                    onDelete={() => deleteTask(t)}
                                  />
                                ))}
                                {groupTasks.length === 0 && (
                                  <li className="px-3 py-2 text-center text-[11px] text-muted-foreground">אין משימות בקטגוריה זו.</li>
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {directTasks.length === 0 && shiftGroups.length === 0 && (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                      עדיין אין קטגוריות או משימות כאן.
                    </div>
                  )}

                  {/* Inline action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                    <button
                      onClick={() => addGroup(s.id)}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md bg-neon/15 border border-neon/40 text-neon hover:bg-neon/25 text-sm font-bold"
                    >
                      <Plus className="h-4 w-4" /> קטגוריה חדשה
                    </button>
                    <button
                      onClick={() => addTaskTo({ shiftId: s.id, parentName: s.name })}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold"
                    >
                      <Plus className="h-4 w-4" /> משימה חדשה
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {shifts.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground border border-border rounded-md">
            עדיין אין אזורים או משמרות. לחצו על "אזור / משמרת חדשה" כדי להתחיל.
          </div>
        )}
      </div>

      <PromptModal
        state={promptState}
        onClose={() => setPromptState((p) => ({ ...p, open: false }))}
      />
      <ConfirmModal
        state={confirmState}
        onClose={() => setConfirmState((c) => ({ ...c, open: false }))}
      />
      <NewTaskModal
        state={newTaskState}
        onClose={() => setNewTaskState((s) => ({ ...s, open: false }))}
      />
    </section>
  );
}

function TaskRow({
  task,
  recipes,
  onUpdate,
  onDelete,
}: {
  task: Task;
  recipes: { id: string; nameHebrew: string }[];
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const [recipeId, setRecipeId] = useState(task.recipe_id ?? "");
  const [rtype, setRtype] = useState<RecurrenceType>(task.recurrence_type ?? "daily");
  const [rday, setRday] = useState<number>(
    task.recurrence_type === "weekly" ? (task.recurrence_day ?? 0) : 0,
  );
  const [rdom, setRdom] = useState<number>(
    task.recurrence_type === "monthly" ? (task.recurrence_day ?? 1) : 1,
  );

  useEffect(() => {
    setName(task.name);
    setRecipeId(task.recipe_id ?? "");
    setRtype(task.recurrence_type ?? "daily");
    setRday(task.recurrence_type === "weekly" ? (task.recurrence_day ?? 0) : 0);
    setRdom(task.recurrence_type === "monthly" ? (task.recurrence_day ?? 1) : 1);
  }, [task.id, task.name, task.recipe_id, task.recurrence_type, task.recurrence_day]);

  const badge = recurrenceLabel(task);
  const badgeTone =
    task.recurrence_type === "daily"
      ? "bg-zinc-800 text-zinc-300"
      : task.recurrence_type === "weekly"
        ? "bg-neon/15 text-neon border border-neon/30"
        : task.recurrence_type === "monthly"
          ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
          : "bg-amber-500/15 text-amber-300 border border-amber-500/30";

  return (
    <li className="px-3 py-2 bg-background/40">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <button onClick={() => setEditing((v) => !v)} className="p-1 text-muted-foreground hover:text-neon" aria-label="ערוך">
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" aria-label="מחק"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-sm text-right text-zinc-100 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
          />
        ) : (
          <div className="flex-1 text-right">
            <div className="text-sm">{task.name}</div>
            <div className="mt-0.5">
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${badgeTone}`}>{badge}</span>
            </div>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-2 space-y-2 pr-12">
          <div className="flex items-center gap-2">
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-right text-zinc-100 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            >
              <option value="">— ללא קישור למתכון —</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.nameHebrew}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rtype}
              onChange={(e) => setRtype(e.target.value as RecurrenceType)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-right text-zinc-100"
            >
              <option value="daily">יומי</option>
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
              <option value="as_needed">לפי צורך</option>
            </select>
            {rtype === "weekly" && (
              <select
                value={rday}
                onChange={(e) => setRday(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-right text-zinc-100"
              >
                {WEEKDAY_HE.map((d, i) => <option key={i} value={i}>יום {d}</option>)}
              </select>
            )}
            {rtype === "monthly" && (
              <input
                type="number" min={1} max={31} value={rdom}
                onChange={(e) => setRdom(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                className="w-20 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-right text-zinc-100"
              />
            )}
            <button
              onClick={() => {
                const recurrence_day =
                  rtype === "weekly" ? rday : rtype === "monthly" ? rdom : null;
                onUpdate({
                  name: name.trim() || task.name,
                  recipe_id: recipeId || null,
                  recurrence_type: rtype,
                  recurrence_day,
                });
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white font-bold px-2 py-1 rounded text-xs transition-colors mr-auto"
            >
              <Save className="h-3 w-3" /> שמור
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
