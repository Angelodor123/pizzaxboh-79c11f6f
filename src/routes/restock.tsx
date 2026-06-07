import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSwipe } from "@/hooks/use-swipe";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CheckCircle2, AlertTriangle, Search, ScanLine, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QuickAddItemModal } from "@/components/QuickAddItemModal";
import { QuickEditStockItemDialog, type StockItem } from "@/components/QuickEditStockItemDialog";
import { getActiveBranchIdSync } from "@/lib/current-branch";
import { runOrQueue } from "@/lib/offline-queue";
import { QK } from "@/lib/queue-handlers";


export const Route = createFileRoute("/restock")({
  component: RestockPage,
  head: () => ({ meta: [{ title: "השלמות מהמחסן — Pizza X" }] }),
});

const DAY_COLS = ["target_sun","target_mon","target_tue","target_wed","target_thu","target_fri","target_sat"] as const;
const WEEKDAY_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

interface Item {
  id: string; name: string; unit: string; barcode: string | null;
  target_sun: number; target_mon: number; target_tue: number; target_wed: number;
  target_thu: number; target_fri: number; target_sat: number;
  sort_order: number;
}
interface LogRow { restock_item_id: string; current_stock: number; completed: boolean; }

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function RestockPage() {
  const { session, isSuperAdmin } = useAuth();
  const userId = session?.user?.id ?? null;
  const [items, setItems] = useState<Item[]>([]);
  const [log, setLog] = useState<Record<string, LogRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const wd = new Date().getDay();
  const targetCol = DAY_COLS[wd];
  const today = todayIso();


  useEffect(() => {
    void (async () => {
      const { data: it } = await supabase
        .from("restock_items").select("*").eq("active", true)
        .order("name", { ascending: true });
      setItems((it ?? []) as Item[]);
      const { data: lg } = await supabase
        .from("restock_log").select("restock_item_id,current_stock,completed").eq("log_date", today);
      const map: Record<string, LogRow> = {};
      (lg ?? []).forEach((r: any) => { map[r.restock_item_id] = r; });
      setLog(map);
    })();
  }, [today]);

  const visible = useMemo(() => {
    return items.filter((i) => Number(i[targetCol]) > 0)
      .filter((i) => !query || i.name.includes(query) || (i.barcode ?? "").includes(query));
  }, [items, targetCol, query]);

  const persist = async (id: string, stock: number, completed?: boolean) => {
    const row = {
      restock_item_id: id, log_date: today,
      current_stock: stock, completed: completed ?? false,
      updated_by: userId,
    };
    setLog((p) => ({ ...p, [id]: { restock_item_id: id, current_stock: stock, completed: row.completed } }));
    await runOrQueue(QK.RestockLogUpsert, { row }, "עדכון מלאי");
  };

  const onScan = (text: string) => {
    const found = items.find((i) => i.barcode && i.barcode.trim() === text.trim());
    if (!found) {
      toast.error(`ברקוד לא מזוהה: ${text}`);
      return;
    }
    toast.success(`נמצא: ${found.name}`);
    setQuery("");
    setTimeout(() => {
      const el = inputRefs.current[found.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
        el.select();
      }
    }, 150);
  };

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-4">
      <div className="mb-4 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Restock</div>
        <h1 className="font-display text-3xl font-bold mt-1">
          השלמות <span className="text-neon text-glow-neon">מהמחסן</span>
        </h1>
        <div className="text-xs text-muted-foreground mt-1">
          יום {WEEKDAY_HE[wd]} • {today}
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש פריט או ברקוד..."
            aria-label="חיפוש פריט או ברקוד"
            className="w-full bg-input border border-border rounded-md pr-9 pl-3 py-2 text-sm text-right"
          />
        </div>
        <button
          onClick={() => setScanOpen(true)}
          aria-label="סריקת פריט"
          className="inline-flex shrink-0 items-center gap-1.5 bg-success text-success-foreground font-bold px-3 py-2 rounded-md shadow-[0_4px_20px_-4px_color-mix(in_oklab,var(--success)_50%,transparent)] hover:opacity-90 active:scale-95 transition"
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">סריקה</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            aria-label="הוספת פריט"
            className="inline-flex shrink-0 items-center gap-1 bg-neon text-primary-foreground font-bold px-3 py-2 rounded-md glow-neon hover:opacity-90 active:scale-95 transition whitespace-nowrap text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">הוספה</span>
          </button>
        )}
      </div>



      <div className="text-[11px] text-muted-foreground/70 mb-2 px-1">
        טיפ: גרור ימינה ➜ סומן כהובא. גרור שמאלה ➜ איפוס.
      </div>

      <ul className="space-y-2">
        {visible.length === 0 && (
          <li className="text-center text-muted-foreground py-10 text-sm">
            אין פריטים להשלמה ביום זה.
          </li>
        )}
        {visible.map((it) => {
          const target = Number(it[targetCol]) || 0;
          const lg = log[it.id];
          const stock = lg?.current_stock ?? 0;
          const draft = drafts[it.id];
          const toBring = Math.max(target - stock, 0);
          const done = stock >= target;
          return (
            <RestockRow
              key={it.id}
              inputRef={(el) => { inputRefs.current[it.id] = el; }}
              name={it.name}
              unit={it.unit}
              barcode={it.barcode}
              target={target}
              stock={stock}
              draft={draft}
              toBring={toBring}
              done={done}
              showEdit={isSuperAdmin}
              onEdit={() => setEditing(it)}
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

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={onScan} />

      <QuickAddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        kind="restock"
        branchId={getActiveBranchIdSync()}
        onCreated={(row) => setItems((prev) => [...prev, row as unknown as Item])}
      />

      <QuickEditStockItemDialog
        item={editing as unknown as StockItem | null}
        kind="restock"
        onClose={() => setEditing(null)}
        onSaved={(upd) =>
          setItems((prev) => prev.map((x) => (x.id === upd.id ? ({ ...x, ...upd } as Item) : x)))
        }
        onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
      />
    </div>
  );
}


interface RowProps {
  inputRef: (el: HTMLInputElement | null) => void;
  name: string; unit: string; barcode: string | null; target: number; stock: number; draft?: string;
  toBring: number; done: boolean;
  showEdit?: boolean; onEdit?: () => void;
  onSwipeRight: () => void; onSwipeLeft: () => void;
  onFocus: () => void; onChange: (v: string) => void; onBlur: () => void;
}

function RestockRow(p: RowProps) {
  const swipe = useSwipe({ onSwipeRight: p.onSwipeRight, onSwipeLeft: p.onSwipeLeft });
  return (
    <li
      {...swipe}
      className={`rounded-xl border-2 px-3 py-3 transition ${
        p.done ? "bg-success/15 border-success/60" : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold flex items-center gap-2">
          {p.done && <CheckCircle2 className="h-4 w-4 text-success" />}
          <span>{p.name}</span>
          {p.unit && <span className="text-xs text-muted-foreground">({p.unit})</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            יעד: <span className="font-bold text-foreground">{p.target}</span>
          </div>
          {p.showEdit && (
            <button
              onClick={p.onEdit}
              aria-label="עריכת פריט"
              className="text-muted-foreground hover:text-neon transition p-1 -m-1"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 items-center">
        <label className="text-xs text-muted-foreground">
          מלאי בעמדה
          <input
            ref={p.inputRef}
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">להביא</div>
          {p.done ? (
            <div className="text-2xl font-bold text-success mt-1">✓</div>
          ) : (
            <div className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-brand/20 border border-amber-brand/60 text-amber-brand font-extrabold text-xl">
              <AlertTriangle className="h-4 w-4" />
              {p.toBring}
            </div>
          )}
        </div>
      </div>
      {p.barcode && (
        <div className="mt-1 text-[10px] text-muted-foreground/70 text-left font-mono">
          {p.barcode}
        </div>
      )}
    </li>
  );
}
