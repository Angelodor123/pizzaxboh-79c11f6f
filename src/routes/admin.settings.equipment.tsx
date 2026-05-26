import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import type { EquipmentType } from "@/lib/maintenance-store";

export const Route = createFileRoute("/admin/settings/equipment")({
  component: EquipmentSettingsPage,
});

function EquipmentSettingsPage() {
  const { role, loading } = useAuth();
  const isManager = role === "admin";
  const [items, setItems] = useState<EquipmentType[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data } = await supabase
      .from("equipment_types")
      .select("id, name")
      .order("name");
    setItems((data ?? []) as EquipmentType[]);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) return null;
  if (!isManager) {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl">
        אין לך הרשאה לעמוד זה.
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("equipment_types").insert({ name });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "ציוד כבר קיים" : "שגיאה");
      return;
    }
    setNewName("");
    toast.success("נוסף");
    await refresh();
  };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase
      .from("equipment_types")
      .update({ name })
      .eq("id", id);
    if (error) {
      toast.error("שגיאה");
      return;
    }
    setEditingId(null);
    toast.success("עודכן");
    await refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: "למחוק את הציוד?",
      description: `"${name}" יוסר מהרישום. קריאות שירות קיימות עם הציוד הזה ישמרו אך השדה יתאפס.`,
      confirmText: "מחק",
      tone: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("equipment_types").delete().eq("id", id);
    if (error) {
      toast.error("מחיקה נכשלה");
      return;
    }
    toast.success("נמחק");
    await refresh();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">הגדרות ציוד</h1>

      <form
        onSubmit={handleAdd}
        className="flex gap-2 mb-6 rounded-xl border border-border bg-card/40 p-3"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="שם ציוד חדש..."
          className="flex-1 h-10 rounded-lg border border-border bg-background px-3"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="h-10 px-4 rounded-lg bg-neon text-primary-foreground font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          הוסף
        </button>
      </form>

      <div className="space-y-2">
        {items.map((eq) => (
          <div
            key={eq.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3"
          >
            {editingId === eq.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-border bg-background px-2"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(eq.id)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-neon text-primary-foreground"
                  aria-label="שמור"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border"
                  aria-label="ביטול"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium">{eq.name}</span>
                <button
                  onClick={() => {
                    setEditingId(eq.id);
                    setEditName(eq.name);
                  }}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border hover:border-neon/60"
                  aria-label="ערוך"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(eq.id, eq.name)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border hover:border-red-500/60 hover:text-red-400"
                  aria-label="מחק"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            אין ציוד רשום עדיין.
          </p>
        )}
      </div>
    </div>
  );
}
