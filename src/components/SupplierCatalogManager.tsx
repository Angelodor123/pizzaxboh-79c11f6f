import { useEffect, useRef, useState } from "react";
import { Package, Trash2, Upload, Loader2, Image as ImageIcon, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadSupplierProducts,
  type SupplierProduct,
  CATALOG_UNITS,
  CATALOG_CATEGORIES,
} from "@/lib/supplier-products";

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
  expected_price: string;
  category: string;
  min_stock_alert: string;
  image_url: string | null;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  sku: "",
  unit_size: "",
  unit: "",
  default_qty: "1",
  price: "",
  expected_price: "",
  category: "",
  min_stock_alert: "",
  image_url: null,
};

const fieldClass =
  "w-full h-10 rounded-md bg-background border border-border px-2.5 text-sm focus:border-neon outline-none";
const labelClass = "text-[11px] font-bold text-muted-foreground mb-1 block text-right";

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
      expected_price: p.expected_price != null ? String(p.expected_price) : "",
      category: p.category ?? "",
      min_stock_alert: p.min_stock_alert != null ? String(p.min_stock_alert) : "",
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
        expected_price: draft.expected_price.trim() ? Number(draft.expected_price) : null,
        category: draft.category.trim() || null,
        min_stock_alert: draft.min_stock_alert.trim() ? Number(draft.min_stock_alert) : null,
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

  const remove = async (p: SupplierProduct) => {
    const ok = await confirmDelete({
      title: "מחיקת מוצר מקטלוג",
      itemName: p.name,
    });
    if (!ok) return;
    const { error } = await supabase.from("supplier_products").delete().eq("id", p.id);
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
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Package className="h-5 w-5 text-neon" />
            {supplierName} — הוספת מוצר לקטלוג
          </DialogTitle>
        </DialogHeader>

        {/* Add / Edit form — compact 2-col grid */}
        <div className="border border-border rounded-xl p-4 space-y-3 bg-background/40">
          <div className="text-xs font-bold text-neon">{editingId ? "עריכת מוצר" : "פריט חדש לקטלוג"}</div>

          {/* Name (full width) */}
          <div>
            <label className={labelClass}>שם המוצר *</label>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="לדוגמה: עגבניות שרי"
              className={fieldClass}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>מק״ט / SKU</label>
              <input
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                placeholder="SKU-123"
                className={fieldClass}
                maxLength={64}
              />
            </div>
            <div>
              <label className={labelClass}>קטגוריה</label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger className="h-10 text-right">
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={labelClass}>יחידת מידה</label>
              <Select value={draft.unit} onValueChange={(v) => setDraft({ ...draft, unit: v })}>
                <SelectTrigger className="h-10 text-right">
                  <SelectValue placeholder="בחר יחידה" />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelClass}>גודל אריזה</label>
              <input
                value={draft.unit_size}
                onChange={(e) => setDraft({ ...draft, unit_size: e.target.value })}
                placeholder="לדוגמה: ארגז × 5 ק״ג"
                className={fieldClass}
                maxLength={80}
              />
            </div>

            <div>
              <label className={labelClass}>כמות ברירת מחדל</label>
              <input
                value={draft.default_qty}
                onChange={(e) => setDraft({ ...draft, default_qty: e.target.value })}
                type="number"
                min={0}
                step="any"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>התראת מלאי נמוך</label>
              <input
                value={draft.min_stock_alert}
                onChange={(e) => setDraft({ ...draft, min_stock_alert: e.target.value })}
                placeholder="כמות מינ׳ במלאי"
                type="number"
                min={0}
                step="any"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>מחיר נוכחי (₪)</label>
              <input
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="0.00"
                type="number"
                min={0}
                step="any"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>מחיר צפוי (₪)</label>
              <input
                value={draft.expected_price}
                onChange={(e) => setDraft({ ...draft, expected_price: e.target.value })}
                placeholder="לבדיקת אנומליות"
                type="number"
                min={0}
                step="any"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Image upload (full width) */}
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-md border border-border hover:border-neon hover:text-neon text-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {draft.image_url ? "החלף תמונה" : "העלאת תמונה"}
            </button>
            {draft.image_url && (
              <img src={draft.image_url} alt="" className="h-12 w-12 rounded object-cover border border-border" />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {editingId && (
              <button onClick={cancelEdit} className="h-11 px-4 rounded-md border border-border text-sm hover:text-neon">
                ביטול
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !draft.name.trim()}
              className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-md bg-neon text-black font-bold text-sm disabled:opacity-50"
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
                      {p.category && <span className="text-amber-brand">{p.category} · </span>}
                      {p.unit_size || p.unit}
                      {p.price != null && <> · <span className="text-foreground/80">₪{p.price}</span></>}
                      {p.min_stock_alert != null && <> · מלאי מינ׳: {p.min_stock_alert}</>}
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
                      onClick={() => remove(p)}
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
