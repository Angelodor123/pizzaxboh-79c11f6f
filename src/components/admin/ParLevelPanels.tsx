import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, Power, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId, getActiveBranchIdSync } from "@/lib/current-branch";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import { refreshOnboarding } from "@/components/PageOnboarding";
import { BulkActionBar } from "@/components/BulkActionBar";
import { useBulkSelection } from "@/hooks/use-bulk-selection";

const DAY_COLS = ["target_sun","target_mon","target_tue","target_wed","target_thu","target_fri","target_sat"] as const;
const DAY_LABELS = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

interface Unit { id: string; name: string; sort_order: number; }

export function UnitsPanel() {
  const [rows, setRows] = useState<Unit[]>([]);
  const [name, setName] = useState("");
  const bulk = useBulkSelection();

  const load = async () => {
    const { data } = await supabase.from("measurement_units").select("*").order("sort_order").order("name");
    setRows((data ?? []) as Unit[]);
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("measurement_units").insert({ name: n, sort_order: rows.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName(""); void load();
  };
  const remove = async (id: string) => {
    if (!(await confirmDelete({ title: "מחיקת יחידת מידה", description: "למחוק יחידה זו? פעולה זו אינה ניתנת לשחזור." }))) return;
    const { error } = await supabase.from("measurement_units").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  return (
    <section dir="rtl">
      <h2 className="font-display text-xl font-bold">יחידות מידה</h2>
      <p className="text-sm text-muted-foreground mt-1">
        יחידות משותפות לכל המודולים (הכנות, השלמות, וכו׳).
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="שם יחידה חדשה..."
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-right"
        />
        <button onClick={add} className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md">
          <Plus className="h-4 w-4" /> הוסף
        </button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => bulk.toggleAll(rows.map((r) => r.id))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {bulk.selectionMode ? "סיים בחירה" : "בחר מרובה"}
          </button>
        </div>
      )}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => {
          const selected = bulk.isSelected(r.id);
          return (
            <li
              key={r.id}
              onClickCapture={(e) => {
                if (bulk.selectionMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  bulk.toggle(r.id);
                }
              }}
              className={`flex items-center justify-between bg-card border rounded-md px-3 py-2 transition ${
                selected ? "border-neon ring-2 ring-neon/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                {bulk.selectionMode && (
                  <span className={`h-5 w-5 grid place-content-center rounded-full border-2 ${
                    selected ? "bg-neon border-neon text-primary-foreground" : "border-border"
                  }`}>{selected ? "✓" : ""}</span>
                )}
                <span className="font-bold">{r.name}</span>
              </div>
              {!bulk.selectionMode && (
                <button onClick={() => remove(r.id)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-center text-muted-foreground text-sm py-6">אין יחידות עדיין.</li>}
      </ul>

      <BulkActionBar
        count={bulk.count}
        totalCount={rows.length}
        allSelected={bulk.count === rows.length && rows.length > 0}
        onClear={bulk.clear}
        onSelectAll={() => bulk.toggleAll(rows.map((r) => r.id))}
        actions={[
          {
            key: "delete",
            label: "מחק",
            icon: Trash2,
            variant: "destructive",
            confirm: "למחוק {count} יחידות מידה?",
            onClick: async () => {
              const ids = bulk.ids;
              const { error } = await supabase.from("measurement_units").delete().in("id", ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`נמחקו ${ids.length} יחידות`);
              bulk.clear();
              void load();
            },
          },
        ]}
      />
    </section>
  );
}

interface ParItem {
  id: string; name: string; unit: string; sort_order: number; active: boolean; barcode?: string | null;
  target_sun: number; target_mon: number; target_tue: number; target_wed: number;
  target_thu: number; target_fri: number; target_sat: number;
}

function ParItemsPanel({ table, title, withBarcode }: { table: "prep_items" | "restock_items"; title: string; withBarcode?: boolean }) {
  const [rows, setRows] = useState<ParItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [editing, setEditing] = useState<ParItem | null>(null);
  const bulk = useBulkSelection();

  const load = async () => {
    const { data } = await supabase.from(table).select("*").order("sort_order").order("name");
    setRows((data ?? []) as ParItem[]);
    const { data: u } = await supabase.from("measurement_units").select("*").order("sort_order");
    setUnits((u ?? []) as Unit[]);
  };
  useEffect(() => { void load(); }, [table]);

  const blank = (): ParItem => ({
    id: "", name: "", unit: units[0]?.name ?? "", sort_order: rows.length + 1, active: true,
    barcode: "", target_sun: 0, target_mon: 0, target_tue: 0, target_wed: 0, target_thu: 0, target_fri: 0, target_sat: 0,
  });

  const save = async () => {
    if (!editing) return;
    const { id, ...rest } = editing;
    const payload: any = { ...rest };
    if (!withBarcode) delete payload.barcode;
    else payload.barcode = (payload.barcode ?? "").trim() || null;
    if (!payload.name.trim()) { toast.error("חסר שם"); return; }
    if (id) {
      const { error } = await supabase.from(table).update(payload).eq("id", id);
      if (error) { toast.error(error.message); return; }
    } else {
      const branch_id = await requireCurrentBranchId();
      const { error } = await supabase.from(table).insert({ ...payload, branch_id });
      if (error) { toast.error(error.message); return; }
    }
    setEditing(null); toast.success("נשמר"); void load();
  };

  const remove = async (id: string) => {
    if (!(await confirmDelete({ title: "מחיקת פריט", description: "למחוק פריט זה? פעולה זו אינה ניתנת לשחזור." }))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  return (
    <section dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">כמויות יעד לפי יום בשבוע. הזן 0 ביום בו הפריט לא נדרש.</p>
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
              onClick={() => bulk.toggleAll(rows.map((r) => r.id))}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {bulk.selectionMode ? "סיים" : "בחר מרובה"}
            </button>
          )}
          <button onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md">
            <Plus className="h-4 w-4" /> פריט חדש
          </button>
        </div>
      </div>

      {/* Mobile: card-per-item */}
      <div className="mt-4 space-y-2 lg:hidden">
        {rows.map((r) => {
          const selected = bulk.isSelected(r.id);
          return (
            <div
              key={r.id}
              onClickCapture={(e) => {
                if (bulk.selectionMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  bulk.toggle(r.id);
                }
              }}
              className={`rounded-xl border p-3 transition ${
                selected ? "border-neon ring-2 ring-neon/40 bg-neon/5" : "border-border bg-card/60"
              } ${!r.active ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                {bulk.selectionMode && (
                  <span className={`shrink-0 inline-grid place-content-center h-5 w-5 rounded border-2 ${
                    selected ? "bg-neon border-neon text-primary-foreground" : "border-border"
                  }`}>{selected ? "✓" : ""}</span>
                )}
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-bold text-foreground truncate">
                    {r.name} {!r.active && <span className="text-[10px] text-muted-foreground">(לא פעיל)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.unit}</div>
                </div>
                {!bulk.selectionMode && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing({ ...r })} className="p-2 rounded-md hover:bg-card text-foreground hover:text-neon"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DAY_COLS.map((c, i) => {
                  const v = Number(r[c]) || 0;
                  return (
                    <div
                      key={c}
                      className="rounded-md bg-card border border-border px-2 py-1 text-center text-xs min-w-[2.5rem]"
                    >
                      <div className="text-[10px] text-muted-foreground leading-tight">{DAY_LABELS[i]}</div>
                      <div className={`font-bold tabular-nums ${v > 0 ? "text-neon" : "text-muted-foreground/40"}`}>{v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-6">אין פריטים עדיין.</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="mt-4 border border-border rounded-md overflow-x-auto hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground text-xs">
            <tr>
              {bulk.selectionMode && <th className="w-8" />}
              <th className="text-right px-3 py-2">שם</th>
              <th className="text-right px-3 py-2">יח׳</th>
              {DAY_LABELS.map((d) => (<th key={d} className="px-2 py-2">{d}</th>))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = bulk.isSelected(r.id);
              return (
                <tr
                  key={r.id}
                  onClickCapture={(e) => {
                    if (bulk.selectionMode) {
                      e.preventDefault();
                      e.stopPropagation();
                      bulk.toggle(r.id);
                    }
                  }}
                  className={`border-t border-border ${selected ? "bg-neon/10" : ""} ${!r.active ? "opacity-50" : ""}`}
                >
                  {bulk.selectionMode && (
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-grid place-content-center h-5 w-5 rounded border-2 ${
                        selected ? "bg-neon border-neon text-primary-foreground" : "border-border"
                      }`}>{selected ? "✓" : ""}</span>
                    </td>
                  )}
                  <td className="px-3 py-2 font-bold">{r.name} {!r.active && <span className="text-[10px] text-muted-foreground">(לא פעיל)</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
                  {DAY_COLS.map((c) => (
                    <td key={c} className="px-2 py-2 text-center text-xs">{Number(r[c]) || ""}</td>
                  ))}
                  <td className="px-2 py-2">
                    {!bulk.selectionMode && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditing({ ...r })} className="p-2 rounded-md hover:bg-card text-foreground hover:text-neon"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(r.id)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground text-sm py-6">אין פריטים עדיין.</td></tr>
            )}
          </tbody>
        </table>
      </div>


      <BulkActionBar
        count={bulk.count}
        totalCount={rows.length}
        allSelected={bulk.count === rows.length && rows.length > 0}
        onClear={bulk.clear}
        onSelectAll={() => bulk.toggleAll(rows.map((r) => r.id))}
        actions={[
          {
            key: "activate",
            label: "הפעל",
            icon: Power,
            onClick: async () => {
              const { error } = await supabase.from(table).update({ active: true }).in("id", bulk.ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`הופעלו ${bulk.count} פריטים`);
              bulk.clear(); void load();
            },
          },
          {
            key: "deactivate",
            label: "השבת",
            icon: Power,
            onClick: async () => {
              const { error } = await supabase.from(table).update({ active: false }).in("id", bulk.ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`הושבתו ${bulk.count} פריטים`);
              bulk.clear(); void load();
            },
          },
          {
            key: "delete",
            label: "מחק",
            icon: Trash2,
            variant: "destructive",
            confirm: "למחוק {count} פריטים? פעולה בלתי הפיכה.",
            onClick: async () => {
              const ids = bulk.ids;
              const { error } = await supabase.from(table).delete().in("id", ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`נמחקו ${ids.length} פריטים`);
              bulk.clear(); void load();
            },
          },
        ]}
      />


      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">{editing.id ? "עריכת פריט" : "פריט חדש"}</h3>
              <button onClick={() => setEditing(null)} className="p-2"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-muted-foreground">שם
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right" />
              </label>
              <label className="block text-xs text-muted-foreground">יחידת מידה
                <select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right">
                  <option value="">—</option>
                  {units.map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
                </select>
              </label>
              {withBarcode && (
                <label className="block text-xs text-muted-foreground">ברקוד (אופציונלי)
                  <input value={editing.barcode ?? ""} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                    className="mt-1 w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right font-mono" />
                </label>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-2">כמות יעד לפי יום</div>
                <div className="grid grid-cols-7 gap-2">
                  {DAY_COLS.map((c, i) => (
                    <label key={c} className="text-[10px] text-center text-muted-foreground">
                      {DAY_LABELS[i]}
                      <input type="number" min="0" step="0.1"
                        value={(editing as any)[c] === 0 ? "" : String((editing as any)[c])}
                        onChange={(e) => setEditing({ ...editing, [c]: e.target.value === "" ? 0 : Number(e.target.value) } as ParItem)}
                        className="mt-1 w-full bg-input border border-border rounded-md px-2 py-2 text-sm text-center font-bold" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border">ביטול</button>
              <button onClick={save} className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-4 py-2 rounded-md">
                <Save className="h-4 w-4" /> שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function PrepItemsPanel() {
  return <ParItemsPanel table="prep_items" title="הכנות יומיות" />;
}
export function RestockItemsPanel() {
  return <ParItemsPanel table="restock_items" title="השלמות מהמחסן" withBarcode />;
}

interface OnboardingRow { id: string; page_key: string; title: string; body: string; }

export function OnboardingPanel() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});

  const load = async () => {
    const { data } = await supabase.from("page_onboarding").select("*").order("page_key");
    setRows((data ?? []) as OnboardingRow[]);
  };
  useEffect(() => { void load(); }, []);

  const save = async (r: OnboardingRow) => {
    const d = drafts[r.id] ?? { title: r.title, body: r.body };
    const { error } = await supabase.from("page_onboarding")
      .update({ title: d.title, body: d.body }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    refreshOnboarding(r.page_key);
    toast.success("נשמר");
    setDrafts((p) => { const n = { ...p }; delete n[r.id]; return n; });
    void load();
  };

  return (
    <section dir="rtl">
      <h2 className="font-display text-xl font-bold">הסברי דפים</h2>
      <p className="text-sm text-muted-foreground mt-1">
        טקסט ההסבר שמופיע בראש כל עמוד עבור עובדים חדשים.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const d = drafts[r.id] ?? { title: r.title, body: r.body };
          return (
            <li key={r.id} className="bg-card border border-border rounded-md p-3">
              <div className="text-[10px] uppercase tracking-wider text-neon font-bold mb-2">{r.page_key}</div>
              <input
                value={d.title}
                onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, title: e.target.value } }))}
                placeholder="כותרת"
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right font-bold"
              />
              <textarea
                value={d.body}
                onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, body: e.target.value } }))}
                rows={3}
                placeholder="טקסט הסבר..."
                className="mt-2 w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right"
              />
              <div className="mt-2 flex justify-end">
                <button onClick={() => save(r)} className="inline-flex items-center gap-2 bg-neon text-primary-foreground font-bold px-3 py-1.5 rounded-md text-sm">
                  <Save className="h-3.5 w-3.5" /> שמור
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
