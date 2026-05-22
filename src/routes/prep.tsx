import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSwipe } from "@/hooks/use-swipe";
import { CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prep")({
  component: PrepPage,
  head: () => ({
    meta: [{ title: "הכנות יומיות — Pizza X" }],
  }),
});

const DAY_COLS = ["target_sun", "target_mon", "target_tue", "target_wed", "target_thu", "target_fri", "target_sat"] as const;
const WEEKDAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

interface Item {
  id: string;
  name: string;
  unit: string;
  target_sun: number; target_mon: number; target_tue: number; target_wed: number;
  target_thu: number; target_fri: number; target_sat: number;
  sort_order: number;
}

interface LogRow {
  prep_item_id: string;
  current_stock: number;
  completed: boolean;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PrepPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [items, setItems] = useState<Item[]>([]);
  const [log, setLog] = useState<Record<string, LogRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const wd = new Date().getDay();
  const targetCol = DAY_COLS[wd];
  const today = todayIso();

  useEffect(() => {
    void (async () => {
      const { data: it } = await supabase
        .from("prep_items").select("*").eq("active", true)
        .order("sort_order").order("name");
      setItems((it ?? []) as Item[]);
      const { data: lg } = await supabase
        .from("prep_log").select("prep_item_id,current_stock,completed").eq("log_date", today);
      const map: Record<string, LogRow> = {};
      (lg ?? []).forEach((r: any) => { map[r.prep_item_id] = r; });
      setLog(map);
    })();
  }, [today]);

  const visible = useMemo(() => {
    return items.filter((i) => Number(i[targetCol]) > 0)
      .filter((i) => !query || i.name.includes(query));
  }, [items, targetCol, query]);

  const persist = async (id: string, stock: number, completed?: boolean) => {
    const row = {
      prep_item_id: id,
      log_date: today,
      current_stock: stock,
      completed: completed ?? false,
      updated_by: userId,
    };
    setLog((p) => ({ ...p, [id]: { prep_item_id: id, current_stock: stock, completed: row.completed } }));
    const { error } = await supabase.from("prep_log").upsert(row, { onConflict: "prep_item_id,log_date" });
    if (error) toast.error("שמירה נכשלה");
  };

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-4">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Prep</div>
        <h1 className="font-display text-3xl font-bold mt-1">
          הכנות <span className="text-neon text-glow-neon">יומיות</span>
        </h1>
        <div className="text-xs text-muted-foreground mt-1">
          יום {WEEKDAY_HE[wd]} • {today}
        </div>
      </div>

      <div className="mb-3 relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש פריט..."
          className="w-full bg-input border border-border rounded-md pr-9 pl-3 py-2 text-sm text-right"
        />
      </div>

      <div className="text-[11px] text-muted-foreground/70 mb-2 px-1">
        טיפ: גרור פריט ימינה ➜ השלמת 100%. גרור שמאלה ➜ איפוס.
      </div>

      <ul className="space-y-2">
        {visible.length === 0 && (
          <li className="text-center text-muted-foreground py-10 text-sm">
            אין פריטי הכנה ליום זה.
          </li>
        )}
        {visible.map((it) => {
          const target = Number(it[targetCol]) || 0;
          const lg = log[it.id];
          const stock = lg?.current_stock ?? 0;
          const draft = drafts[it.id];
          const toPrep = Math.max(target - stock, 0);
          const done = stock >= target;
          return (
            <PrepRow
              key={it.id}
              name={it.name}
              unit={it.unit}
              target={target}
              stock={stock}
              draft={draft}
              toPrep={toPrep}
              done={done}
              onSwipeRight={() => { void persist(it.id, target, true); }}
              onSwipeLeft={() => { setDrafts((p) => ({ ...p, [it.id]: "" })); void persist(it.id, 0, false); }}
              onFocus={() => setDrafts((p) => ({ ...p, [it.id]: String(stock || "") }))}
              onChange={(v) => setDrafts((p) => ({ ...p, [it.id]: v }))}
              onBlur={() => {
                const v = (drafts[it.id] ?? "").trim();
                setDrafts((p) => { const n = { ...p }; delete n[it.id]; return n; });
                if (v === "") return;
                const n = Number(v);
                if (!Number.isFinite(n) || n < 0) return;
                void persist(it.id, n);
              }}
            />
          );
        })}
      </ul>
    </div>
  );
}

interface RowProps {
  name: string; unit: string; target: number; stock: number; draft?: string;
  toPrep: number; done: boolean;
  onSwipeRight: () => void; onSwipeLeft: () => void;
  onFocus: () => void; onChange: (v: string) => void; onBlur: () => void;
}

function PrepRow(p: RowProps) {
  const swipe = useSwipe({ onSwipeRight: p.onSwipeRight, onSwipeLeft: p.onSwipeLeft });
  return (
    <li
      {...swipe}
      className={`rounded-xl border-2 px-3 py-3 transition ${
        p.done
          ? "bg-emerald-500/15 border-emerald-500/60"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold flex items-center gap-2">
          {p.done && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          <span>{p.name}</span>
          {p.unit && <span className="text-xs text-muted-foreground">({p.unit})</span>}
        </div>
        <div className="text-xs text-muted-foreground">יעד: <span className="font-bold text-foreground">{p.target}</span></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 items-center">
        <label className="text-xs text-muted-foreground">
          מלאי קיים
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={p.draft ?? (p.stock ? String(p.stock) : "")}
            onFocus={p.onFocus}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
            className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-base text-right font-bold focus:outline-none focus:ring-2 focus:ring-neon"
            placeholder="0"
          />
        </label>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">להכנה</div>
          {p.done ? (
            <div className="text-2xl font-bold text-emerald-400 mt-1">✓</div>
          ) : (
            <div className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-200 font-extrabold text-xl">
              <AlertTriangle className="h-4 w-4" />
              {p.toPrep}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
