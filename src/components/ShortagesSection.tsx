import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AlertTriangle, Plus, Check, Undo2, Trash2, Pencil } from "lucide-react";
import { confirmDelete } from "@/lib/confirm";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";

interface Shortage {
  id: string;
  branch_id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

const UNITS = ["יחידות", 'ק"ג', "גרם", "ליטר", 'מ"ל', "ארגזים", "שקיות"];

export function ShortagesSection() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  const [items, setItems] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Shortage | null>(null);
  const [draft, setDraft] = useState<{ name: string; quantity: string; unit: string; notes: string }>({
    name: "", quantity: "1", unit: "יחידות", notes: "",
  });

  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    const { data } = await supabase
      .from("shortage_items")
      .select("*")
      .eq("branch_id", branchId)
      .order("completed")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Shortage[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [branchId]);

  const startAdd = () => {
    setDraft({ name: "", quantity: "1", unit: "יחידות", notes: "" });
    setEditing(null);
    setAdding(true);
  };
  const startEdit = (s: Shortage) => {
    setDraft({ name: s.name, quantity: String(s.quantity), unit: s.unit || "יחידות", notes: s.notes ?? "" });
    setEditing(s);
    setAdding(true);
  };

  const save = async () => {
    if (!branchId) return toast.error("לא נבחר סניף");
    const name = draft.name.trim();
    if (!name) return toast.error("חסר שם פריט");
    const quantity = Number(draft.quantity) || 0;
    if (editing) {
      const { error } = await supabase
        .from("shortage_items")
        .update({ name, quantity, unit: draft.unit, notes: draft.notes || null })
        .eq("id", editing.id);
      if (error) return toast.error("שמירה נכשלה");
      toast.success("עודכן");
    } else {
      const { error } = await supabase
        .from("shortage_items")
        .insert({ branch_id: branchId, name, quantity, unit: draft.unit, notes: draft.notes || null, created_by: userId });
      if (error) return toast.error("הוספה נכשלה");
      toast.success("חוסר נוסף");
    }
    setAdding(false);
    setEditing(null);
    void load();
  };

  const toggleComplete = async (s: Shortage) => {
    const completed = !s.completed;
    const { error } = await supabase
      .from("shortage_items")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? userId : null,
      })
      .eq("id", s.id);
    if (error) return toast.error("שמירה נכשלה");
    void load();
  };

  const remove = async (s: Shortage) => {
    const ok = await confirmDelete({ title: "למחוק את החוסר?", description: s.name });
    if (!ok) return;
    const { error } = await supabase.from("shortage_items").delete().eq("id", s.id);
    if (error) return toast.error("מחיקה נכשלה");
    toast.success("נמחק");
    void load();
  };

  const open = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card/60 p-4" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="font-display text-lg font-bold">חוסרים</h2>
          <span className="text-xs text-muted-foreground">פתוחים: <span className="text-neon font-bold">{open.length}</span></span>
        </div>
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs font-bold bg-neon text-primary-foreground active:scale-95"
        >
          <Plus className="h-4 w-4" /> הוסף חוסר
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        חוסרים שלא טופלו עוברים אוטומטית ליום הבא. חוסרים שטופלו נארכבים אחרי 24 שעות.
      </p>

      {loading ? (
        <div className="py-6 text-center text-muted-foreground text-sm">טוען…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          אין חוסרים פתוחים. 🎉
        </div>
      ) : (
        <ul className="space-y-2">
          {[...open, ...done].map((s) => (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                s.completed ? "border-border/40 bg-muted/20 opacity-60" : "border-amber-400/30 bg-amber-400/5"
              }`}
            >
              <button
                onClick={() => toggleComplete(s)}
                className={`shrink-0 h-7 w-7 rounded-md border flex items-center justify-center ${
                  s.completed ? "bg-neon/20 border-neon text-neon" : "border-border hover:border-neon"
                }`}
                aria-label={s.completed ? "סמן כלא טופל" : "סמן כטופל"}
              >
                {s.completed ? <Check className="h-4 w-4" /> : <Undo2 className="h-4 w-4 opacity-0" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm truncate ${s.completed ? "line-through" : ""}`}>{s.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {Number(s.quantity)} {s.unit}{s.notes ? ` · ${s.notes}` : ""}
                </div>
              </div>
              <button onClick={() => startEdit(s)} className="p-1.5 rounded-md hover:bg-muted/40" aria-label="ערוך">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => remove(s)} className="p-1.5 rounded-md hover:bg-destructive/20" aria-label="מחק">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAdding(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="font-display text-lg font-bold">{editing ? "עריכת חוסר" : "חוסר חדש"}</h3>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="שם פריט"
              className="w-full h-11 px-3 rounded-md bg-background border border-border focus:border-neon outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.5"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                placeholder="כמות"
                className="h-11 px-3 rounded-md bg-background border border-border focus:border-neon outline-none tabular-nums"
              />
              <select
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                className="h-11 px-3 rounded-md bg-background border border-border focus:border-neon outline-none"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="הערות (לא חובה)"
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-background border border-border focus:border-neon outline-none text-sm"
            />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-md border border-border text-sm font-bold">
                ביטול
              </button>
              <button onClick={save} className="flex-1 h-11 rounded-md bg-neon text-primary-foreground text-sm font-bold">
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
