import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Phone, Loader2, Trash2 } from "lucide-react";
import {
  useComplaints,
  STATUS_LABEL,
  type Complaint,
  type ComplaintStatus,
} from "@/lib/complaints-store";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/complaints")({
  component: ComplaintsAdminPage,
});

const STATUS_ORDER: ComplaintStatus[] = ["new", "in_progress", "resolved"];

const STATUS_STYLES: Record<
  ComplaintStatus,
  { badge: string; column: string; dot: string }
> = {
  new: {
    badge: "bg-tomato text-tomato-foreground",
    column: "border-tomato/40",
    dot: "bg-tomato",
  },
  in_progress: {
    badge: "bg-brand-gold text-brand-gold-foreground",
    column: "border-brand-gold/40",
    dot: "bg-brand-gold",
  },
  resolved: {
    badge: "bg-olive text-olive-foreground",
    column: "border-olive/40",
    dot: "bg-olive",
  },
};

function ComplaintsAdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { items, loading } = useComplaints();
  const [selected, setSelected] = useState<Complaint | null>(null);

  const grouped = useMemo(() => {
    const map: Record<ComplaintStatus, Complaint[]> = {
      new: [],
      in_progress: [],
      resolved: [],
    };
    for (const c of items) map[c.status].push(c);
    return map;
  }, [items]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">אין הרשאה</h1>
          <p className="mt-2 text-muted-foreground text-sm">דף זה מיועד לסופר אדמין בלבד.</p>
          <Link to="/" className="mt-4 inline-block text-neon underline">חזרה לדף הבית</Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">ניהול תלונות ופניות</h1>
          <p className="text-xs text-muted-foreground">
            {items.length} פניות · {grouped.new.length} חדשות
          </p>
        </div>
      </header>

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-neon" /></div>
      ) : (
        <div className="p-3 grid gap-3 md:grid-cols-3">
          {STATUS_ORDER.map((status) => {
            const list = grouped[status];
            const styles = STATUS_STYLES[status];
            return (
              <section
                key={status}
                className={`rounded-xl border-2 ${styles.column} bg-card/40 p-3`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${styles.badge}`}>
                    <span className={`h-2 w-2 rounded-full bg-current opacity-80`} />
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">{list.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="w-full text-right p-3 rounded-lg bg-card border border-zinc-800 hover:border-neon/40 transition"
                    >
                      <div className="font-bold text-foreground text-sm">{c.customer_name}</div>
                      <div className="text-xs text-muted-foreground mt-1" dir="ltr">{c.phone_number}</div>
                      <div className="text-xs text-zinc-400 mt-2 line-clamp-2 text-right">{c.description}</div>
                      <div className="text-[10px] text-zinc-600 mt-2">
                        {new Date(c.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </button>
                  ))}
                  {list.length === 0 && (
                    <div className="text-center text-xs text-zinc-600 py-6">אין פניות</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ComplaintDetailDialog complaint={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ComplaintDetailDialog({
  complaint,
  onClose,
}: {
  complaint: Complaint | null;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ComplaintStatus>("new");
  const [notes, setNotes] = useState("");
  const [comp, setComp] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-hydrate when complaint changes
  useMemo(() => {
    if (complaint) {
      setStatus(complaint.status);
      setNotes(complaint.manager_notes ?? "");
      setComp(complaint.compensation_notes ?? "");
    }
  }, [complaint]);

  const save = async () => {
    if (!complaint) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_complaints")
      .update({
        status,
        manager_notes: notes.trim() || null,
        compensation_notes: comp.trim() || null,
      })
      .eq("id", complaint.id);
    setSaving(false);
    if (error) {
      toast.error("שגיאה בשמירה");
      return;
    }
    toast.success("הפנייה עודכנה");
    onClose();
  };

  const del = async () => {
    if (!complaint) return;
    if (!confirm("למחוק את הפנייה לצמיתות?")) return;
    setDeleting(true);
    const { error } = await supabase.from("customer_complaints").delete().eq("id", complaint.id);
    setDeleting(false);
    if (error) {
      toast.error("שגיאה במחיקה");
      return;
    }
    toast.success("נמחק");
    onClose();
  };

  return (
    <Dialog open={!!complaint} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="text-right max-w-lg bg-card border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">
            {complaint?.customer_name}
          </DialogTitle>
        </DialogHeader>

        {complaint && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-muted-foreground">טלפון</div>
              <a
                href={`tel:${complaint.phone_number}`}
                className="inline-flex items-center gap-2 text-neon font-bold text-lg"
                dir="ltr"
              >
                <Phone className="h-4 w-4" />
                {complaint.phone_number}
              </a>
            </div>

            {complaint.address && (
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div className="text-xs text-muted-foreground mb-1">כתובת</div>
                <div className="text-foreground text-sm">{complaint.address}</div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-muted-foreground mb-1">תיאור התלונה</div>
              <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-2 block">סטטוס</label>
              <div className="flex gap-1 rounded-md bg-zinc-800/50 p-1">
                {STATUS_ORDER.map((s) => {
                  const active = status === s;
                  const sty = STATUS_STYLES[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded text-xs font-bold transition ${
                        active ? sty.badge : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">הערות מנהל</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                dir="rtl"
                className="text-right resize-none"
                placeholder="פעולות שבוצעו, פרטים נוספים..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-brand-gold mb-1 block">פיצוי שניתן ללקוח</label>
              <Textarea
                value={comp}
                onChange={(e) => setComp(e.target.value)}
                rows={2}
                dir="rtl"
                className="text-right resize-none border-brand-gold/40"
                placeholder="לדוגמא: זיכוי 50₪, פיצה חינם בהזמנה הבאה..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={del}
                disabled={deleting || saving}
                className="border-tomato/50 text-tomato hover:bg-tomato/10"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1 border-zinc-700">
                ביטול
              </Button>
              <Button
                onClick={save}
                disabled={saving || deleting}
                className="flex-1 bg-olive text-olive-foreground hover:opacity-90 font-bold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
