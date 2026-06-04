import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface PersonalTask {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

/**
 * Personal tasks widget — each user's private ad-hoc todo list.
 * RLS scopes rows to `auth.uid() = user_id`.
 */
export function PersonalTasksCard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

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
        .eq("user_id", userId)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("שגיאה בטעינת המשימות האישיות");
      else setTasks((data ?? []) as PersonalTask[]);
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
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) => prev.map((t) => (t.id === (payload.new as PersonalTask).id ? (payload.new as PersonalTask) : t)));
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
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert({ user_id: userId, title: t })
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
      return [data as PersonalTask, ...prev];
    });
  };

  const toggle = async (task: PersonalTask) => {
    const next = !task.is_completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: next } : t)));
    const { error } = await supabase
      .from("personal_tasks")
      .update({ is_completed: next })
      .eq("id", task.id);
    if (error) {
      toast.error("העדכון נכשל");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: task.is_completed } : t)));
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
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
                t.is_completed
                  ? "border-zinc-800 bg-zinc-900/30 opacity-60"
                  : "border-border bg-background/40"
              }`}
            >
              <button
                type="button"
                onClick={() => void toggle(t)}
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
              <span className={`flex-1 text-sm leading-snug ${t.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => void remove(t)}
                aria-label="מחק משימה"
                className="h-8 w-8 shrink-0 grid place-content-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
