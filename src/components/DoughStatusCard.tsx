import { useEffect, useState } from "react";
import { Pizza, X, History, Store, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { toast } from "sonner";

interface PrepItem {
  id: string;
  name: string;
  unit: string;
}

type DoughLocation = "shop" | "warehouse";

interface DoughLogRow {
  id: string;
  trays_count: number;
  updated_by_name: string | null;
  created_at: string;
  location: DoughLocation;
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
  const [shopCount, setShopCount] = useState<number>(0);
  const [warehouseCount, setWarehouseCount] = useState<number>(0);
  const [logDate, setLogDate] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<DoughLogRow | null>(null);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DoughLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shopDraft, setShopDraft] = useState<string>("");
  const [warehouseDraft, setWarehouseDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const total = shopCount + warehouseCount;

  const loadLatest = async (itemId: string, branch: string) => {
    const { data } = await supabase
      .from("dough_updates_log")
      .select("id,trays_count,updated_by_name,created_at,location")
      .eq("branch_id", branch)
      .eq("prep_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data as DoughLogRow[]) ?? [];
    setLastUpdate(rows[0] ?? null);
    const latestShop = rows.find((r) => r.location === "shop");
    const latestWh = rows.find((r) => r.location === "warehouse");
    if (latestShop) setShopCount(Number(latestShop.trays_count));
    if (latestWh) setWarehouseCount(Number(latestWh.trays_count));
    return { latestShop, latestWh };
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
    const fallbackTotal = Number(log?.current_stock ?? 0);
    const { latestShop, latestWh } = await loadLatest(
      (pi as PrepItem).id,
      branchId,
    );
    // If we have no per-location history yet, seed shop with the existing total.
    if (!latestShop && !latestWh && fallbackTotal > 0) {
      setShopCount(fallbackTotal);
    }
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
      .select("id,trays_count,updated_by_name,created_at,location")
      .eq("branch_id", branchId)
      .eq("prep_item_id", item.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as DoughLogRow[]) ?? []);
    setHistoryLoading(false);
  };

  const parseCount = (s: string) => {
    if (s.trim() === "") return 0;
    const n = Math.max(0, Math.min(999, Math.floor(Number(s))));
    return Number.isFinite(n) ? n : NaN;
  };

  const submit = async () => {
    if (!item || !logDate || !branchId) return;
    const shopN = parseCount(shopDraft);
    const whN = parseCount(warehouseDraft);
    if (!Number.isFinite(shopN) || !Number.isFinite(whN)) {
      toast.error("יש להזין מספרים תקינים");
      return;
    }
    const totalN = shopN + whN;
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

    const rows: Array<{
      branch_id: string;
      prep_item_id: string;
      trays_count: number;
      updated_by: string | null;
      updated_by_name: string | null;
      location: DoughLocation;
    }> = [];
    if (shopN !== shopCount) {
      rows.push({
        branch_id: branchId,
        prep_item_id: item.id,
        trays_count: shopN,
        updated_by: user?.id ?? null,
        updated_by_name: userName,
        location: "shop",
      });
    }
    if (whN !== warehouseCount) {
      rows.push({
        branch_id: branchId,
        prep_item_id: item.id,
        trays_count: whN,
        updated_by: user?.id ?? null,
        updated_by_name: userName,
        location: "warehouse",
      });
    }
    if (rows.length === 0) {
      // Always log at least one snapshot so updated_at is fresh
      rows.push({
        branch_id: branchId,
        prep_item_id: item.id,
        trays_count: shopN,
        updated_by: user?.id ?? null,
        updated_by_name: userName,
        location: "shop",
      });
    }
    await supabase.from("dough_updates_log").insert(rows);

    setSaving(false);
    setShopCount(shopN);
    setWarehouseCount(whN);
    setOpen(false);
    toast.success(`עודכן: ${totalN} מגשים (פיצה ${shopN} · מחסן ${whN})`);
    void loadLatest(item.id, branchId);
  };

  const openModal = () => {
    setShopDraft(shopCount ? String(shopCount) : "");
    setWarehouseDraft(warehouseCount ? String(warehouseCount) : "");
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
            {total}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-semibold tabular-nums">
              <Store className="h-3 w-3" />
              בפיצה: {shopCount}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-200 font-semibold tabular-nums">
              <Warehouse className="h-3 w-3" />
              במחסן: {warehouseCount}
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

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-200">
                  <Store className="h-3.5 w-3.5" /> בפיצה
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  placeholder="0"
                  value={shopDraft}
                  onChange={(e) => setShopDraft(e.target.value)}
                  autoFocus
                  className="w-full h-11 bg-background border-2 border-border focus:border-amber-400 focus:outline-none rounded-lg px-3 text-center font-display text-2xl font-black tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-xs font-semibold text-sky-200">
                  <Warehouse className="h-3.5 w-3.5" /> במחסן
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  placeholder="0"
                  value={warehouseDraft}
                  onChange={(e) => setWarehouseDraft(e.target.value)}
                  className="w-full h-11 bg-background border-2 border-border focus:border-sky-400 focus:outline-none rounded-lg px-3 text-center font-display text-2xl font-black tabular-nums"
                />
              </label>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              סה״כ:{" "}
              <span className="font-bold text-amber-300 tabular-nums">
                {(parseCount(shopDraft) || 0) + (parseCount(warehouseDraft) || 0)}
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
                  const isShop = row.location === "shop";
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col gap-1 p-3 border-b border-zinc-800/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isShop
                              ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
                              : "bg-sky-500/15 text-sky-200 border border-sky-500/30"
                          }`}
                        >
                          {isShop ? (
                            <Store className="h-3 w-3" />
                          ) : (
                            <Warehouse className="h-3 w-3" />
                          )}
                          {isShop ? "בפיצה" : "במחסן"}
                        </span>
                        <span className="text-base font-bold text-amber-300 tabular-nums">
                          {row.trays_count} מגשים
                        </span>
                      </div>
                      <div className="text-sm text-zinc-300">
                        {row.updated_by_name ?? "משתמש לא ידוע"}
                      </div>
                      <div className="text-xs text-zinc-500">
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
