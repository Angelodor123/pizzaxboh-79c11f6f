import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, History as HistoryIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";

export const Route = createFileRoute("/admin/history")({
  component: HistoryGate,
  head: () => ({ meta: [{ title: "היסטוריית פעילות — Pizza X" }] }),
});

type Kind = "prep" | "restock" | "orders" | "shortages";

const KIND_LABEL: Record<Kind, string> = {
  prep: "הכנות יומיות",
  restock: "רשימת מחסן",
  orders: "הזמנת סחורה",
  shortages: "חוסרים",
};

const KIND_ORDER: Kind[] = ["prep", "restock", "orders", "shortages"];

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHe(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  return dd.toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function HistoryGate() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center" dir="rtl">
        <ShieldAlert className="h-10 w-10 text-neon mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">אין הרשאת ניהול</h1>
        <p className="mt-2 text-sm text-muted-foreground">היסטוריית הפעילות זמינה למנהלים בלבד.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground">
          חזרה למטבח
        </Link>
      </div>
    );
  }
  return <HistoryPage />;
}

function HistoryPage() {
  const { isSuperAdmin } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const dateOptions = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDaysAgo(i + 1)), []);
  const [date, setDate] = useState(dateOptions[0]);
  const [kind, setKind] = useState<Kind>("prep");
  const [payload, setPayload] = useState<any[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingData(true);
      setPayload(null);
      let q = supabase
        .from("daily_operational_history")
        .select("payload, branch_id")
        .eq("snapshot_date", date)
        .eq("kind", kind);
      if (isSuperAdmin && branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const merged = (data ?? []).flatMap((r: any) => (Array.isArray(r.payload) ? r.payload : []));
      setPayload(merged);
      setLoadingData(false);
    })();
  }, [date, kind, branchId, isSuperAdmin]);

  const dateIdx = dateOptions.indexOf(date);
  const stepDate = (delta: number) => {
    const next = dateIdx + delta;
    if (next >= 0 && next < dateOptions.length) setDate(dateOptions[next]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Operations History</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          <HistoryIcon className="inline-block h-7 w-7 mb-1 ml-1 text-neon" />
          היסטוריית <span className="text-neon text-glow-neon">פעילות</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-2">נשמרים סנאפשוטים יומיים ל-14 ימים אחורה.</p>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
          <button
            onClick={() => stepDate(1)}
            disabled={dateIdx >= dateOptions.length - 1}
            className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30"
            aria-label="יום קודם"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-center font-bold text-sm focus:outline-none"
          >
            {dateOptions.map((d) => (
              <option key={d} value={d} className="bg-background">
                {formatHe(d)}
              </option>
            ))}
          </select>
          <button
            onClick={() => stepDate(-1)}
            disabled={dateIdx <= 0}
            className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30"
            aria-label="יום הבא"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`h-10 rounded-md border text-xs font-bold transition active:scale-95 ${
                kind === k
                  ? "border-neon bg-neon/10 text-neon shadow-[0_0_18px_color-mix(in_oklab,var(--neon)_28%,transparent)]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {loadingData ? (
        <div className="py-16 text-center text-muted-foreground">טוען…</div>
      ) : !payload || payload.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground rounded-xl border border-border bg-card/60">
          אין נתונים לתאריך זה.
        </div>
      ) : (
        <HistoryTable kind={kind} rows={payload} />
      )}
    </div>
  );
}

function HistoryTable({ kind, rows }: { kind: Kind; rows: any[] }) {
  if (kind === "prep" || kind === "restock") {
    const completedCount = rows.filter((r) => r.completed).length;
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground text-center mb-2">
          הושלמו: <span className="text-neon font-bold">{completedCount}</span> / {rows.length}
        </div>
        <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-right">פריט</th>
                <th className="p-2">יעד</th>
                <th className="p-2">בפועל</th>
                <th className="p-2">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const target = Number(r.target ?? 0);
                const stock = Number(r.current_stock ?? 0);
                const ok = stock >= target && target > 0;
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="p-2 text-right font-medium">{r.name}</td>
                    <td className="p-2 text-center tabular-nums">{target} {r.unit ?? ""}</td>
                    <td className="p-2 text-center tabular-nums">{stock} {r.unit ?? ""}</td>
                    <td className="p-2 text-center">
                      {r.completed || ok ? <span className="text-neon">✓</span> : <span className="text-amber-400">✗</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (kind === "shortages") {
    return (
      <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-right">פריט</th>
              <th className="p-2">כמות</th>
              <th className="p-2">הערות</th>
              <th className="p-2">טופל</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="p-2 text-right font-medium">{r.name}</td>
                <td className="p-2 text-center tabular-nums">{Number(r.quantity ?? 0)} {r.unit ?? ""}</td>
                <td className="p-2 text-center text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="p-2 text-center">
                  {r.completed ? <span className="text-neon">✓</span> : <span className="text-amber-400">✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // orders
  return (
    <div className="space-y-3">
      {rows.map((o, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">סטטוס: <span className="text-neon">{o.status}</span></span>
            <span className="text-muted-foreground">
              {o.sent_at ? new Date(o.sent_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
          {o.notes && <div className="text-xs text-muted-foreground mt-1">{o.notes}</div>}
          <ul className="mt-2 space-y-1 text-sm">
            {Array.isArray(o.items) && o.items.map((it: any, j: number) => (
              <li key={j} className="flex justify-between border-t border-border/40 pt-1">
                <span>{it.name ?? it.item_name ?? "—"}</span>
                <span className="tabular-nums text-muted-foreground">{it.quantity ?? it.qty ?? ""} {it.unit ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
