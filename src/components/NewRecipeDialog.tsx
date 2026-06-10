import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCookbookStore } from "@/lib/store";
import {
  categoryLabels,
  type Ingredient,
  type RecipeCategory,
} from "@/lib/cookbook";
import {
  BACK_OF_HOUSE_CATEGORIES,
  MENU_ITEM_CATEGORIES,
} from "@/lib/menu-categories";

const UNITS = ["גרם", 'ק"ג', 'מ"ל', "ליטר", "יחידות", "כפות", "כפיות"];

type Mode = "recipe" | "dish";

interface Props {
  mode: Mode;
  trigger?: React.ReactNode;
}

function slugify(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-א-ת]/g, "")
    .slice(0, 40);
}

export function NewRecipeDialog({ mode, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [baseYield, setBaseYield] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: "", quantity: 0, unit: "גרם" },
  ]);

  const allowedCats = useMemo<RecipeCategory[]>(
    () =>
      mode === "dish"
        ? (MENU_ITEM_CATEGORIES as RecipeCategory[])
        : (BACK_OF_HOUSE_CATEGORIES as RecipeCategory[]),
    [mode],
  );
  const [category, setCategory] = useState<RecipeCategory>(
    mode === "dish" ? "dishes" : "sauces_bases",
  );

  function reset() {
    setName("");
    setBaseYield("");
    setInstructions("");
    setIngredients([{ name: "", quantity: 0, unit: "גרם" }]);
    setCategory(mode === "dish" ? "dishes" : "sauces_bases");
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("נדרש שם מתכון");
      return;
    }
    const cleanIngredients = ingredients
      .map((i) => ({
        name: i.name.trim(),
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "גרם",
      }))
      .filter((i) => i.name.length > 0);

    setSaving(true);
    try {
      // Insert into ALL active branches (per user preference: changes apply
      // to both branches unless stated otherwise).
      const { data: branches, error: bErr } = await supabase
        .from("branches")
        .select("id")
        .eq("active", true);
      if (bErr) throw bErr;

      const baseSlug = slugify(name) || "recipe";
      const stamp = Date.now().toString(36);
      const rows = (branches ?? []).map((b, idx) => ({
        id: `${baseSlug}-${stamp}-${idx}`,
        branch_id: b.id,
        category,
        name_hebrew: name.trim(),
        base_yield_hebrew: baseYield.trim(),
        ingredients: cleanIngredients,
        instructions_hebrew: instructions.trim(),
        sort_order: 9999,
        deleted: false,
      }));

      if (rows.length === 0) throw new Error("לא נמצאו סניפים פעילים");

      const { error } = await supabase.from("recipes").insert(rows as never);
      if (error) throw error;

      toast.success(
        `נוסף ${mode === "dish" ? "מנה" : "מתכון"} ל-${rows.length} סניפים`,
      );
      await useCookbookStore.getState().refresh();
      reset();
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירה";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-neon text-neon text-xs font-bold hover:bg-neon/10"
          >
            <Plus className="h-3.5 w-3.5" />
            {mode === "dish" ? "מנה חדשה" : "מתכון חדש"}
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "dish" ? "מנה חדשה" : "מתכון חדש"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1">שם</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "dish" ? "לדוגמה: פיצה מרגריטה" : "לדוגמה: רוטב פסטו"}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">קטגוריה</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RecipeCategory)}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
              {allowedCats.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">
              תפוקה / כמות בסיס (אופציונלי)
            </label>
            <input
              value={baseYield}
              onChange={(e) => setBaseYield(e.target.value)}
              placeholder="לדוגמה: 5 ק&quot;ג / 10 מנות"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold">רכיבים</label>
              <button
                type="button"
                onClick={() =>
                  setIngredients((arr) => [
                    ...arr,
                    { name: "", quantity: 0, unit: "גרם" },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs text-neon font-bold"
              >
                <Plus className="h-3 w-3" /> הוסף רכיב
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <input
                    value={ing.name}
                    onChange={(e) =>
                      setIngredients((arr) =>
                        arr.map((x, i) =>
                          i === idx ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="שם רכיב"
                    className="flex-1 bg-input border border-border rounded-md px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ing.quantity || ""}
                    onChange={(e) =>
                      setIngredients((arr) =>
                        arr.map((x, i) =>
                          i === idx
                            ? { ...x, quantity: parseFloat(e.target.value) || 0 }
                            : x,
                        ),
                      )
                    }
                    placeholder="כמות"
                    className="w-20 bg-input border border-border rounded-md px-2 py-1.5 text-sm"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) =>
                      setIngredients((arr) =>
                        arr.map((x, i) =>
                          i === idx ? { ...x, unit: e.target.value } : x,
                        ),
                      )
                    }
                    className="w-20 bg-input border border-border rounded-md px-1 py-1.5 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setIngredients((arr) =>
                        arr.length === 1 ? arr : arr.filter((_, i) => i !== idx),
                      )
                    }
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="הסר רכיב"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">הוראות הכנה</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="שלב 1: ...&#10;שלב 2: ..."
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-3 rounded-md border border-border text-sm font-bold"
            >
              <X className="h-3.5 w-3.5 inline ml-1" /> ביטול
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-md bg-neon text-primary-foreground text-sm font-bold disabled:opacity-50"
            >
              {saving ? "שומר…" : "שמור"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
