import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, X, Trash2, Pencil, Truck, Check, Power, CheckSquare, Archive, ArchiveRestore, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GridSkeleton } from "@/components/ui/skeletons";
import { getActiveBranchIdSync } from "@/lib/current-branch";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import { BulkActionBar } from "@/components/BulkActionBar";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { resolveSupplierLogo } from "@/lib/supplier-logos";
import { SupplierCatalogManager } from "@/components/SupplierCatalogManager";
import { Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AiTrainingSandbox } from "@/components/AiTrainingSandbox";
import { supplierFormSchema, validateOrToast } from "@/lib/schemas";
import { fanOutInsert, fanOutUpdateById } from "@/lib/branch-fanout";
import { PullToRefresh } from "@/components/PullToRefresh";


export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: 'ספקים — Pizza X' },
      { name: "description", content: 'ניהול ספקים ופרטי קשר.' },
    
      { property: "og:title", content: 'ספקים — Pizza X' },
      { property: "og:description", content: 'ניהול ספקים ופרטי קשר.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/suppliers" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/suppliers" }],
  }),
  component: SuppliersPage,
});

const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

interface Supplier {
  id: string;
  name: string;
  category: string;
  delivery_weekdays: number[];
  default_start_time: string | null;
  default_end_time: string | null;
  contact: string | null;
  notes: string | null;
  active: boolean;
  logo_url: string | null;
  is_archived: boolean;
  order_days: number[];
  order_cutoff_time: string | null;
  delivery_days: number[];
}

function SuppliersPage() {
  const { isSuperAdmin } = useAuth();
  const canEdit = isSuperAdmin;
  const [list, setList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [catalogFor, setCatalogFor] = useState<Supplier | null>(null);
  const bulk = useBulkSelection();

  const load = async () => {
    const branchId = getActiveBranchIdSync();
    let q = supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) toast.error("שגיאה בטעינת ספקים");
    else setList((data as Supplier[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const branchId = getActiveBranchIdSync();
    const ch = branchId
      ? supabase
          .channel("suppliers_rt")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "suppliers", filter: `branch_id=eq.${branchId}` },
            () => load(),
          )
          .subscribe()
      : null;
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const visible = list.filter((s) => (showArchived ? s.is_archived : !s.is_archived));

  const handleArchive = async (s: Supplier) => {
    const next = !s.is_archived;
    const ok = await confirmDelete({
      title: next ? "העברה לארכיון" : "שחזור מארכיון",
      description: next
        ? `להעביר את "${s.name}" לארכיון? אירועי הסחורה האוטומטיים יוסרו מהלוח.`
        : `לשחזר את "${s.name}" מהארכיון?`,
      confirmLabel: next ? "העבר לארכיון" : "שחזר",
      destructive: next,
    });
    if (!ok) return;
    const error = await fanOutUpdateById("suppliers", s.id, { is_archived: next }, "name").then(() => null).catch((e) => e);
    if (error) toast.error("שגיאה: " + error.message);
    else toast.success(next ? "הספק הועבר לארכיון" : "הספק שוחזר");
  };

  return (
    <PullToRefresh onRefresh={load}>
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">

      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Suppliers</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          🚚 ניהול <span className="text-neon text-glow-neon">ספקים</span>
        </h1>
        <p className="hidden sm:block text-muted-foreground mt-2 text-sm">
          ימי החלוקה מסונכרנים אוטומטית ללו״ז קבלת הסחורה בלוח.
        </p>
        {canEdit && (
          <div className="mt-3 flex items-center justify-center">
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-neon text-primary-foreground font-bold glow-neon active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              ספק חדש
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="list" dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 mb-4">
          <TabsTrigger value="list" className="font-bold">רשימת ספקים</TabsTrigger>
          <TabsTrigger value="training" className="font-bold">🎮 אימון AI</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
      {canEdit && list.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => bulk.toggleAll(visible.map((s) => s.id))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {bulk.selectionMode ? "סיים בחירה" : "בחר מרובה"}
          </button>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-bold transition ${
              showArchived ? "border-amber-brand text-amber-brand" : "border-border hover:border-neon hover:text-neon"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "חזרה לפעילים" : `ארכיון (${list.filter((s) => s.is_archived).length})`}
          </button>
        </div>
      )}

      {loading ? (
        <GridSkeleton items={8} className="grid grid-cols-1 sm:grid-cols-2 gap-3" />
      ) : visible.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
          {showArchived ? "אין ספקים בארכיון" : "אין ספקים עדיין"}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => {
            const selected = bulk.isSelected(s.id);
            const logo = resolveSupplierLogo(s.name, s.logo_url);
            return (
            <li
              key={s.id}
              onClickCapture={(e) => {
                if (canEdit && bulk.selectionMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  bulk.toggle(s.id);
                }
              }}
              className={`rounded-2xl border p-4 bg-card/80 backdrop-blur transition ${
                s.is_archived ? "border-border opacity-60" : s.active ? "border-success/60" : "border-border opacity-70"
              } ${selected ? "ring-2 ring-neon" : ""}`}
              style={s.active && !s.is_archived ? { borderInlineStartWidth: 4, borderInlineStartColor: "var(--success)" } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                {canEdit && bulk.selectionMode && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); bulk.toggle(s.id); }}
                    className={`h-7 w-7 grid place-content-center rounded-full border-2 shrink-0 ${
                      selected ? "bg-neon border-neon text-primary-foreground" : "border-border"
                    }`}
                    aria-pressed={selected}
                  >
                    {selected ? "✓" : ""}
                  </button>
                )}
                <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border bg-background/60 grid place-content-center">
                  {logo ? (
                    <img src={logo} alt={s.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold flex-wrap">
                    <Truck className="h-4 w-4 text-success" />
                    <span className="break-words whitespace-normal text-center line-clamp-2">{s.name}</span>
                    <span className="text-[10px] font-bold text-neon border border-neon/40 rounded px-1.5 py-0.5">
                      {s.category}
                    </span>
                    {s.is_archived && (
                      <span className="text-[10px] font-bold text-amber-brand border border-amber-brand/60 rounded px-1.5 py-0.5">
                        בארכיון
                      </span>
                    )}
                    {!s.active && !s.is_archived && (
                      <span className="text-[10px] font-bold text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        לא פעיל
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {WEEKDAYS_HE.map((w, i) => (
                      <span
                        key={i}
                        className={`text-[11px] font-bold rounded px-2 py-0.5 border ${
                          s.delivery_weekdays.includes(i)
                            ? "bg-success/15 border-success/60 text-success"
                            : "border-border/40 text-muted-foreground/60"
                        }`}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                  {(() => {
                    if (!s.delivery_weekdays || s.delivery_weekdays.length === 0) return null;
                    const today = new Date().getDay();
                    if (s.delivery_weekdays.includes(today)) {
                      return (
                        <div className="text-[11px] text-neon font-bold mt-1.5">
                          משלוח הבא: היום
                        </div>
                      );
                    }
                    for (let i = 1; i <= 7; i++) {
                      const d = (today + i) % 7;
                      if (s.delivery_weekdays.includes(d)) {
                        return (
                          <div className="text-[11px] text-muted-foreground mt-1.5">
                            משלוח הבא: יום {WEEKDAYS_HE[d]}
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  <div className="text-xs text-muted-foreground mt-2 tabular-nums">
                    {s.default_start_time?.slice(0, 5) || "—"}
                    {s.default_end_time ? ` – ${s.default_end_time.slice(0, 5)}` : ""}
                    {s.contact ? ` · ${s.contact}` : ""}
                  </div>
                  {s.notes && (
                    <p className="text-sm mt-2 whitespace-pre-wrap text-foreground/90">{s.notes}</p>
                  )}
                </div>
                {canEdit && !bulk.selectionMode && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setFormOpen(true);
                      }}
                      className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
                      aria-label="ערוך"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCatalogFor(s)}
                      className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
                      aria-label="קטלוג מוצרים"
                      title="קטלוג מוצרים"
                    >
                      <Package className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleArchive(s)}
                      className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-amber-brand hover:border-amber-brand"
                      aria-label={s.is_archived ? "שחזר" : "העבר לארכיון"}
                      title={s.is_archived ? "שחזר מהארכיון" : "העבר לארכיון"}
                    >
                      {s.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
        </TabsContent>
        <TabsContent value="training">
          <AiTrainingSandbox suppliers={list.filter((s) => !s.is_archived).map((s) => ({ id: s.id, name: s.name }))} isSuperAdmin={isSuperAdmin} />
        </TabsContent>
      </Tabs>




      {canEdit && (
        <BulkActionBar
          count={bulk.count}
          totalCount={list.length}
          allSelected={bulk.count === list.length && list.length > 0}
          onClear={bulk.clear}
          onSelectAll={() => bulk.toggleAll(list.map((s) => s.id))}
          actions={[
            {
              key: "activate",
              label: "הפעל",
              icon: Power,
              onClick: async () => {
                try {
                  for (const id of bulk.ids) {
                    await fanOutUpdateById("suppliers", id, { active: true }, "name");
                  }
                  toast.success(`הופעלו ${bulk.count} ספקים`);
                  bulk.clear();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "שגיאה");
                }
              },
            },
            {
              key: "deactivate",
              label: "השבת",
              icon: Power,
              onClick: async () => {
                try {
                  for (const id of bulk.ids) {
                    await fanOutUpdateById("suppliers", id, { active: false }, "name");
                  }
                  toast.success(`הושבתו ${bulk.count} ספקים`);
                  bulk.clear();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "שגיאה");
                }
              },
            },
            {
              key: "archive",
              label: "ארכיון",
              icon: Archive,
              variant: "destructive",
              confirm: "להעביר {count} ספקים לארכיון? אירועי הסחורה האוטומטיים שלהם יוסרו מהלוח.",
              onClick: async () => {
                try {
                  for (const id of bulk.ids) {
                    await fanOutUpdateById("suppliers", id, { is_archived: true }, "name");
                  }
                  toast.success(`${bulk.ids.length} ספקים הועברו לארכיון`);
                  bulk.clear();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "שגיאה");
                }
              },
            },
          ]}
        />
      )}

      {formOpen && (
        <SupplierForm
          existing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {catalogFor && (
        <SupplierCatalogManager
          supplierId={catalogFor.id}
          supplierName={catalogFor.name}
          open={!!catalogFor}
          onClose={() => setCatalogFor(null)}
        />
      )}
    </div>
    </PullToRefresh>
  );

}

function SupplierForm({
  existing,
  onClose,
}: {
  existing: Supplier | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "כללי");
  const [weekdays, setWeekdays] = useState<number[]>(existing?.delivery_weekdays ?? []);
  const [orderDays, setOrderDays] = useState<number[]>(existing?.order_days ?? []);
  const [orderCutoff, setOrderCutoff] = useState(existing?.order_cutoff_time?.slice(0, 5) ?? "");
  const [deliveryDays, setDeliveryDays] = useState<number[]>(
    (existing?.delivery_days && existing.delivery_days.length > 0)
      ? existing.delivery_days
      : (existing?.delivery_weekdays ?? []),
  );
  const [startTime, setStartTime] = useState(existing?.default_start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(existing?.default_end_time?.slice(0, 5) ?? "");
  const [contact, setContact] = useState(existing?.contact ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewLogo = logoUrl || resolveSupplierLogo(name, null);

  const toggleDay = (i: number) =>
    setWeekdays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  const toggleOrderDay = (i: number) =>
    setOrderDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  const toggleDeliveryDay = (i: number) =>
    setDeliveryDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));


  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("יש לבחור קובץ תמונה");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("גודל מקסימלי: 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("supplier-logos").upload(path, file, { upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error("העלאה נכשלה: " + upErr.message);
      return;
    }
    const { data } = supabase.storage.from("supplier-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    toast.success("הלוגו הועלה");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validateOrToast(supplierFormSchema, {
      name,
      category,
      contact,
      notes,
      delivery_weekdays: weekdays,
      order_days: orderDays,
      delivery_days: deliveryDays,
      default_start_time: startTime || null,
      default_end_time: endTime || null,
      order_cutoff_time: orderCutoff || null,
      active,
      logo_url: logoUrl,
    });
    if (!validated) return;

    setSaving(true);
    const basePayload = validated;
    let error: { message: string } | null = null;
    try {
      if (existing) {
        await fanOutUpdateById("suppliers", existing.id, basePayload, "name");
      } else {
        await fanOutInsert("suppliers", basePayload as Record<string, unknown>, {
          naturalKey: (basePayload as { name?: string }).name ?? "supplier",
        });
      }
    } catch (e) {
      error = { message: e instanceof Error ? e.message : "שגיאה" };
    }
    setSaving(false);
    if (error) {
      toast.error("שמירה נכשלה: " + error.message);
      return;
    }
    toast.success(existing ? "הספק עודכן והלוח סונכרן" : "הספק נוסף והלוח סונכרן");
    onClose();
  };


  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">{existing ? "ערוך ספק" : "ספק חדש"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="שם הספק">
          <input value={name} onChange={(e) => setName(e.target.value)} className="sup-input" maxLength={120} dir="rtl" />
        </Field>

        <Field label="קטגוריה (לדוגמה: ירקות, בשר, יבש)">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="sup-input" maxLength={60} dir="rtl" />
        </Field>

        <div>
          <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">לוגו הספק</span>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-lg border border-border bg-background/60 overflow-hidden grid place-content-center shrink-0">
              {previewLogo ? (
                <img src={previewLogo} alt="לוגו" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon disabled:opacity-50 self-start"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "מעלה…" : logoUrl ? "החלף לוגו" : "העלה לוגו"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="text-[11px] text-muted-foreground hover:text-destructive self-start"
                >
                  הסר לוגו מותאם
                </button>
              )}
            </div>
          </div>
        </div>


        <div>
          <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">ימי חלוקה / הגעה</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS_HE.map((w, i) => {
              const on = weekdays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold border transition ${
                    on
                      ? "bg-success/20 border-success text-success"
                      : "border-border text-foreground hover:border-neon"
                  }`}
                >
                  {on && <Check className="inline h-3 w-3 ms-1" />}
                  {w}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="משעה (ברירת מחדל)">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="sup-input" />
          </Field>
          <Field label="עד שעה">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="sup-input" />
          </Field>
        </div>

        {/* Order time settings */}
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-3">
          <div className="text-xs font-bold text-destructive text-right">⏰ הגדרות זמני הזמנה</div>

          <div>
            <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">ימי הזמנה (אזהרה בדשבורד)</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_HE.map((w, i) => {
                const on = orderDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleOrderDay(i)}
                    className={`px-3 py-1.5 rounded-md text-sm font-bold border transition ${
                      on ? "bg-destructive/20 border-destructive text-destructive" : "border-border text-foreground hover:border-destructive"
                    }`}
                  >
                    {on && <Check className="inline h-3 w-3 ms-1" />}
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="שעת קאט-אוף להזמנה">
            <input type="time" value={orderCutoff} onChange={(e) => setOrderCutoff(e.target.value)} className="sup-input" />
          </Field>

          <div>
            <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">ימי הגעת המשלוח</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_HE.map((w, i) => {
                const on = deliveryDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDeliveryDay(i)}
                    className={`px-3 py-1.5 rounded-md text-sm font-bold border transition ${
                      on ? "bg-success/20 border-success text-success" : "border-border text-foreground hover:border-neon"
                    }`}
                  >
                    {on && <Check className="inline h-3 w-3 ms-1" />}
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        <Field label="איש קשר / טלפון">
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="sup-input" maxLength={200} dir="rtl" />
        </Field>

        <Field label="הערות">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="sup-input min-h-[80px]" maxLength={2000} dir="rtl" />
        </Field>

        <label className="flex items-center justify-end gap-2 text-sm cursor-pointer">
          <span>ספק פעיל (יוצר אירועים בלוח)</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--neon)]" />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 rounded-md bg-neon text-primary-foreground font-bold glow-neon disabled:opacity-50"
        >
          {saving ? "שומר…" : existing ? "עדכן" : "הוסף"}
        </button>

        <style>{`
          .sup-input {
            width: 100%;
            min-height: 2.5rem;
            background: var(--background);
            border: 1.5px solid var(--border);
            border-radius: 0.5rem;
            padding: 0.55rem 0.85rem;
            font-size: 0.95rem;
            color: var(--foreground);
            text-align: right;
            transition: border-color .15s, box-shadow .15s, background .15s;
          }
          .sup-input::placeholder { color: color-mix(in oklab, var(--muted-foreground) 70%, transparent); }
          .sup-input:hover { border-color: color-mix(in oklab, var(--neon) 50%, transparent); }
          .sup-input:focus {
            outline: none;
            background: var(--card);
            border-color: var(--neon);
            box-shadow: 0 0 0 3px color-mix(in oklab, var(--neon) 25%, transparent);
          }
        `}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">{label}</span>
      {children}
    </label>
  );
}
