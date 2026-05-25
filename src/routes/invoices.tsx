import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Archive, FileText, ScanSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import { InvoiceIntakeModal } from "@/components/InvoiceIntakeModal";
import { SmartReceivingModal } from "@/components/SmartReceivingModal";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";


export const Route = createFileRoute("/invoices")({
  component: InvoicesPage,
});

interface SupplierOpt { id: string; name: string }
interface InvoiceRow {
  id: string;
  document_date: string;
  invoice_number: string;
  total_amount: number;
  status: "pending_review" | "approved";
  supplier_id: string | null;
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

  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());

  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const load = useCallback(async () => {
    setLoading(true);
    let supplierQuery = supabase.from("suppliers").select("id,name").eq("is_archived", false).eq("active", true).order("name");
    let invoiceQuery = supabase
      .from("invoices")
      .select("id,document_date,invoice_number,total_amount,status,supplier_id,is_archived,created_at")
      .eq("is_archived", false)
      .order("document_date", { ascending: false })
      .limit(200);
    // Super-admins see every branch via RLS; scope by the active branch switcher selection
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

  const archive = async (id: string) => {
    const ok = await confirmDelete({
      title: "העברה לארכיון",
      description: "להעביר את החשבונית לארכיון? היא לא תופיע בטבלה אך תישמר במערכת.",
      confirmLabel: "העבר לארכיון",
    });
    if (!ok) return;
    const { error } = await supabase.from("invoices").update({ is_archived: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("הועברה לארכיון"); load(); }
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">Goods Receiving</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          📥 קליטת <span className="text-neon text-glow-neon">סחורה וחשבוניות</span>
        </h1>
      </div>

      {/* Financial banner */}
      <div className="mb-5 rounded-2xl border-2 border-neon/40 bg-gradient-to-bl from-neon/10 to-transparent p-5 text-center">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-bold">סה״כ הוצאות ספקים (חודש נוכחי)</div>
        <div className="font-display text-4xl sm:text-5xl font-bold text-neon text-glow-neon mt-1 tabular-nums">
          {fmtIls(monthTotal)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <button
          onClick={() => setSmartOpen(true)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-md font-bold text-white"
          style={{ background: "linear-gradient(135deg, #ff2db4, #ff5ec0)", boxShadow: "0 0 22px rgba(255,45,180,0.5)" }}
        >
          <ScanSearch className="h-4 w-4" />
          קליטה חכמה עם זיהוי
        </button>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-md font-bold border border-border hover:border-neon hover:text-neon"
        >
          <Plus className="h-4 w-4" />
          קליטה ידנית
        </button>
      </div>


      {loading ? (
        <div className="text-center text-muted-foreground py-12">טוען…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
          אין חשבוניות עדיין
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card/60">
          <table className="w-full text-sm">
            <thead className="bg-background/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right">תאריך</th>
                <th className="px-3 py-2 text-right">ספק</th>
                <th className="px-3 py-2 text-right">מס׳ חשבונית</th>
                <th className="px-3 py-2 text-right">סכום</th>
                <th className="px-3 py-2 text-right">סטטוס</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-background/40">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.document_date}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3 text-neon" />
                      {r.supplier_id ? supplierMap[r.supplier_id] ?? "—" : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.invoice_number || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmtIls(Number(r.total_amount))}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${
                      r.status === "approved"
                        ? "border-success/60 text-success bg-success/10"
                        : "border-amber-brand/60 text-amber-brand bg-amber-brand/10"
                    }`}>
                      {r.status === "approved" ? "מאושר" : "ממתין לבדיקה"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-left">
                    <button onClick={() => archive(r.id)} className="h-7 w-7 grid place-content-center rounded-md border border-border hover:border-destructive hover:text-destructive" aria-label="ארכב">
                      <Archive className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}

