import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCookbookStore } from "@/lib/store";
import type { Task } from "@/lib/tasks";

interface PrepItemLite {
  id: string;
  name: string;
}

interface Props {
  task: Task | null;
  branchId: string | null;
  onClose: () => void;
  onSaved: (updated: Task) => void;
}

export function QuickEditTaskDialog({ task, branchId, onClose, onSaved }: Props) {
  const recipes = useCookbookStore((s) => s.recipes);
  const [name, setName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [prepItemId, setPrepItemId] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [prepItems, setPrepItems] = useState<PrepItemLite[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync form state when task changes
  useEffect(() => {
    if (!task) return;
    setName(task.name);
    setRecipeId(task.recipe_id ?? "");
    setPrepItemId(task.prep_item_id ?? "");
    setSortOrder(task.sort_order);
    setActive(task.active);
  }, [task]);

  // Lazy-load prep items list once a task is open
  useEffect(() => {
    if (!task || !branchId) return;
    let abort = false;
    (async () => {
      const { data } = await supabase
        .from("prep_items")
        .select("id,name")
        .eq("branch_id", branchId)
        .eq("active", true)
        .order("name");
      if (abort) return;
      setPrepItems((data ?? []) as PrepItemLite[]);
    })();
    return () => {
      abort = true;
    };
  }, [task, branchId]);

  const open = !!task;

  const handleSave = async () => {
    if (!task) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("שם המשימה לא יכול להיות ריק");
      return;
    }
    if (trimmed.length > 200) {
      toast.error("שם המשימה ארוך מדי (עד 200 תווים)");
      return;
    }
    setSaving(true);
    const patch = {
      name: trimmed,
      recipe_id: recipeId || null,
      prep_item_id: prepItemId || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : task.sort_order,
      active,
    };
    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("המשימה עודכנה");
    onSaved({ ...task, ...patch });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        className="bg-card border-r border-border w-[92%] sm:w-[440px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-right font-display text-xl">
            עריכת משימה מהירה
          </SheetTitle>
          <SheetDescription className="text-right text-xs">
            עריכה ישירה של שדות המשימה. השינוי נשמר מיד לכל הסניף.
          </SheetDescription>
        </SheetHeader>

        {task && (
          <div className="mt-5 space-y-4 text-right" dir="rtl">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                שם המשימה
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-3 py-2 text-sm text-right"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                קישור למתכון
              </label>
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-2 py-2 text-sm text-right"
              >
                <option value="">— ללא קישור —</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameHebrew}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                קישור לפריט הכנה (PAR)
              </label>
              <select
                value={prepItemId}
                onChange={(e) => setPrepItemId(e.target.value)}
                className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-2 py-2 text-sm text-right"
              >
                <option value="">— ללא קישור —</option>
                {prepItems.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                כאשר כל קבוצת המשימות מסומנת כבוצעה, המלאי של הפריט המקושר מתעדכן לרמת היעד.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  סדר הצגה
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-3 py-2 text-sm text-right tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  סטטוס
                </label>
                <label className="flex items-center gap-2 bg-input border border-border rounded-md px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="accent-neon"
                  />
                  <span className="text-sm">{active ? "פעילה" : "מוסתרת"}</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md glow-neon text-xs disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                שמור שינויים
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
