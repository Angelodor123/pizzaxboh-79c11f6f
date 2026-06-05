import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";

type Branch = { id: string; name: string; active: boolean };

export function BranchesPanel() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("branches")
      .select("id, name, active")
      .order("name");
    setBranches((data as Branch[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    const { error } = await supabase.from("branches").insert({ name: clean });
    setBusy(false);
    if (error) {
      toast.error("שגיאה: " + error.message);
      return;
    }
    setName("");
    toast.success("הסניף נוצר");
    await load();
  };

  const toggleActive = async (b: Branch) => {
    const { error } = await supabase
      .from("branches")
      .update({ active: !b.active })
      .eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const saveRename = async (b: Branch) => {
    const clean = editingName.trim();
    if (!clean || clean === b.name) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase
      .from("branches")
      .update({ name: clean })
      .eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    toast.success("עודכן");
    await load();
  };

  const remove = async (b: Branch) => {
    const ok = await confirmDelete({
      title: "מחיקת סניף",
      description: `למחוק את הסניף "${b.name}"? פעולה זו תמחק את כל הנתונים התפעוליים המשויכים לסניף! פעולה זו אינה ניתנת לשחזור.`,
    });
    if (!ok) return;
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("הסניף נמחק");
    await load();
  };

  return (
    <section className="border border-border rounded-md p-5 bg-card/40">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Building2 className="h-5 w-5 text-neon shrink-0" />
        <div className="flex-1 text-right">
          <h2 className="font-display text-xl font-bold leading-none">
            ניהול <span className="text-neon text-glow-neon">סניפים</span>
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            כל סניף = מסד נתונים תפעולי נפרד. נראה רק לסופר-אדמין.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם סניף חדש"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-right"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> הוסף
        </button>
      </div>

      <ul className="border border-border rounded-md divide-y divide-border">
        {branches.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-muted-foreground">
            אין סניפים עדיין.
          </li>
        )}
        {branches.map((b) => (
          <li key={b.id} className="flex items-center justify-between px-3 py-2 gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => remove(b)}
                className="p-2 rounded-md hover:bg-background text-muted-foreground hover:text-destructive"
                aria-label="מחק"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleActive(b)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                  b.active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {b.active ? "פעיל" : "כבוי"}
              </button>
            </div>
            <div className="flex-1 text-right">
              {editingId === b.id ? (
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={() => saveRename(b)}
                    className="p-1.5 rounded text-emerald-400 hover:bg-background"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded text-muted-foreground hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="bg-input border border-border rounded px-2 py-1 text-right text-sm"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(b.id);
                    setEditingName(b.name);
                  }}
                  className="inline-flex items-center gap-2 text-sm font-bold hover:text-neon transition"
                >
                  <Pencil className="h-3 w-3 opacity-50" />
                  {b.name}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
