import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ListTodo, Flame, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SortableList } from "@/components/SortableList";

interface PersonalTask {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  is_urgent: boolean;
  sort_order: number;
  created_at: string;
}

function sortTasks(list: PersonalTask[]): PersonalTask[] {
  return [...list].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/**
 * Personal tasks widget — each user's private ad-hoc todo list.
 * Supports urgency flag and drag-and-drop reordering via grab handle.
 */
export function PersonalTasksCard() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!userId) {
      setTasks([]);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("personal_tasks")
        .select("*")
        .eq("user_id", userId);
      if (!active) return;
      if (error) toast.error("שגיאה בטעינת המשימות האישיות");
      else setTasks(sortTasks((data ?? []) as PersonalTask[]));
      setLoading(false);
    })();

    const channel = supabase
      .channel(`personal_tasks_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => {
              const row = payload.new as PersonalTask;
              if (prev.some((t) => t.id === row.id)) return prev;
              return sortTasks([row, ...prev]);
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              sortTasks(prev.map((t) => (t.id === (payload.new as PersonalTask).id ? (payload.new as PersonalTask) : t))),
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== (payload.old as PersonalTask).id));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const addTask = async () => {
    const t = title.trim();
    if (!t || !userId || adding) return;
    setAdding(true);
    const minOrder = tasks.reduce((m, x) => Math.min(m, x.sort_order ?? 0), 0);
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert({ user_id: userId, title: t, sort_order: minOrder - 1 })
      .select()
      .single();
    setAdding(false);
    if (error) {
      toast.error("לא ניתן להוסיף משימה");
      return;
    }
    setTitle("");
    setTasks((prev) => {
      if (prev.some((p) => p.id === data.id)) return prev;
      return sortTasks([data as PersonalTask, ...prev]);
    });
  };

  const toggle = async (task: PersonalTask) => {
    const next = !task.is_completed;
    setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? { ...t, is_completed: next } : t))));
    const { error } = await supabase
      .from("personal_tasks")
      .update({ is_completed: next })
      .eq("id", task.id);
    if (error) {
      toast.error("העדכון נכשל");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: task.is_completed } : t)));
    }
  };

  const toggleUrgent = async (task: PersonalTask) => {
    const next = !task.is_urgent;
    setTasks((prev) => sortTasks(prev.map((t) => (t.id === task.id ? { ...t, is_urgent: next } : t))));
    const { error } = await supabase.from("personal_tasks").update({ is_urgent: next }).eq("id", task.id);
    if (error) {
      toast.error("העדכון נכשל");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_urgent: task.is_urgent } : t)));
    }
  };

  const remove = async (task: PersonalTask) => {
    const prev = tasks;
    setTasks((p) => p.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("personal_tasks").delete().eq("id", task.id);
    if (error) {
      toast.error("המחיקה נכשלה");
      setTasks(prev);
    }
  };

  const startEdit = (task: PersonalTask) => {
    setEditingId(task.id);
    setDraft(task.title);
  };

  const saveEdit = async (task: PersonalTask) => {
    const clean = draft.trim();
    setEditingId(null);
    if (!clean || clean === task.title) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title: clean } : t)));
    const { error } = await supabase.from("personal_tasks").update({ title: clean }).eq("id", task.id);
    if (error) toast.error("עדכון הכותרת נכשל");
  };

  const onReorder = async (reordered: PersonalTask[]) => {
    const withOrder = reordered.map((t, idx) => ({ ...t, sort_order: idx }));
    setTasks(withOrder);
    await Promise.all(
      withOrder.map((t) =>
        supabase.from("personal_tasks").update({ sort_order: t.sort_order }).eq("id", t.id),
      ),
    );
  };

  if (!userId) return null;

  const open = tasks.filter((t) => !t.is_completed).length;

  return (
    <div className="rounded-xl border-2 border-jungle/30 bg-card p-4" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="h-5 w-5 text-neon shrink-0" />
        <h2 className="font-display text-lg font-bold">המשימות שלי</h2>
        <span className="ms-auto text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
          {open} פתוחות
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addTask();
        }}
        className="flex items-center gap-2 mb-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="הוסף משימה אישית…"
          maxLength={200}
          className="flex-1 h-10 rounded-md bg-background border border-border px-3 text-sm focus:border-neon outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim() || adding}
          aria-label="הוסף משימה"
          className="h-10 w-10 grid place-content-center rounded-md border-2 border-neon text-neon bg-neon/10 hover:bg-neon/20 disabled:opacity-40"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </form>

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin inline-block" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          אין משימות אישיות כרגע. הוסף משימה ראשונה למעלה.
        </p>
      ) : (
        <SortableList
          items={tasks}
          getId={(t) => t.id}
          onReorder={onReorder}
          className="space-y-1.5"
        >
          {(t, handle) => {
            const isEditing = editingId === t.id;
            return (
              <div
                onClick={() => !isEditing && !t.is_completed && startEdit(t)}
                className={`group flex items-center gap-1.5 rounded-md border px-2 py-2 transition cursor-pointer hover:bg-white/5 ${
                  t.is_completed
                    ? "border-zinc-800 bg-zinc-900/30 opacity-60"
                    : t.is_urgent
                      ? "border-orange-500/50 bg-orange-500/5"
                      : "border-border bg-background/40"
                }`}
              >
                {handle}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggle(t);
                  }}
                  aria-label={t.is_completed ? "סמן כלא הושלם" : "סמן כהושלם"}
                  className={`h-5 w-5 shrink-0 rounded border-2 grid place-content-center transition ${
                    t.is_completed
                      ? "bg-neon border-neon text-background"
                      : "border-border hover:border-neon"
                  }`}
                >
                  {t.is_completed && (
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M4 10l4 4 8-8" />
                    </svg>
                  )}
                </button>

                {isEditing ? (
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(t);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => void saveEdit(t)}
                    maxLength={200}
                    className="flex-1 min-w-0 bg-input border border-neon/60 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-neon/60"
                  />
                ) : (
                  <span
                    className={`flex-1 min-w-0 break-words text-sm leading-snug ${
                      t.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {t.title}
                  </span>
                )}

                {isEditing ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void saveEdit(t);
                    }}
                    aria-label="שמור"
                    className="shrink-0 h-8 w-8 grid place-content-center rounded text-neon hover:bg-neon/10"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleUrgent(t);
                      }}
                      aria-label={t.is_urgent ? "בטל דחיפות" : "סמן כדחוף"}
                      title={t.is_urgent ? "דחוף" : "סמן כדחוף"}
                      className={`shrink-0 h-8 w-8 grid place-content-center rounded transition ${
                        t.is_urgent
                          ? "text-orange-400 bg-orange-500/15"
                          : "text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"
                      }`}
                    >
                      <Flame className={`h-4 w-4 ${t.is_urgent ? "fill-orange-400/30" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(t);
                      }}
                      aria-label="ערוך"
                      className="shrink-0 h-8 w-8 grid place-content-center rounded text-muted-foreground hover:text-neon hover:bg-accent/40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(t);
                      }}
                      aria-label="מחק משימה"
                      className="shrink-0 h-8 w-8 grid place-content-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            );
          }}
        </SortableList>
      )}
    </div>
  );
}
