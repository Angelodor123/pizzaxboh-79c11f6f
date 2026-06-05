import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WEEKDAY_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const DAY_COLS = [
  "target_sun", "target_mon", "target_tue", "target_wed",
  "target_thu", "target_fri", "target_sat",
] as const;

export type QuickAddKind = "prep" | "restock";

interface UnitOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  kind: QuickAddKind;
  branchId: string | null;
  onCreated: (newItem: Record<string, unknown>) => void;
}

export function QuickAddItemModal({ open, onClose, kind, branchId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [targets, setTargets] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from("measurement_units")
        .select("id,name")
        .order("sort_order")
        .order("name");
      setUnits((data ?? []) as UnitOption[]);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setName(""); setUnit(""); setBarcode("");
      setTargets([0, 0, 0, 0, 0, 0, 0]);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) {
      toast.error("שם הפריט חובה");
      return;
    }
    if (!branchId) {
      toast.error("אין סניף פעיל");
      return;
    }
    setSaving(true);
    const base: Record<string, unknown> = {
      branch_id: branchId,
      name: name.trim(),
      unit: unit.trim(),
      active: true,
    };
    DAY_COLS.forEach((col, i) => { base[col] = targets[i] || 0; });
    if (kind === "restock" && barcode.trim()) base.barcode = barcode.trim();

    const table = kind === "prep" ? "prep_items" : "restock_items";
    const { data, error } = await supabase
      .from(table)
      .insert(base as never)
      .select()
      .single();
    setSaving(false);

    if (error) {
      toast.error(`שגיאה: ${error.message}`);
      return;
    }
    toast.success("פריט נוסף");
    onCreated(data as Record<string, unknown>);
    onClose();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-neon bg-card p-5 glow-neon"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">
            {kind === "prep" ? "פריט הכנה חדש" : "פריט מחסן חדש"}
          </h2>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted/50 inline-flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">שם הפריט</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm"
              placeholder="לדוגמה: בצק מרגריטה"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">יחידת מידה</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm"
            >
              <option value="">— ללא —</option>
              {units.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </label>

          {kind === "restock" && (
            <label className="block">
              <span className="text-xs text-muted-foreground">ברקוד (אופציונלי)</span>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-right text-sm font-mono"
                placeholder="..."
              />
            </label>
          )}

          <div>
            <div className="text-xs text-muted-foreground mb-1">יעדים יומיים</div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_HE.map((d, i) => (
                <label key={i} className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">{d}</div>
                  <input
                    type="number"
                    min="0"
                    value={targets[i] || ""}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setTargets((p) => p.map((x, idx) => (idx === i ? v : x)));
                    }}
                    className="w-full bg-input border border-border rounded px-1 py-1.5 text-center text-sm"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => void submit()}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-neon text-primary-foreground py-3 font-bold glow-neon disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "שומר…" : "הוספה לרשימה"}
          </button>
        </div>
      </div>
    </div>
  );
}
