import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Info,
  Package,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/aids/suppliers")({
  head: () => ({
    meta: [
      { title: "ספקים ותקנים — עזרים" },
      { name: "description", content: "קטלוג ספקים ותקני הזמנה תפעוליים." },
    ], links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/aids/suppliers" }],
  }),
  component: AidsSuppliersPage,
});

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type Supplier = {
  id: string;
  name: string;
  category: string | null;
  standards_callout: string | null;
};

type Standard = {
  id: string;
  supplier_id: string;
  item_name: string;
  day_of_week: number | null;
  amount_text: string;
  sort_order: number;
};

function AidsSuppliersPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [sRes, stRes] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, category, standards_callout")
        .eq("active", true)
        .eq("is_archived", false)
        .order("name"),
      supabase
        .from("supplier_standards")
        .select("id, supplier_id, item_name, day_of_week, amount_text, sort_order")
        .order("sort_order"),
    ]);
    if (sRes.error) toast.error("שגיאה בטעינת ספקים: " + sRes.error.message);
    if (stRes.error) toast.error("שגיאה בטעינת תקנים: " + stRes.error.message);

    // Deduplicate suppliers by name (we have rows per branch but UI shows one per name)
    const seen = new Set<string>();
    const dedup: Supplier[] = [];
    for (const s of (sRes.data ?? []) as Supplier[]) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      dedup.push(s);
    }
    setSuppliers(dedup);
    setStandards((stRes.data ?? []) as Standard[]);
    if (!openId && dedup.length) setOpenId(dedup[0].id);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
          <span className="text-[11px] text-muted-foreground">
            {suppliers.length} ספקים
          </span>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-neon/10 text-neon">
              <Package className="h-5 w-5" />
            </span>
            ספקים ותקנים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            תקני הזמנה לפי ספק.
            {isAdmin && " (עריכה זמינה — לחץ על העיפרון לעריכה.)"}
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">טוען...</p>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => (
              <SupplierCard
                key={s.id}
                supplier={s}
                allRows={standards.filter((st) =>
                  // include rows from all branch copies of this supplier name
                  suppliers
                    .filter((sup) => sup.name === s.name)
                    .some((sup) => sup.id === st.supplier_id) ||
                  st.supplier_id === s.id
                )}
                isAdmin={isAdmin}
                open={openId === s.id}
                onToggle={() =>
                  setOpenId((cur) => (cur === s.id ? null : s.id))
                }
                onChanged={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  allRows,
  isAdmin,
  open,
  onToggle,
  onChanged,
}: {
  supplier: Supplier;
  allRows: Standard[];
  isAdmin: boolean;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void> | void;
}) {
  // Show rows for the currently-displayed supplier id (one branch's copy)
  const rows = allRows.filter((r) => r.supplier_id === supplier.id);
  const hasDaySplit = rows.some((r) => r.day_of_week !== null);
  const [editingCallout, setEditingCallout] = useState(false);
  const [calloutText, setCalloutText] = useState(supplier.standards_callout ?? "");

  useEffect(() => {
    setCalloutText(supplier.standards_callout ?? "");
  }, [supplier.standards_callout]);

  async function saveCallout() {
    // Update all branch copies that share the same name
    const { error } = await supabase
      .from("suppliers")
      .update({ standards_callout: calloutText || null })
      .eq("name", supplier.name);
    if (error) {
      toast.error("שגיאה בשמירה: " + error.message);
      return;
    }
    toast.success("נשמר");
    setEditingCallout(false);
    await onChanged();
  }

  async function deleteStandard(id: string) {
    // Find the row to get its details, then delete copies in all branches
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!confirm(`למחוק "${row.item_name}"?`)) return;
    // Find sibling rows in other branch copies (same name+day_of_week, supplier name match)
    const supplierIds = (
      await supabase
        .from("suppliers")
        .select("id")
        .eq("name", supplier.name)
    ).data?.map((r: any) => r.id) ?? [supplier.id];

    let q = supabase
      .from("supplier_standards")
      .delete()
      .in("supplier_id", supplierIds)
      .eq("item_name", row.item_name);
    q = row.day_of_week === null ? q.is("day_of_week", null) : q.eq("day_of_week", row.day_of_week);
    const { error } = await q;
    if (error) {
      toast.error("שגיאה במחיקה: " + error.message);
      return;
    }
    toast.success("נמחק");
    await onChanged();
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/40 transition"
      >
        <div className="text-right">
          <div className="font-bold text-foreground">{supplier.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {supplier.category ?? "כללי"} · {rows.length} פריטים
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {/* Callout */}
          {editingCallout ? (
            <div className="flex gap-2 items-start">
              <textarea
                value={calloutText}
                onChange={(e) => setCalloutText(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                rows={2}
                placeholder="טקסט הערה: למשל אספקה ודדליין..."
              />
              <button
                onClick={saveCallout}
                className="rounded-md bg-neon text-primary-foreground p-2"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditingCallout(false);
                  setCalloutText(supplier.standards_callout ?? "");
                }}
                className="rounded-md border border-border p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : supplier.standards_callout ? (
            <div className="flex gap-2 items-start rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{supplier.standards_callout}</span>
              {isAdmin && (
                <button onClick={() => setEditingCallout(true)} className="shrink-0">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            isAdmin && (
              <button
                onClick={() => setEditingCallout(true)}
                className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> הוסף הערה (אספקה / דדליין)
              </button>
            )
          )}

          {/* Items table */}
          <StandardsTable
            supplier={supplier}
            rows={rows}
            hasDaySplit={hasDaySplit}
            isAdmin={isAdmin}
            onChanged={onChanged}
            onDelete={deleteStandard}
          />
        </div>
      )}
    </div>
  );
}

function StandardsTable({
  supplier,
  rows,
  hasDaySplit,
  isAdmin,
  onChanged,
  onDelete,
}: {
  supplier: Supplier;
  rows: Standard[];
  hasDaySplit: boolean;
  isAdmin: boolean;
  onChanged: () => Promise<void> | void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDay, setEditDay] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(r: Standard) {
    setEditingId(r.id);
    setEditName(r.item_name);
    setEditAmount(r.amount_text);
    setEditDay(r.day_of_week);
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setEditName("");
    setEditAmount("");
    setEditDay(hasDaySplit ? 0 : null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const orig = rows.find((r) => r.id === editingId);
    if (!orig) return;
    const supplierIds = (
      await supabase.from("suppliers").select("id").eq("name", supplier.name)
    ).data?.map((r: any) => r.id) ?? [supplier.id];

    let q = supabase
      .from("supplier_standards")
      .update({ item_name: editName, amount_text: editAmount, day_of_week: editDay })
      .in("supplier_id", supplierIds)
      .eq("item_name", orig.item_name);
    q = orig.day_of_week === null ? q.is("day_of_week", null) : q.eq("day_of_week", orig.day_of_week);
    const { error } = await q;
    if (error) {
      toast.error("שגיאה: " + error.message);
      return;
    }
    toast.success("נשמר");
    setEditingId(null);
    await onChanged();
  }

  async function saveAdd() {
    if (!editName.trim()) {
      toast.error("שם פריט חסר");
      return;
    }
    const supplierIds = (
      await supabase.from("suppliers").select("id, branch_id").eq("name", supplier.name)
    ).data ?? [];
    const maxSort = Math.max(0, ...rows.map((r) => r.sort_order)) + 1;
    const payload = supplierIds.map((s: any) => ({
      supplier_id: s.id,
      branch_id: s.branch_id,
      item_name: editName,
      amount_text: editAmount,
      day_of_week: editDay,
      sort_order: maxSort,
    }));
    const { error } = await supabase.from("supplier_standards").insert(payload);
    if (error) {
      toast.error("שגיאה בהוספה: " + error.message);
      return;
    }
    toast.success("נוסף");
    setAdding(false);
    await onChanged();
  }

  const cellBase = "px-3 py-2 text-sm border-b border-border/60";
  const headBase =
    "px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-zinc-900/40 text-right";

  // For day-split tables, build a unique item list with per-day amounts
  if (hasDaySplit) {
    const days = Array.from(new Set(rows.filter((r) => r.day_of_week !== null).map((r) => r.day_of_week!))).sort();
    const itemNames = Array.from(new Set(rows.map((r) => r.item_name)));

    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-right">
            <thead>
              <tr>
                <th className={headBase}>שם מוצר</th>
                {days.map((d) => (
                  <th key={d} className={`${headBase} w-24`}>
                    {DAY_NAMES[d]}
                  </th>
                ))}
                {isAdmin && <th className={`${headBase} w-16`}></th>}
              </tr>
            </thead>
            <tbody>
              {itemNames.map((name) => (
                <tr key={name} className="hover:bg-zinc-800/30">
                  <td className={`${cellBase} font-medium`}>{name}</td>
                  {days.map((d) => {
                    const r = rows.find((x) => x.item_name === name && x.day_of_week === d);
                    return (
                      <td
                        key={d}
                        className={`${cellBase} ${r ? "text-neon font-bold" : "text-muted-foreground/50"}`}
                      >
                        {editingId === r?.id ? (
                          <input
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-20 rounded border border-border bg-background px-1"
                          />
                        ) : (
                          r?.amount_text ?? "—"
                        )}
                      </td>
                    );
                  })}
                  {isAdmin && (
                    <td className={`${cellBase} flex gap-1`}>
                      {/* Edit first matching row */}
                      {(() => {
                        const r = rows.find((x) => x.item_name === name);
                        if (!r) return null;
                        if (editingId === r.id) {
                          return (
                            <>
                              <button onClick={saveEdit}><Save className="h-3.5 w-3.5 text-neon" /></button>
                              <button onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></button>
                            </>
                          );
                        }
                        return (
                          <>
                            <button onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => onDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-pink-400" /></button>
                          </>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && <AddRow adding={adding} hasDaySplit days={days} editName={editName} setEditName={setEditName} editAmount={editAmount} setEditAmount={setEditAmount} editDay={editDay} setEditDay={setEditDay} startAdd={startAdd} saveAdd={saveAdd} cancel={() => setAdding(false)} />}
      </div>
    );
  }

  // static (no day split)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right">
          <thead>
            <tr>
              <th className={headBase}>שם מוצר</th>
              <th className={`${headBase} w-32`}>כמות יעד</th>
              {isAdmin && <th className={`${headBase} w-20`}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-800/30">
                <td className={`${cellBase} font-medium`}>
                  {editingId === r.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1"
                    />
                  ) : (
                    r.item_name
                  )}
                </td>
                <td className={`${cellBase} text-neon font-bold`}>
                  {editingId === r.id ? (
                    <input
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1"
                    />
                  ) : (
                    r.amount_text
                  )}
                </td>
                {isAdmin && (
                  <td className={`${cellBase}`}>
                    <div className="flex gap-1">
                      {editingId === r.id ? (
                        <>
                          <button onClick={saveEdit}><Save className="h-3.5 w-3.5 text-neon" /></button>
                          <button onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-pink-400" /></button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 3 : 2} className={`${cellBase} text-center text-muted-foreground`}>
                  אין פריטים עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isAdmin && <AddRow adding={adding} hasDaySplit={false} days={[]} editName={editName} setEditName={setEditName} editAmount={editAmount} setEditAmount={setEditAmount} editDay={editDay} setEditDay={setEditDay} startAdd={startAdd} saveAdd={saveAdd} cancel={() => setAdding(false)} />}
    </div>
  );
}

function AddRow({
  adding,
  hasDaySplit,
  days,
  editName,
  setEditName,
  editAmount,
  setEditAmount,
  editDay,
  setEditDay,
  startAdd,
  saveAdd,
  cancel,
}: {
  adding: boolean;
  hasDaySplit: boolean;
  days: number[];
  editName: string;
  setEditName: (v: string) => void;
  editAmount: string;
  setEditAmount: (v: string) => void;
  editDay: number | null;
  setEditDay: (v: number | null) => void;
  startAdd: () => void;
  saveAdd: () => void;
  cancel: () => void;
}) {
  if (!adding) {
    return (
      <button
        onClick={startAdd}
        className="inline-flex items-center gap-1 text-xs font-bold text-neon hover:opacity-80"
      >
        <Plus className="h-3.5 w-3.5" /> הוסף פריט
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-border bg-background/40 p-2">
      <input
        placeholder="שם פריט"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        className="flex-1 min-w-[140px] rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <input
        placeholder="כמות"
        value={editAmount}
        onChange={(e) => setEditAmount(e.target.value)}
        className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
      />
      {hasDaySplit && (
        <select
          value={editDay ?? ""}
          onChange={(e) => setEditDay(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">ללא יום</option>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <option key={d} value={d}>{DAY_NAMES[d]}</option>
          ))}
        </select>
      )}
      <button onClick={saveAdd} className="rounded-md bg-neon text-primary-foreground p-1.5">
        <Save className="h-4 w-4" />
      </button>
      <button onClick={cancel} className="rounded-md border border-border p-1.5">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
