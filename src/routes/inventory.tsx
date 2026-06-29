import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveBranchIdSync, requireCurrentBranchId } from "@/lib/current-branch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Pencil,
  Package,
  AlertTriangle,
  CheckCircle2,
  History,
  Sparkles,
  X,
  ClipboardList,
  Save,
} from "lucide-react";


export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "מלאי — Pizza X" },
      { name: "description", content: "ניהול מלאי בזמן אמת לפי קליטות סחורה." },
      { property: "og:title", content: "מלאי — Pizza X" },
      { property: "og:description", content: "ניהול מלאי בזמן אמת לפי קליטות סחורה." },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/inventory" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/inventory" }],
  }),
});

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  updated_at: string;
}

interface CatalogInfo {
  min_stock_alert: number | null;
  cost_price: number | null;
}

interface Movement {
  id: string;
  inventory_item_id: string;
  qty_delta: number;
  source: string;
  note: string | null;
  created_at: string;
  item_name: string;
}

interface Shortage {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  status: string;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatHeDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(s: string): string {
  switch (s) {
    case "order_received":
      return "קליטת הזמנה";
    case "manual":
      return "קליטה ידנית";
    case "adjustment":
      return "תיקון ידני";
    case "count":
      return "ספירת מלאי";
    default:
      return s;
  }
}


// ============================================================================
// Page
// ============================================================================

function InventoryPage() {
  const { role, isSuperAdmin } = useAuth();
  const isAdmin = role === "admin" || isSuperAdmin;

  return (
    <main dir="rtl" className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Inventory
        </div>
        <h1 className="text-3xl font-bold tracking-tight">מלאי וסטוק</h1>
        <p className="text-sm text-muted-foreground">
          ניהול מלאי בזמן אמת לפי קליטות סחורה
        </p>
      </header>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="stock">מצב מלאי</TabsTrigger>
          {isAdmin && <TabsTrigger value="count">ספירה</TabsTrigger>}
          <TabsTrigger value="movements">תנועות מלאי</TabsTrigger>
          <TabsTrigger value="shortages">חוסרים ואזהרות</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <StockLevelsTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="count" className="mt-4">
            <CountTab />
          </TabsContent>
        )}
        <TabsContent value="movements" className="mt-4">
          <MovementsTab />
        </TabsContent>
        <TabsContent value="shortages" className="mt-4">
          <ShortagesTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}


// ============================================================================
// Tab 1 — Stock Levels
// ============================================================================

function StockLevelsTab() {
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogInfo>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const branchId = getActiveBranchIdSync();
    let q = supabase.from("inventory_items").select("*").order("name");
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) {
      toast.error("טעינת המלאי נכשלה", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as InventoryItem[];
    setItems(rows);

    if (rows.length && branchId) {
      const names = rows.map((r) => r.name);
      const { data: cat } = await supabase
        .from("supplier_products")
        .select("name, min_stock_alert, cost_price")
        .eq("branch_id", branchId)
        .in("name", names);
      const map: Record<string, CatalogInfo> = {};
      (cat ?? []).forEach((c: any) => {
        // Prefer first match per name
        if (!map[c.name]) {
          map[c.name] = {
            min_stock_alert: c.min_stock_alert,
            cost_price: c.cost_price,
          };
        }
      });
      setCatalog(map);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const qx = query.trim().toLowerCase();
    const list = qx
      ? items.filter((i) => i.name.toLowerCase().includes(qx))
      : items;
    return [...list].sort((a, b) => {
      const aMin = catalog[a.name]?.min_stock_alert ?? null;
      const bMin = catalog[b.name]?.min_stock_alert ?? null;
      const aLow = aMin != null && a.current_stock < aMin ? 0 : 1;
      const bLow = bMin != null && b.current_stock < bMin ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.name.localeCompare(b.name, "he");
    });
  }, [items, catalog, query]);

  async function saveAdjustment(item: InventoryItem, newStock: number, note: string) {
    try {
      const branchId = await requireCurrentBranchId();
      const delta = newStock - item.current_stock;
      const { error: upErr } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (upErr) throw upErr;
      const { error: mvErr } = await supabase.from("inventory_movements").insert({
        branch_id: branchId,
        inventory_item_id: item.id,
        qty_delta: delta,
        source: "adjustment",
        note: note || null,
      });
      if (mvErr) throw mvErr;
      toast.success("המלאי עודכן");
      setEditingId(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("עדכון נכשל", { description: msg });
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש פריט…"
          className="pr-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10 text-muted-foreground" />}
          text="לא נמצאו פריטי מלאי. קבלת סחורה תאכלס את הרשימה אוטומטית."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const info = catalog[item.name];
            const min = info?.min_stock_alert ?? null;
            const isLow = min != null && item.current_stock < min;
            const isEditing = editingId === item.id;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{item.name}</span>
                      {isLow && (
                        <Badge variant="destructive" className="text-[10px]">
                          מלאי נמוך
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {item.current_stock}
                      </span>{" "}
                      {item.unit}
                      {min != null && (
                        <span className="opacity-70"> · מינ׳ {min}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      עודכן: {formatHeDate(item.updated_at)}
                    </div>
                  </div>
                  {isSuperAdmin && !isEditing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(item.id)}
                      aria-label="עריכה ידנית"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isEditing && (
                  <AdjustForm
                    item={item}
                    onCancel={() => setEditingId(null)}
                    onSave={(stock, note) => saveAdjustment(item, stock, note)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdjustForm({
  item,
  onCancel,
  onSave,
}: {
  item: InventoryItem;
  onCancel: () => void;
  onSave: (newStock: number, note: string) => void;
}) {
  const [stock, setStock] = useState(String(item.current_stock));
  const [note, setNote] = useState("");
  const n = Number(stock);
  const valid = !Number.isNaN(n) && n >= 0;
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">כמות חדשה</label>
          <Input
            type="number"
            inputMode="decimal"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">הערה</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="סיבת התיקון" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4 ml-1" /> ביטול
        </Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave(n, note)}>
          שמור
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 2 — Movements
// ============================================================================

function MovementsTab() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const branchId = getActiveBranchIdSync();
      let q = supabase
        .from("inventory_movements")
        .select("id, inventory_item_id, qty_delta, source, note, created_at, inventory_items(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) {
        toast.error("טעינת תנועות נכשלה", { description: error.message });
        setLoading(false);
        return;
      }
      const list: Movement[] = (data ?? []).map((r: any) => ({
        id: r.id,
        inventory_item_id: r.inventory_item_id,
        qty_delta: Number(r.qty_delta) || 0,
        source: r.source,
        note: r.note,
        created_at: r.created_at,
        item_name: r.inventory_items?.name ?? "פריט",
      }));
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const qx = query.trim().toLowerCase();
    return qx ? rows.filter((r) => r.item_name.toLowerCase().includes(qx)) : rows;
  }, [rows, query]);

  // Group by date (YYYY-MM-DD)
  const groups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    filtered.forEach((m) => {
      const key = new Date(m.created_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם פריט…"
          className="pr-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<History className="h-10 w-10 text-muted-foreground" />}
          text="עדיין אין תנועות מלאי. הן ייווצרו אוטומטית בעת קליטת סחורה."
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list]) => (
            <section key={date} className="space-y-2">
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1">
                <div className="inline-block rounded-full border border-border bg-card/80 px-3 py-0.5 text-[11px] text-muted-foreground backdrop-blur">
                  {formatHeDate(date)}
                </div>
              </div>
              <ul className="space-y-2">
                {list.map((m) => {
                  const positive = m.qty_delta >= 0;
                  return (
                    <li
                      key={m.id}
                      className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{m.item_name}</div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {sourceLabel(m.source)} · {formatHeDateTime(m.created_at)}
                          </div>
                          {m.note && (
                            <div className="mt-1 text-[12px] text-muted-foreground">
                              {m.note}
                            </div>
                          )}
                        </div>
                        <div
                          className={
                            "shrink-0 font-mono text-sm font-semibold " +
                            (positive ? "text-emerald-500" : "text-red-500")
                          }
                        >
                          {positive ? "+" : ""}
                          {m.qty_delta}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab 3 — Shortages
// ============================================================================

function ShortagesTab() {
  const [rows, setRows] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const branchId = getActiveBranchIdSync();
    let q = supabase
      .from("shortage_items")
      .select("id, name, quantity, unit, notes, status, created_at")
      .eq("completed", false)
      .order("created_at", { ascending: false });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) {
      toast.error("טעינת חוסרים נכשלה", { description: error.message });
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Shortage[]);
    setLoading(false);
  }

  async function markHandled(id: string) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase
      .from("shortage_items")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("עדכון נכשל", { description: error.message });
    } else {
      toast.success("סומן כטופל");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">חיבור Tabit — בקרוב</div>
            <div className="text-xs opacity-90 mt-0.5">
              לאחר חיבור מערכת Tabit, תופיע כאן ניתוח צריכה אוטומטי לפי מכירות.
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
          text="אין חוסרים פתוחים כרגע."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{s.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.status || "פתוח"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{s.quantity}</span>{" "}
                    {s.unit}
                  </div>
                  {s.notes && (
                    <div className="mt-1 text-[12px] text-muted-foreground">{s.notes}</div>
                  )}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    נוצר: {formatHeDate(s.created_at)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => markHandled(s.id)}>
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                  סמן כטופל
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Shared
// ============================================================================

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      {icon}
      <p className="text-sm text-muted-foreground max-w-sm">{text}</p>
    </div>
  );
}
