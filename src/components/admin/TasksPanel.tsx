import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { useAuth } from "@/lib/auth";
import {
  fetchTaskTree,
  type Shift,
  type TaskGroup,
  type Task,
} from "@/lib/tasks";
import { useCookbookStore } from "@/lib/store";

export function TasksPanel() {
  const { isSuperAdmin } = useAuth();
  const branchId = useActiveBranch();
  const recipes = useCookbookStore((s) => s.recipes);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const addShift = async () => {
    const name = prompt("שם המשמרת:");
    if (!name?.trim()) return;
    const so = (Math.max(0, ...shifts.map((s) => s.sort_order)) || 0) + 10;
    const { error } = await supabase.from("shifts").insert({
      branch_id: branchId,
      name: name.trim(),
      sort_order: so,
    });
    if (error) return toast.error(error.message);
    toast.success("משמרת נוספה");
    reload();
  };

  const renameShift = async (s: Shift) => {
    const name = prompt("שם חדש:", s.name);
    if (!name?.trim() || name === s.name) return;
    const { error } = await supabase.from("shifts").update({ name: name.trim() }).eq("id", s.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const deleteShift = async (s: Shift) => {
    if (!confirm(`למחוק את "${s.name}" וכל הקבוצות והמשימות שמתחתיה?`)) return;
    const { error } = await supabase.from("shifts").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    reload();
  };

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

  const addGroup = async (shiftId: string) => {
    const name = prompt("שם הקבוצה:");
    if (!name?.trim()) return;
    const siblings = groups.filter((g) => g.shift_id === shiftId);
    const so = (Math.max(0, ...siblings.map((g) => g.sort_order)) || 0) + 10;
    const { error } = await supabase.from("task_groups").insert({
      branch_id: branchId,
      shift_id: shiftId,
      name: name.trim(),
      sort_order: so,
    });
    if (error) return toast.error(error.message);
    reload();
  };

  const renameGroup = async (g: TaskGroup) => {
    const name = prompt("שם חדש:", g.name);
    if (!name?.trim() || name === g.name) return;
    const { error } = await supabase.from("task_groups").update({ name: name.trim() }).eq("id", g.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const deleteGroup = async (g: TaskGroup) => {
    if (!confirm(`למחוק את "${g.name}" וכל המשימות שלה?`)) return;
    const { error } = await supabase.from("task_groups").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const moveGroup = async (g: TaskGroup, dir: -1 | 1) => {
    const siblings = groups
      .filter((x) => x.shift_id === g.shift_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((x) => x.id === g.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("task_groups").update({ sort_order: swap.sort_order }).eq("id", g.id),
      supabase.from("task_groups").update({ sort_order: g.sort_order }).eq("id", swap.id),
    ]);
    reload();
  };

  const addTask = async (groupId: string) => {
    const name = prompt("שם המשימה:");
    if (!name?.trim()) return;
    const siblings = tasks.filter((t) => t.group_id === groupId);
    const so = (Math.max(0, ...siblings.map((t) => t.sort_order)) || 0) + 10;
    const { error } = await supabase.from("tasks").insert({
      branch_id: branchId,
      group_id: groupId,
      name: name.trim(),
      sort_order: so,
    });
    if (error) return toast.error(error.message);
    reload();
  };

  const updateTask = async (t: Task, patch: Partial<Task>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const deleteTask = async (t: Task) => {
    if (!confirm(`למחוק את "${t.name}"?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const moveTask = async (t: Task, dir: -1 | 1) => {
    const siblings = tasks
      .filter((x) => x.group_id === t.group_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((x) => x.id === t.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("tasks").update({ sort_order: swap.sort_order }).eq("id", t.id),
      supabase.from("tasks").update({ sort_order: t.sort_order }).eq("id", swap.id),
    ]);
    reload();
  };

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
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          onClick={addShift}
          className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-3 py-2 rounded-md glow-neon text-sm"
        >
          <Plus className="h-4 w-4" /> משמרת חדשה
        </button>
        <h2 className="font-display text-xl font-bold text-right">
          ניהול <span className="text-neon text-glow-neon">משימות קבועות</span>
        </h2>
      </div>

      <div className="space-y-3">
        {shifts.map((s) => (
          <div key={s.id} className="border border-border rounded-lg overflow-hidden bg-card/40">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card/60">
              <div className="flex items-center gap-1">
                <button onClick={() => moveShift(s, -1)} className="p-1 text-muted-foreground hover:text-neon" aria-label="העלה"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveShift(s, 1)} className="p-1 text-muted-foreground hover:text-neon" aria-label="הורד"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => renameShift(s)} className="p-1 text-muted-foreground hover:text-neon" aria-label="ערוך"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => deleteShift(s)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="מחק"><Trash2 className="h-4 w-4" /></button>
                <button onClick={() => addGroup(s.id)} className="p-1 text-neon" aria-label="הוסף קבוצה"><Plus className="h-4 w-4" /></button>
              </div>
              <button
                onClick={() => toggle(s.id)}
                className="flex-1 text-right font-display text-base font-bold"
              >
                {s.name}
              </button>
            </div>

            {expanded.has(s.id) && (
              <div className="divide-y divide-border">
                {groups.filter((g) => g.shift_id === s.id).map((g) => (
                  <div key={g.id} className="bg-background/30">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveGroup(g, -1)} className="p-1 text-muted-foreground hover:text-neon"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => moveGroup(g, 1)} className="p-1 text-muted-foreground hover:text-neon"><ChevronDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => renameGroup(g)} className="p-1 text-muted-foreground hover:text-neon"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteGroup(g)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => addTask(g.id)} className="p-1 text-neon"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <button onClick={() => toggle(g.id)} className="flex-1 text-right text-sm font-bold">{g.name}</button>
                    </div>

                    {expanded.has(g.id) && (
                      <ul className="border-t border-border/60 divide-y divide-border/60">
                        {tasks.filter((t) => t.group_id === g.id).map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            recipes={recipes}
                            onMove={(dir) => moveTask(t, dir)}
                            onUpdate={(patch) => updateTask(t, patch)}
                            onDelete={() => deleteTask(t)}
                          />
                        ))}
                        {tasks.filter((t) => t.group_id === g.id).length === 0 && (
                          <li className="px-4 py-3 text-center text-xs text-muted-foreground">אין משימות.</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
                {groups.filter((g) => g.shift_id === s.id).length === 0 && (
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground">אין קבוצות במשמרת זו.</div>
                )}
              </div>
            )}
          </div>
        ))}
        {shifts.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground border border-border rounded-md">
            אין משמרות עדיין.
          </div>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  recipes,
  onMove,
  onUpdate,
  onDelete,
}: {
  task: Task;
  recipes: { id: string; nameHebrew: string }[];
  onMove: (dir: -1 | 1) => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const [recipeId, setRecipeId] = useState(task.recipe_id ?? "");

  useEffect(() => {
    setName(task.name);
    setRecipeId(task.recipe_id ?? "");
  }, [task.id, task.name, task.recipe_id]);

  return (
    <li className="px-4 py-2 bg-background/40">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(-1)} className="p-1 text-muted-foreground hover:text-neon"><ChevronUp className="h-3 w-3" /></button>
          <button onClick={() => onMove(1)} className="p-1 text-muted-foreground hover:text-neon"><ChevronDown className="h-3 w-3" /></button>
          <button onClick={() => setEditing((v) => !v)} className="p-1 text-muted-foreground hover:text-neon">
            {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          </button>
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-input border border-border rounded-md px-2 py-1 text-sm text-right"
          />
        ) : (
          <div className="flex-1 text-sm text-right">{task.name}</div>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2 pr-12">
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="flex-1 bg-input border border-border rounded-md px-2 py-1 text-xs text-right"
          >
            <option value="">— ללא קישור למתכון —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameHebrew}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              onUpdate({ name: name.trim() || task.name, recipe_id: recipeId || null });
              setEditing(false);
            }}
            className="inline-flex items-center gap-1 bg-neon text-primary-foreground font-bold px-2 py-1 rounded text-xs"
          >
            <Save className="h-3 w-3" /> שמור
          </button>
        </div>
      )}
    </li>
  );
}
