import { useEffect, useState } from "react";
import { Pizza, X, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { toast } from "sonner";

interface PrepItem {
  id: string;
  name: string;
  unit: string;
}

interface DoughLogRow {
  id: string;
  trays_count: number;
  updated_by_name: string | null;
  created_at: string;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function DoughStatusCard() {
  const branchId = useActiveBranch();
  const [item, setItem] = useState<PrepItem | null>(null);
  const [current, setCurrent] = useState<number>(0);
  const [logDate, setLogDate] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<DoughLogRow | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DoughLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadLatest = async (itemId: string, branch: string) => {
    const { data } = await supabase
      .from("dough_updates_log")
      .select("id,trays_count,updated_by_name,created_at")
      .eq("branch_id", branch)
      .eq("prep_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastUpdate((data as DoughLogRow) ?? null);
  };

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
    await loadLatest((pi as PrepItem).id, branchId);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const openHistory = async () => {
    if (!item || !branchId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("dough_updates_log")
      .select("id,trays_count,updated_by_name,created_at")
      .eq("branch_id", branchId)
      .eq("prep_item_id", item.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as DoughLogRow[]) ?? []);
    setHistoryLoading(false);
  };

  const submit = async () => {
    if (!item || !logDate || !branchId) return;
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
    if (error) {
      setSaving(false);
      toast.error("שמירה נכשלה");
      return;
    }

    // Log the update
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    let userName: string | null = null;
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      userName =
        (prof?.full_name as string | undefined) ??
        (user.email ?? null);
    }
    await supabase.from("dough_updates_log").insert({
      branch_id: branchId,
      prep_item_id: item.id,
      trays_count: n,
      updated_by: user?.id ?? null,
      updated_by_name: userName,
    });

    setSaving(false);
    setCurrent(n);
    setOpen(false);
    toast.success(`עודכן: ${n} מגשי בצק`);
    void loadLatest(item.id, branchId);
  };

  const openModal = () => {
    setDraft(String(current));
    setOpen(true);
  };

  return (
    <>
      <div
        data-tour="dough-status"
        className="relative text-right rounded-xl border-2 border-amber-500/40 hover:border-amber-400 bg-amber-500/5 p-4 transition flex flex-col gap-1 w-full"
      >
        <button
          type="button"
          onClick={openHistory}
          aria-label="היסטוריית עדכוני בצק"
          className="absolute top-2 left-2 h-7 w-7 grid place-content-center rounded-md text-amber-300/70 hover:text-amber-300 hover:bg-amber-500/10 transition"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openModal}
          className="text-right flex flex-col gap-1 w-full"
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
          {lastUpdate && (
            <div className="text-xs text-zinc-400 mt-1">
              עודכן ב-{formatTime(lastUpdate.created_at)}
            </div>
          )}
          <div className="text-xs text-foreground/70">
            {current === 1 ? "מגש מוכן" : "מגשים מוכנים"} · לחיצה לעדכון
          </div>
        </button>
      </div>

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

      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setHistoryOpen(false)}
          dir="rtl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-zinc-100">
                היסטוריית עדכוני בצק
              </h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="h-8 w-8 grid place-content-center rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-100"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto -mx-1 px-1">
              {historyLoading ? (
                <div className="text-center text-sm text-zinc-500 py-6">
                  טוען…
                </div>
              ) : history.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 py-6">
                  אין עדיין עדכונים
                </div>
              ) : (
                history.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-1 p-3 border-b border-zinc-800/50 last:border-0"
                  >
                    <div className="text-base font-bold text-amber-300 tabular-nums">
                      {row.trays_count} מגשים
                    </div>
                    <div className="text-sm text-zinc-300">
                      {row.updated_by_name ?? "משתמש לא ידוע"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDateTime(row.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
