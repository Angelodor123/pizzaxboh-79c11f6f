import { useEffect, useState } from "react";
import { Pizza, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { toast } from "sonner";

interface PrepItem {
  id: string;
  name: string;
  unit: string;
}

export function DoughStatusCard() {
  const branchId = useActiveBranch();
  const [item, setItem] = useState<PrepItem | null>(null);
  const [current, setCurrent] = useState<number>(0);
  const [logDate, setLogDate] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!branchId) return;
    const { data: pi } = await supabase
      .from("prep_items")
      .select("id,name,unit")
      .eq("branch_id", branchId)
      .eq("active", true)
      .ilike("name", "%בצק%")
      .limit(1)
      .maybeSingle();
    if (!pi) return;
    setItem(pi as PrepItem);
    const { data: today } = await supabase.rpc("operational_today");
    const date = today as string;
    setLogDate(date);
    const { data: log } = await supabase
      .from("prep_log")
      .select("current_stock")
      .eq("prep_item_id", (pi as PrepItem).id)
      .eq("log_date", date)
      .maybeSingle();
    setCurrent(Number(log?.current_stock ?? 0));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const submit = async () => {
    if (!item || !logDate) return;
    const n = Math.max(0, Math.min(999, Math.floor(Number(draft))));
    if (!Number.isFinite(n)) {
      toast.error("יש להזין מספר תקין");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("prep_log")
      .upsert(
        {
          prep_item_id: item.id,
          log_date: logDate,
          current_stock: n,
          completed: n > 0,
        },
        { onConflict: "prep_item_id,log_date" },
      );
    setSaving(false);
    if (error) {
      toast.error("שמירה נכשלה");
      return;
    }
    setCurrent(n);
    setOpen(false);
    toast.success(`עודכן: ${n} מגשי בצק`);
  };

  const openModal = () => {
    setDraft(String(current));
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        data-tour="dough-status"
        className="text-right rounded-xl border-2 border-amber-500/40 hover:border-amber-400 bg-amber-500/5 p-4 transition flex flex-col gap-1 w-full"
        aria-label="עדכון סטטוס בצקים"
      >
        <div className="flex items-center gap-2 text-amber-300">
          <Pizza className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
            סטטוס בצקים
          </span>
        </div>
        <div className="font-display text-3xl font-black text-amber-300 tabular-nums leading-tight">
          {current}
        </div>
        <div className="text-xs text-foreground/70">
          {current === 1 ? "מגש מוכן" : "מגשים מוכנים"} · לחיצה לעדכון
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setOpen(false)}
          dir="rtl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-amber-500/40 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">
                עדכן כמות מגשי בצק
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="w-full bg-background border-2 border-border focus:border-amber-400 focus:outline-none rounded-lg px-3 py-3 text-center font-display text-3xl font-black tabular-nums"
            />
            <div className="text-xs text-muted-foreground text-center">
              ייסונכרן לפס ההכנות היומי ({item?.name ?? "בצקים"})
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="w-full h-11 rounded-lg bg-amber-500 text-zinc-900 font-bold disabled:opacity-50"
            >
              {saving ? "שומר…" : "שמור עדכון"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
