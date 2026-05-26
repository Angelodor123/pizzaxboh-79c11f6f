import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, ScanSearch, Eye, Pencil, Trash2, ImageOff, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { InvoiceIntakeModal, type EditInvoiceData } from "@/components/InvoiceIntakeModal";
import { SmartReceivingModal } from "@/components/SmartReceivingModal";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/invoices")({
  component: InvoicesPage,
});

interface SupplierOpt { id: string; name: string }
interface InvoiceRow {
  id: string;
  document_date: string;
  invoice_number: string | null;
  total_amount: number;
  status: "pending_review" | "approved";
  supplier_id: string | null;
  image_url: string | null;
  is_archived: boolean;
  created_at: string;
}

function fmtIls(n: number) {
  return n.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
}

function InvoicesPage() {
  const { role, loading: authLoading, isSuperAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditInvoiceData | null>(null);
  const [viewImageRow, setViewImageRow] = useState<InvoiceRow | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const load = useCallback(async () => {
    setLoading(true);
    let supplierQuery = supabase.from("suppliers").select("id,name").eq("is_archived", false).eq("active", true).order("name");
    let invoiceQuery = supabase
      .from("invoices")
      .select("id,document_date,invoice_number,total_amount,status,supplier_id,image_url,is_archived,created_at")
      .eq("is_archived", false)
      .order("document_date", { ascending: false })
      .limit(500);
    if (isSuperAdmin && branchId) {
      supplierQuery = supplierQuery.eq("branch_id", branchId);
      invoiceQuery = invoiceQuery.eq("branch_id", branchId);
    }
    const [s, i] = await Promise.all([supplierQuery, invoiceQuery]);
    const sList = (s.data as SupplierOpt[]) ?? [];
    setSuppliers(sList);
    setSupplierMap(Object.fromEntries(sList.map((x) => [x.id, x.name])));
    setRows((i.data as InvoiceRow[]) ?? []);
    setLoading(false);
  }, [isSuperAdmin, branchId]);

  useEffect(() => {
    if (role !== "admin") return;
    load();
  }, [role, load]);

  const monthTotal = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return rows
      .filter((r) => {
        const d = new Date(r.document_date);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((a, b) => a + Number(b.total_amount || 0), 0);
  })();

  const openViewImage = async (row: InvoiceRow) => {
    setViewImageRow(row);
    setViewImageUrl(null);
    if (!row.image_url) return;
    setImageLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("invoice-images")
        .createSignedUrl(row.image_url, 60 * 60);
      if (error) throw error;
      setViewImageUrl(data?.signedUrl ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בטעינת התמונה");
    } finally {
      setImageLoading(false);
    }
  };

  const startEdit = (row: InvoiceRow) => {
    setEditTarget({
      id: row.id,
      supplier_id: row.supplier_id,
      invoice_number: row.invoice_number,
      total_amount: row.total_amount,
      document_date: row.document_date,
      image_url: row.image_url,
    });
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Remove items first to avoid orphan FK
      await supabase.from("invoice_items").delete().eq("invoice_id", deleteTarget.id);
      const { error } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("החשבונית נמחקה בהצלחה");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "מחיקה נכשלה");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-muted-foreground">טוען…</div>;
  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">אין הרשאה. מודול קליטת סחורה זמין למנהלים בלבד.</p>
        <Link to="/" className="text-neon font-bold mt-3 inline-block">חזרה לדף הבית</Link>
      </div>
    );
  }

  const recent = rows.slice(0, 12);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6" dir="rtl">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Goods Receiving</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 leading-tight">
          📥 דף בית <span className="text-neon text-glow-neon">קליטת סחורה</span>
        </h1>
      </div>

      {/* KPI */}
      <div className="rounded-2xl border-2 border-neon/40 bg-gradient-to-bl from-neon/10 to-transparent p-6 text-center flex flex-col items-center justify-center gap-2">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-bold leading-none">
          סה״כ הוצאות ספקים (חודש נוכחי)
        </div>
        <div className="font-display text-4xl sm:text-5xl font-bold text-neon text-glow-neon tabular-nums leading-tight">
          {fmtIls(monthTotal)}
        </div>
      </div>

      {/* Primary actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
        <button
          onClick={() => setSmartOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md font-bold text-white"
          style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 22px rgba(255,45,180,0.5)" }}
        >
          <ScanSearch className="h-4 w-4" />
          קליטה חכמה עם זיהוי
        </button>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md font-bold border border-border hover:border-neon hover:text-neon"
        >
          <Plus className="h-4 w-4" />
          קליטה ידנית
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recent" dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="recent" className="font-bold">קליטות אחרונות</TabsTrigger>
          <TabsTrigger value="archive" className="font-bold">ארכיון חשבוניות</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">טוען…</div>
          ) : recent.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
              אין קליטות אחרונות
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm flex items-center gap-1.5 truncate">
                      <FileText className="h-3.5 w-3.5 text-neon shrink-0" />
                      <span className="truncate">{r.supplier_id ? supplierMap[r.supplier_id] ?? "—" : "—"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0">{r.document_date}</div>
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">סכום</div>
                      <div className="font-display text-xl font-bold text-neon tabular-nums">{fmtIls(Number(r.total_amount))}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      חשבונית: <span className="tabular-nums">{r.invoice_number || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <IconAction label="צפה בחשבונית" onClick={() => openViewImage(r)}><Eye className="h-3.5 w-3.5" /></IconAction>
                    <IconAction label="ערוך" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                    <IconAction label="מחק" danger onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">טוען…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
              אין חשבוניות בארכיון
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-card/60">
              <div className="grid grid-cols-[110px_minmax(0,1fr)_110px_110px_140px] items-center gap-2 px-4 py-3 bg-background/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <div className="text-center">תאריך</div>
                <div className="text-center">ספק</div>
                <div className="text-center">מס׳ חשבונית</div>
                <div className="text-center">סכום</div>
                <div className="text-center">פעולות</div>
              </div>
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[110px_minmax(0,1fr)_110px_110px_140px] items-center gap-2 px-4 py-3 text-sm hover:bg-background/40">
                    <div className="text-center tabular-nums whitespace-nowrap">{r.document_date}</div>
                    <div className="text-center truncate">
                      <span className="inline-flex items-center gap-1.5 max-w-full">
                        <FileText className="h-3 w-3 text-neon shrink-0" />
                        <span className="truncate">{r.supplier_id ? supplierMap[r.supplier_id] ?? "—" : "—"}</span>
                      </span>
                    </div>
                    <div className="text-center text-muted-foreground tabular-nums">{r.invoice_number || "—"}</div>
                    <div className="text-center tabular-nums font-bold text-neon">{fmtIls(Number(r.total_amount))}</div>
                    <div className="flex items-center justify-center gap-1.5">
                      <IconAction label="צפה בחשבונית" onClick={() => openViewImage(r)}><Eye className="h-3.5 w-3.5" /></IconAction>
                      <IconAction label="ערוך" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                      <IconAction label="מחק" danger onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Intake modal */}
      {open && (
        <InvoiceIntakeModal
          suppliers={suppliers}
          onClose={() => setOpen(false)}
          onSaved={load}
        />
      )}
      {smartOpen && (
        <SmartReceivingModal
          suppliers={suppliers}
          onClose={() => setSmartOpen(false)}
          onSaved={load}
        />
      )}
      {editTarget && (
        <InvoiceIntakeModal
          suppliers={suppliers}
          onClose={() => setEditTarget(null)}
          onSaved={load}
          editInvoice={editTarget}
          onDeleted={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}

      {/* View image lightbox */}
      {viewImageRow && (
        <div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setViewImageRow(null)}
          dir="rtl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-card border border-border rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="truncate">
                <div className="text-[10px] uppercase tracking-[0.25em] text-neon font-bold">Invoice Image</div>
                <h3 className="font-display text-lg font-bold truncate">
                  {viewImageRow.supplier_id ? supplierMap[viewImageRow.supplier_id] ?? "—" : "—"}
                  <span className="text-muted-foreground font-normal text-sm me-2"> · {viewImageRow.document_date}</span>
                </h3>
              </div>
              <button onClick={() => setViewImageRow(null)} className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon" aria-label="סגור">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 grid place-items-center bg-zinc-900/60 min-h-[260px]">
              {imageLoading ? (
                <div className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען תמונה…</div>
              ) : viewImageUrl ? (
                <img src={viewImageUrl} alt="חשבונית" className="max-w-full max-h-[70vh] object-contain" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageOff className="h-8 w-8 mx-auto mb-2" />
                  אין תמונה שמורה לחשבונית זו
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת חשבונית</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק חשבונית זו לצמיתות? פעולה זו אינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "מחק לצמיתות"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconAction({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-9 w-9 grid place-content-center rounded-md border border-border transition ${
        danger ? "hover:border-destructive hover:text-destructive" : "hover:border-neon hover:text-neon"
      }`}
    >
      {children}
    </button>
  );
}
