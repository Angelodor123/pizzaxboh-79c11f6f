import { useEffect, useState } from "react";
import { X, Truck, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChecklistItem {
  id: string;
  name: string;
  is_received: boolean;
}

interface Props {
  eventId: string;
  eventTitle: string;
  date: string; // YYYY-MM-DD — occurrence date
  templateItems: ChecklistItem[]; // from the master event
  initialItems?: ChecklistItem[] | null; // from override (if exists)
  overrideId?: string | null;
  onClose: () => void;
}

/**
 * Per-day delivery checklist. Lets employees check off items as goods arrive.
 * State is persisted on calendar_event_overrides.expected_items for the specific date.
 */
export function DeliveryChecklistModal({
  eventId,
  eventTitle,
  date,
  templateItems,
  initialItems,
  overrideId,
  onClose,
}: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Merge: start from template, overlay saved state by id.
    const base = templateItems.map((t) => ({ ...t, is_received: false }));
    if (initialItems && initialItems.length > 0) {
      for (const saved of initialItems) {
        const idx = base.findIndex((b) => b.id === saved.id);
        if (idx >= 0) base[idx] = { ...base[idx], is_received: !!saved.is_received };
        else base.push({ id: saved.id, name: saved.name, is_received: !!saved.is_received });
      }
    }
    setItems(base);
  }, [templateItems, initialItems]);

  const toggle = async (idx: number) => {
    const next = items.map((it, i) => (i === idx ? { ...it, is_received: !it.is_received } : it));
    setItems(next);
    setSaving(true);
    const payload = {
      event_id: eventId,
      override_date: date,
      deleted: false,
      expected_items: next,
    };
    const { error } = await supabase
      .from("calendar_event_overrides")
      .upsert(payload, { onConflict: "event_id,override_date" });
    setSaving(false);
    if (error) {
      toast.error("שמירה נכשלה: " + error.message);
      // Revert UI on failure
      setItems(items);
    }
  };

  const total = items.length;
  const done = items.filter((i) => i.is_received).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-success/60 rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        style={{ borderInlineStartWidth: 4, borderInlineStartColor: "var(--success)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-success" />
              צ׳קליסט קבלת סחורה
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eventTitle} · {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {total > 0 && (
          <div className="text-xs text-muted-foreground font-bold text-center">
            {done} / {total} התקבל
            {saving && <span className="mr-2 text-neon">שומר…</span>}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            לא הוגדרו פריטים צפויים לאירוע זה.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-right transition active:scale-[0.98] ${
                    it.is_received
                      ? "border-success bg-success/10"
                      : "border-border bg-background/40 hover:border-neon"
                  }`}
                >
                  <span
                    className={`h-7 w-7 shrink-0 rounded-md border-2 grid place-content-center transition ${
                      it.is_received
                        ? "bg-success border-success text-background"
                        : "border-border"
                    }`}
                  >
                    {it.is_received && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span
                    className={`flex-1 font-bold text-sm ${
                      it.is_received ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {it.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
