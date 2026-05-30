import { useEffect, useRef, useState } from "react";
import { Package, Trash2, Upload, Loader2, Image as ImageIcon, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadSupplierProducts, type SupplierProduct } from "@/lib/supplier-products";

interface Props {
  supplierId: string;
  supplierName: string;
  open: boolean;
  onClose: () => void;
}

type Draft = {
  id?: string;
  name: string;
  sku: string;
  unit_size: string;
  unit: string;
  default_qty: string;
  price: string;
  category: string;
  image_url: string | null;
};

const EMPTY_DRAFT: Draft = { name: "", sku: "", unit_size: "", unit: "", default_qty: "1", price: "", category: "", image_url: null };

export function SupplierCatalogManager({ supplierId, supplierName, open, onClose }: Props) {
  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await loadSupplierProducts(supplierId));
    } catch (e: any) {
      toast.error("שגיאה בטעינת קטלוג: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplierId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${supplierId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("supplier-product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("supplier-product-images").getPublicUrl(path);
      setDraft((d) => ({ ...d, image_url: data.publicUrl }));
      toast.success("התמונה הועלתה");
    } catch (e: any) {
      toast.error("העלאת תמונה נכשלה: " + (e?.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (p: SupplierProduct) => {
    setEditingId(p.id);
    setDraft({
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      unit_size: p.unit_size ?? "",
      unit: p.unit ?? "",
      default_qty: String(p.default_qty ?? 1),
      price: p.price != null ? String(p.price) : "",
      category: p.category ?? "",
      image_url: p.image_url,
    });
  };

  const cancelEdit = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("שם המוצר חובה");
      return;
    }
    setSaving(true);
    try {
      const branchId = await requireCurrentBranchId();
      const payload = {
        supplier_id: supplierId,
        branch_id: branchId,
        name: draft.name.trim(),
        sku: draft.sku.trim() || null,
        unit_size: draft.unit_size.trim() || null,
        unit: draft.unit.trim(),
        default_qty: Number(draft.default_qty) || 1,
        price: draft.price.trim() ? Number(draft.price) : null,
        category: draft.category.trim() || null,
        image_url: draft.image_url,
      };
      if (editingId) {
        const { error } = await supabase.from("supplier_products").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("המוצר עודכן");
        cancelEdit();
        await load();
      } else {
        const { error } = await supabase.from("supplier_products").insert({ ...payload, sort_order: items.length });
        if (error) throw error;
        toast.success("המוצר נוסף לקטלוג");
        cancelEdit();
        await load();
        onClose();
      }
    } catch (e: any) {
      toast.error("שמירה נכשלה: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק את המוצר מהקטלוג?")) return;
    const { error } = await supabase.from("supplier_products").delete().eq("id", id);
    if (error) {
      toast.error("מחיקה נכשלה: " + error.message);
      return;
    }
    toast.success("המוצר נמחק");
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">📦 הוספת מוצר לקטלוג — {supplierName}</DialogTitle>
        </DialogHeader>

        {/* Add / Edit form */}
        <div className="border border-border rounded-xl p-4 space-y-3 bg-background/40">
          <div className="text-xs font-bold text-neon">{editingId ? "עריכת מוצר" : "הוספת מוצר חדש"}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="שם המוצר"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              maxLength={120}
            />
            <input
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder="מק״ט / SKU"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              maxLength={64}
            />
            <input
              value={draft.unit_size}
              onChange={(e) => setDraft({ ...draft, unit_size: e.target.value })}
              placeholder='גודל אריזה (כגון: ארגז - 1 יח׳ × 2 ק״ג)'
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              maxLength={80}
            />
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="קטגוריה (אופציונלי)"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              maxLength={60}
            />

            <input
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              placeholder="יחידה (ק״ג / יח׳ / ארגז)"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
              maxLength={20}
            />
            <input
              value={draft.default_qty}
              onChange={(e) => setDraft({ ...draft, default_qty: e.target.value })}
              placeholder="כמות ברירת מחדל"
              type="number"
              min={0}
              step="any"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
            />
            <input
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="מחיר (אופציונלי)"
              type="number"
              min={0}
              step="any"
              className="h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md border border-border hover:border-neon hover:text-neon text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {draft.image_url ? "החלף תמונה" : "העלאת תמונה"}
              </button>
              {draft.image_url && (
                <img src={draft.image_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editingId && (
              <button onClick={cancelEdit} className="h-9 px-3 rounded-md border border-border text-sm hover:text-neon">
                ביטול
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !draft.name.trim()}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-neon text-black font-bold text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? "שמור שינויים" : "הוסף לקטלוג"}
            </button>
          </div>
        </div>

        {/* Product grid */}
        <div className="mt-4">
          <div className="text-xs font-bold text-muted-foreground mb-2">מוצרים בקטלוג ({items.length})</div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">טוען…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
              אין מוצרים בקטלוג. הוסף את הראשון מעל.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((p) => (
                <div key={p.id} className="border border-border rounded-lg p-2 bg-background/30 flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-md bg-zinc-900/60 grid place-items-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-zinc-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight">{p.name}</div>
                    {p.sku && <div className="text-[11px] text-muted-foreground tabular-nums">{p.sku}</div>}
                    <div className="text-[11px] text-muted-foreground">
                      {p.unit_size || p.unit}
                      {p.price != null && <> · <span className="text-foreground/80">₪{p.price}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="h-8 w-8 grid place-content-center rounded border border-border hover:text-neon hover:border-neon"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="h-8 w-8 grid place-content-center rounded border border-border hover:text-destructive hover:border-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
