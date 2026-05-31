import { useEffect, useState } from "react";
import { Pizza, X, History, Store, Snowflake, Refrigerator, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { toast } from "sonner";

interface PrepItem {
  id: string;
  name: string;
  unit: string;
}

type DoughLocation = "shop" | "southern_freezer" | "southern_fridge" | "warehouse";

interface DoughLogRow {
  id: string;
  trays_count: number;
  updated_by_name: string | null;
  created_at: string;
  location: DoughLocation;
}

const LOCATION_LABEL: Record<DoughLocation, string> = {
  shop: "בפיצה",
  southern_freezer: "מקפיא מחסן דרומי",
  southern_fridge: "מקרר מחסן דרומי",
  warehouse: "במחסן",
};

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
  const [shopCount, setShopCount] = useState<number>(0);
  const [southernFreezerCount, setSouthernFreezerCount] = useState<number>(0);
  const [southernFridgeCount, setSouthernFridgeCount] = useState<number>(0);
  const [logDate, setLogDate] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<DoughLogRow | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DoughLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shopDraft, setShopDraft] = useState<string>("");
  const [freezerDraft, setFreezerDraft] = useState<string>("");
  const [fridgeDraft, setFridgeDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const total = shopCount + southernFreezerCount + southernFridgeCount;

  const loadLatest = async (itemId: string, branch: string) => {
    const { data: dayStart } = await supabase.rpc("operational_day_start");
    const cutoff = (dayStart as string) ?? new Date(0).toISOString();
    const { data } = await supabase
      .from("dough_updates_log")
      .select("id,trays_count,updated_by_name,created_at,location")
      .eq("branch_id", branch)
      .eq("prep_item_id", itemId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data as DoughLogRow[]) ?? [];
    setLastUpdate(rows[0] ?? null);
    const latestShop = rows.find((r) => r.location === "shop");
    const latestFreezer = rows.find((r) => r.location === "southern_freezer");
    const latestFridge = rows.find((r) => r.location === "southern_fridge");
    setShopCount(latestShop ? Number(latestShop.trays_count) : 0);
    setSouthernFreezerCount(latestFreezer ? Number(latestFreezer.trays_count) : 0);
    setSouthernFridgeCount(latestFridge ? Number(latestFridge.trays_count) : 0);
  };

  const load = async () => {
    if (!branchId) return;
    let { data: pi } = await supabase
      .from("prep_items")
      .select("id,name,unit")
      .eq("branch_id", branchId)
      .eq("active", true)
      .ilike("name", "%בצק%")
      .limit(1)
      .maybeSingle();
    if (!pi) {
      const { data: created } = await supabase
        .from("prep_items")
        .insert({
          branch_id: branchId,
          name: "בצקים",
          unit: "מגשים",
          active: true,
        })
        .select("id,name,unit")
        .maybeSingle();
      if (!created) return;
      pi = created;
    }
    setItem(pi as PrepItem);
    const { data: today } = await supabase.rpc("operational_today");
    const date = today as string;
    setLogDate(date);

    await loadLatest((pi as PrepItem).id, branchId);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    const check = async () => {
      const { data: today } = await supabase.rpc("operational_today");
      const dateStr = today as string;
      if (dateStr && dateStr !== logDate) {
        await load();
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => void check(), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, logDate]);

  const openHistory = async () => {
    if (!item || !branchId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("dough_updates_log")
      .select("id,trays_count,updated_by_name,created_at,location")
      .eq("branch_id", branchId)
      .eq("prep_item_id", item.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as DoughLogRow[]) ?? []);
    setHistoryLoading(false);
  };

  const parseCount = (s: string) => {
    const trimmed = s.trim();
    if (trimmed === "") return NaN;
    const n = Math.max(0, Math.min(999, Math.floor(Number(trimmed))));
    return Number.isFinite(n) ? n : NaN;
  };

  const valueOrZero = (s: string) => {
    if (s.trim() === "") return 0;
    const n = parseCount(s);
    return Number.isFinite(n) ? n : 0;
  };

  const submit = async () => {
    if (!item || !logDate || !branchId) return;
    const shopN = valueOrZero(shopDraft);
    const freezerN = valueOrZero(freezerDraft);
    const fridgeN = valueOrZero(fridgeDraft);
    const totalN = shopN + freezerN + fridgeN;
    await persistCounts(shopN, freezerN, fridgeN, totalN);
    setOpen(false);
    toast.success(
      `עודכן: ${totalN} מגשים (פיצה ${shopN} · מקפיא ${freezerN} · מקרר ${fridgeN})`,
    );
  };

  const persistCounts = async (
    shopN: number,
    freezerN: number,
    fridgeN: number,
    totalN: number,
  ) => {
    if (!item || !logDate || !branchId) return;
    setSaving(true);
    const { error } = await supabase.from("prep_log").upsert(
      {
        prep_item_id: item.id,
        log_date: logDate,
        current_stock: totalN,
        completed: totalN > 0,
      },
      { onConflict: "prep_item_id,log_date" },
    );
    if (error) {
      setSaving(false);
      toast.error("שמירה נכשלה");
      return;
    }

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
        (prof?.full_name as string | undefined) ?? (user.email ?? null);
    }

    const baseRow = {
      branch_id: branchId,
      prep_item_id: item.id,
      updated_by: user?.id ?? null,
      updated_by_name: userName,
    };

    const rows: Array<typeof baseRow & { trays_count: number; location: DoughLocation }> = [];
    if (shopN !== shopCount) rows.push({ ...baseRow, trays_count: shopN, location: "shop" });
    if (freezerN !== southernFreezerCount)
      rows.push({ ...baseRow, trays_count: freezerN, location: "southern_freezer" });
    if (fridgeN !== southernFridgeCount)
      rows.push({ ...baseRow, trays_count: fridgeN, location: "southern_fridge" });
    if (rows.length === 0) {
      rows.push({ ...baseRow, trays_count: shopN, location: "shop" });
    }
    const { data: inserted } = await supabase
      .from("dough_updates_log")
      .insert(rows)
      .select("id,trays_count,updated_by_name,created_at,location");

    setSaving(false);
    // Optimistic UI
    setShopCount(shopN);
    setSouthernFreezerCount(freezerN);
    setSouthernFridgeCount(fridgeN);
    const newest = (inserted as DoughLogRow[] | null)?.sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    )[0];
    if (newest) setLastUpdate(newest);
  };

  const handleReset = async () => {
    if (!item || !logDate || !branchId) return;
    if (!confirm("לאפס את כמות הבצקים ל-0?")) return;
    await persistCounts(0, 0, 0, 0);
    toast.success("הסטטוס אופס ל-0");
  };

  const openModal = () => {
    setShopDraft(String(shopCount));
    setFreezerDraft(String(southernFreezerCount));
    setFridgeDraft(String(southernFridgeCount));
    setOpen(true);
  };

  const draftTotal =
    valueOrZero(shopDraft) + valueOrZero(freezerDraft) + valueOrZero(fridgeDraft);

  return (
    <>
      <div
        data-tour="dough-status"
        className="relative text-right rounded-xl border-2 border-amber-500/40 hover:border-amber-400 bg-amber-500/5 p-4 transition flex flex-col gap-1 w-full"
      >
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            aria-label="איפוס סטטוס בצקים"
            title="איפוס לאפס"
            className="h-7 w-7 grid place-content-center rounded-md text-amber-300/70 hover:text-amber-300 hover:bg-amber-500/10 transition disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={openHistory}
            aria-label="היסטוריית עדכוני בצק"
            className="h-7 w-7 grid place-content-center rounded-md text-amber-300/70 hover:text-amber-300 hover:bg-amber-500/10 transition"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
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
            {total}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-semibold tabular-nums">
              <Store className="h-3 w-3" />
              בפיצה: {shopCount}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-200 font-semibold tabular-nums">
              <Snowflake className="h-3 w-3" />
              מקפיא מחסן דרומי: {southernFreezerCount}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200 font-semibold tabular-nums">
              <Refrigerator className="h-3 w-3" />
              מקרר מחסן דרומי: {southernFridgeCount}
            </span>
          </div>
          {lastUpdate && (
            <div className="text-xs text-zinc-400 mt-1">
              עודכן ב-{formatTime(lastUpdate.created_at)}
            </div>
          )}
          <div className="text-xs text-foreground/70">
            סה״כ {total === 1 ? "מגש מוכן" : "מגשים מוכנים"} · לחיצה לעדכון
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

            <div className="grid grid-cols-1 gap-3">
              {([
                {
                  draft: shopDraft,
                  setDraft: setShopDraft,
                  label: "בפיצה",
                  Icon: Store,
                  color: "amber",
                  autoFocus: true,
                },
                {
                  draft: freezerDraft,
                  setDraft: setFreezerDraft,
                  label: "מקפיא מחסן דרומי",
                  Icon: Snowflake,
                  color: "sky",
                  autoFocus: false,
                },
                {
                  draft: fridgeDraft,
                  setDraft: setFridgeDraft,
                  label: "מקרר מחסן דרומי",
                  Icon: Refrigerator,
                  color: "emerald",
                  autoFocus: false,
                },
              ] as const).map((f) => (
                <label key={f.label} className="flex items-center gap-3 w-full">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold flex-1 ${
                      f.color === "amber"
                        ? "text-amber-200"
                        : f.color === "sky"
                          ? "text-sky-200"
                          : "text-emerald-200"
                    }`}
                  >
                    <f.Icon className="h-3.5 w-3.5" /> {f.label}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    placeholder="0"
                    value={f.draft === "0" ? "" : f.draft}
                    onFocus={(e) => {
                      if (f.draft === "0") f.setDraft("");
                      e.currentTarget.select();
                    }}
                    onChange={(e) => f.setDraft(e.target.value)}
                    onBlur={() => {
                      if (f.draft.trim() === "") f.setDraft("0");
                    }}
                    autoFocus={f.autoFocus}
                    className={`w-24 h-11 bg-background border-2 border-border focus:outline-none rounded-lg px-3 text-center font-display text-2xl font-black tabular-nums ${
                      f.color === "amber"
                        ? "focus:border-amber-400"
                        : f.color === "sky"
                          ? "focus:border-sky-400"
                          : "focus:border-emerald-400"
                    }`}
                  />
                </label>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              סה״כ:{" "}
              <span className="font-bold text-amber-300 tabular-nums">
                {draftTotal}
              </span>{" "}
              מגשים
            </div>
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
                history.map((row) => {
                  const label = LOCATION_LABEL[row.location] ?? row.location;
                  const tone =
                    row.location === "shop"
                      ? "text-amber-300"
                      : row.location === "southern_freezer"
                        ? "text-sky-300"
                        : row.location === "southern_fridge"
                          ? "text-emerald-300"
                          : "text-zinc-300";
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 py-2 border-b border-zinc-800 last:border-0"
                    >
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${tone}`}>
                          {label}: {row.trays_count} מגשים
                        </div>
                        <div className="text-xs text-zinc-500">
                          {row.updated_by_name ?? "—"}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 tabular-nums">
                        {formatDateTime(row.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
