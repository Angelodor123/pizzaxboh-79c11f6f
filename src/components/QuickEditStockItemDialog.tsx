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
import { ModalDeleteButton } from "@/components/ModalDeleteButton";

export interface StockItem {
  id: string;
  name: string;
  unit: string;
  barcode?: string | null;
  target_sun: number;
  target_mon: number;
  target_tue: number;
  target_wed: number;
  target_thu: number;
  target_fri: number;
  target_sat: number;
  sort_order: number;
  active?: boolean;
}

interface Props {
  item: StockItem | null;
  kind: "prep" | "restock";
  onClose: () => void;
  onSaved: (updated: StockItem) => void;
  onDeleted?: (id: string) => void;
}

const DAY_COLS = [
  "target_sun",
  "target_mon",
  "target_tue",
  "target_wed",
  "target_thu",
  "target_fri",
  "target_sat",
] as const;
const WEEKDAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function QuickEditStockItemDialog({ item, kind, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [barcode, setBarcode] = useState("");
  const [targets, setTargets] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setUnit(item.unit ?? "");
    setBarcode(item.barcode ?? "");
    setTargets(DAY_COLS.map((c) => Number(item[c]) || 0));
    setSortOrder(item.sort_order);
    setActive(item.active ?? true);
  }, [item]);

  const open = !!item;
  const title = kind === "prep" ? "עריכת פריט הכנה" : "עריכת פריט השלמה";

  const handleSave = async () => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("שם הפריט לא יכול להיות ריק");
      return;
    }
    if (trimmed.length > 200) {
      toast.error("שם הפריט ארוך מדי (עד 200 תווים)");
      return;
    }
    setSaving(true);
    const patch: Record<string, unknown> = {
      name: trimmed,
      unit: unit.trim(),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : item.sort_order,
      active,
    };
    DAY_COLS.forEach((col, i) => {
      patch[col] = Number.isFinite(targets[i]) ? targets[i] : 0;
    });
    if (kind === "restock") {
      patch.barcode = barcode.trim() || null;
    }
    const { error } =
      kind === "prep"
        ? await supabase.from("prep_items").update(patch as never).eq("id", item.id)
        : await supabase.from("restock_items").update(patch as never).eq("id", item.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("הפריט עודכן");
    onSaved({ ...item, ...(patch as Partial<StockItem>) } as StockItem);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        className="bg-card border-r border-border w-[92%] sm:w-[440px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-right font-display text-xl">{title}</SheetTitle>
          <SheetDescription className="text-right text-xs">
            עריכה ישירה של שדות הפריט. השינוי נשמר מיד לכל הסניף.
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="mt-5 space-y-4 text-right" dir="rtl">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                שם הפריט
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-3 py-2 text-sm text-right"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  יחידת מידה
                </label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={32}
                  className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-3 py-2 text-sm text-right"
                />
              </div>
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
            </div>

            {kind === "restock" && (
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  ברקוד
                </label>
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  maxLength={64}
                  className="w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-3 py-2 text-sm text-right font-mono"
                  placeholder="—"
                />
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-muted-foreground mb-2">
                יעדים יומיים
              </div>
              <div className="grid grid-cols-4 gap-2">
                {WEEKDAY_HE.map((d, i) => (
                  <label key={d} className="text-[10px] text-muted-foreground">
                    {d}
                    <input
                      type="number"
                      min="0"
                      value={targets[i]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTargets((p) =>
                          p.map((x, idx) => (idx === i ? (Number.isFinite(v) ? v : 0) : x)),
                        );
                      }}
                      className="mt-1 w-full bg-input border border-border focus:border-neon/60 focus:outline-none rounded-md px-2 py-1.5 text-sm text-right tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 bg-input border border-border rounded-md px-3 py-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="accent-neon"
                />
                <span className="text-sm">{active ? "פעיל" : "מוסתר"}</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <ModalDeleteButton
                title={`מחיקת "${item.name}"`}
                description="האם למחוק פריט זה לצמיתות?"
                onConfirm={async () => {
                  const table = kind === "prep" ? "prep_items" : "restock_items";
                  const { error } = await supabase.from(table).delete().eq("id", item.id);
                  if (error) {
                    toast.error(error.message);
                    throw error;
                  }
                  toast.success("הפריט נמחק");
                  onDeleted?.(item.id);
                  onClose();
                }}
              />
              <div className="flex items-center gap-2">
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
