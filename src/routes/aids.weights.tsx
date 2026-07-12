import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, Plus, Pencil, X, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveBranchIdSync, requireCurrentBranchId } from "@/lib/current-branch";

export const Route = createFileRoute("/aids/weights")({
  head: () => ({
    meta: [
      { title: "משקלי כלים — Pizza X" },
      { name: "description", content: "טבלת משקל תרה לכלי מטבח." },
      { property: "og:title", content: "משקלי כלים — Pizza X" },
      { property: "og:description", content: "טבלת משקל תרה לכלי מטבח." },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/aids/weights" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/aids/weights" }],
  }),
  component: WeightsPage,
});

interface ContainerWeight {
  id: string;
  name: string;
  weight_grams: number;
  unit: string;
  notes: string | null;
  branch_id: string | null;
  created_at: string;
}


function WeightsPage() {
  const { role, isSuperAdmin, session } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<ContainerWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContainerWeight | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalWeight, setModalWeight] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalUnit, setModalUnit] = useState<string>("גרם");

  const [modalBranchScope, setModalBranchScope] = useState<"all" | "branch">("all");
  const [modalSelectedBranchId, setModalSelectedBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadItems = async () => {
    const activeBranch = getActiveBranchIdSync();
    let query = supabase
      .from("container_weights")
      .select("*")
      .order("sort_order")
      .order("name");
    if (activeBranch) {
      query = query.or(`branch_id.is.null,branch_id.eq.${activeBranch}`);
    } else {
      query = query.is("branch_id", null);
    }
    const { data, error } = await query;
    if (!error && data) setItems(data as ContainerWeight[]);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
    supabase
      .from("branches")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setBranches(data as { id: string; name: string }[]);
      });
    const iv = setInterval(loadItems, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetModal = () => {
    setEditingItem(null);
    setModalName("");
    setModalWeight("");
    setModalNotes("");
    setModalBranchScope("all");
    setModalSelectedBranchId("");
  };

  const openAdd = () => {
    resetModal();
    setShowModal(true);
  };

  const openEdit = (item: ContainerWeight) => {
    setEditingItem(item);
    setModalName(item.name);
    setModalWeight(item.weight_grams.toString());
    setModalNotes(item.notes || "");
    setModalBranchScope(item.branch_id ? "branch" : "all");
    setModalSelectedBranchId(item.branch_id || "");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetModal();
  };

  const copyWeight = async (item: ContainerWeight) => {
    try {
      await navigator.clipboard.writeText(`משקל ${item.name}: ${item.weight_grams}גרם`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("העתקה נכשלה");
    }
  };

  const weightNum = parseInt(modalWeight, 10);
  const canSave =
    modalName.trim().length > 0 && Number.isFinite(weightNum) && weightNum > 0;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await requireCurrentBranchId();
    } catch {
      toast.error("יש לבחור סניף פעיל");
      return;
    }
    const record = {
      name: modalName.trim(),
      weight_grams: weightNum,
      notes: modalNotes.trim() || null,
      branch_id:
        modalBranchScope === "all"
          ? null
          : modalSelectedBranchId || null,
    };
    if (editingItem) {
      const { error } = await supabase
        .from("container_weights")
        .update(record)
        .eq("id", editingItem.id);
      if (error) return toast.error("שמירה נכשלה");
    } else {
      const { error } = await supabase.from("container_weights").insert({
        ...record,
        created_by: session?.user?.id ?? null,
      });
      if (error) return toast.error("שמירה נכשלה");
    }
    await loadItems();
    closeModal();
    toast("הכלי נשמר");
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    if (!window.confirm(`למחוק את ${editingItem.name}?`)) return;
    const { error } = await supabase
      .from("container_weights")
      .delete()
      .eq("id", editingItem.id);
    if (error) return toast.error("מחיקה נכשלה");
    await loadItems();
    closeModal();
    toast("הכלי נמחק");
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const canEdit = isAdmin || isSuperAdmin;

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-6">
      <Link
        to="/aids"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neon mb-4 block"
      >
        <ArrowRight className="h-4 w-4" />
        עזרים
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <Scale className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-extrabold">משקלי כלים</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        טבלת משקל תרה לכלי המטבח — לחץ על משקל להעתקה
      </p>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש כלי..."
            className="w-full rounded-md border border-border bg-card/60 px-3 py-2 text-sm"
          />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="bg-neon text-primary-foreground rounded-md px-3 py-2 inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <>
          <div className="h-16 rounded-xl bg-card/40 animate-pulse mb-2" />
          <div className="h-16 rounded-xl bg-card/40 animate-pulse mb-2" />
          <div className="h-16 rounded-xl bg-card/40 animate-pulse mb-2" />
        </>
      ) : filtered.length === 0 && search ? (
        <div className="text-center text-muted-foreground py-8">
          לא נמצאו כלים תואמים
        </div>
      ) : items.length === 0 && !search ? (
        <div className="text-center py-10 flex flex-col items-center gap-3">
          <Scale className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">אין כלים עדיין</div>
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              className="bg-neon text-primary-foreground rounded-md px-3 py-2 inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              הוסף כלי
            </button>
          )}
        </div>
      ) : (
        filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-card/60 px-4 py-3 flex items-center gap-3 mb-2"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <div className="font-bold text-sm truncate">{item.name}</div>
              {item.notes && (
                <div className="text-xs text-muted-foreground">{item.notes}</div>
              )}
              {item.branch_id && (
                <span className="inline-flex text-[10px] border border-border rounded-full px-1.5 py-0.5 text-muted-foreground mt-0.5 w-fit">
                  סניף ספציפי
                </span>
              )}
            </div>
            <div className="flex items-end gap-1">
              <span className="font-black text-3xl tabular-nums text-neon leading-none">
                {item.weight_grams}
              </span>
              <span className="text-xs text-muted-foreground self-end mb-1">גרם</span>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => copyWeight(item)}
                  className="p-2 text-muted-foreground hover:text-neon"
                  aria-label="העתק"
                >
                  {copiedId === item.id ? (
                    <Check className="h-4 w-4 text-neon" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="p-2 text-muted-foreground hover:text-neon"
                  aria-label="ערוך"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg">
                {editingItem ? "עריכת כלי" : "הוספת כלי"}
              </div>
              <button type="button" onClick={closeModal} aria-label="סגור">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                שם הכלי
              </label>
              <input
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                maxLength={100}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                משקל בגרמים
              </label>
              <input
                type="number"
                value={modalWeight}
                onChange={(e) => setModalWeight(e.target.value)}
                min={1}
                max={99999}
                step={1}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                הערות (אופציונלי)
              </label>
              <input
                type="text"
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="למשל: ללא מכסה"
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">תחולה</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setModalBranchScope("all")}
                  className={`rounded-md border px-3 py-2 text-sm text-right ${
                    modalBranchScope === "all"
                      ? "bg-neon/10 border-neon text-neon"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  כל הסניפים
                </button>
                <button
                  type="button"
                  onClick={() => setModalBranchScope("branch")}
                  className={`rounded-md border px-3 py-2 text-sm text-right ${
                    modalBranchScope === "branch"
                      ? "bg-neon/10 border-neon text-neon"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  סניף ספציפי
                </button>
                {modalBranchScope === "branch" && (
                  <select
                    value={modalSelectedBranchId}
                    onChange={(e) => setModalSelectedBranchId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">בחר סניף</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="w-full bg-neon text-primary-foreground rounded-lg py-2.5 font-bold disabled:opacity-50"
            >
              שמור
            </button>

            {editingItem && (
              <button
                type="button"
                onClick={handleDelete}
                className="border border-destructive/40 text-destructive rounded-lg py-2 w-full text-sm"
              >
                מחק
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
