import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/lib/auth";
import { getCurrentBranchId } from "@/lib/current-branch";
import { toast } from "sonner";
import { runOrQueue } from "@/lib/offline-queue";
import { QK } from "@/lib/queue-handlers";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";

const SUCCESS_SCRIPT =
  "חברים רשמתי את הפרטים שלכם, המנהל יצור איתכם קשר בהקדם האפשרי במהלך היום כדי לדבר איתכם ולפתור את הדברים על הצד הטוב ביותר.";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function ComplaintModal({ open, onOpenChange }: Props) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [desc, setDesc] = useState("");
  const [orderDate, setOrderDate] = useState(todayLocal());
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Stable per-submission key for idempotency (resets after success/close).
  const clientIdRef = useRef<string>(crypto.randomUUID());

  // Auto-save draft so a closed/crashed page doesn't lose what was typed.
  const draft = useAutosaveDraft(
    "complaint-new",
    { name, phone, address, desc, orderDate, orderNumber },
    (v) => {
      setName(v.name ?? "");
      setPhone(v.phone ?? "");
      setAddress(v.address ?? "");
      setDesc(v.desc ?? "");
      setOrderDate(v.orderDate ?? todayLocal());
      setOrderNumber(v.orderNumber ?? "");
      if ((v.name || v.desc || v.phone)?.trim()) {
        toast.info("שוחזרה טיוטה קודמת");
      }
    },
    open && !done,
  );

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setAddress("");
      setDesc("");
      setOrderDate(todayLocal());
      setOrderNumber("");
      setSubmitting(false);
      setDone(false);
      clientIdRef.current = crypto.randomUUID();
    }
  }, [open]);

  const canSubmit = name.trim() && phone.trim() && desc.trim() && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const uid = session?.user?.id;
    if (!uid) {
      toast.error("נדרשת התחברות");
      return;
    }
    setSubmitting(true);
    const branchId = await getCurrentBranchId();
    const row = {
      created_by: uid,
      branch_id: branchId,
      customer_name: name.trim(),
      phone_number: phone.trim(),
      address: address.trim() || null,
      description: desc.trim(),
      order_date: orderDate || null,
      order_number: orderNumber.trim() || null,
    };
    try {
      await runOrQueue(QK.ComplaintInsert, { row }, "פתיחת תלונה", {
        clientId: clientIdRef.current,
      });
      draft.reset();
      setDone(true);
    } catch {
      // toast handled inside runOrQueue
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="text-right max-w-md bg-card border-zinc-800"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">
            {done ? "✅ נרשם בהצלחה" : "פתיחת תלונה / פנייה"}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/40 bg-success/10 p-5 text-right">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="font-bold text-success">קרא ללקוח את ההודעה הבאה:</span>
              </div>
              <p className="text-foreground text-base leading-relaxed font-medium">
                "{SUCCESS_SCRIPT}"
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 bg-neon text-primary-foreground hover:opacity-90"
            >
              סגור
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">שם הלקוח *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} dir="rtl" className="text-right" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">טלפון *</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">כתובת</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">תאריך הזמנה</label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  dir="rtl"
                  className="text-right"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">מספר הזמנה</label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-left"
                  placeholder="#1234"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">תיאור התלונה *</label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                dir="rtl"
                className="text-right resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 border-zinc-700"
              >
                <X className="h-4 w-4 ml-1" />
                ביטול
              </Button>
              <Button
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 h-11 bg-destructive text-destructive-foreground hover:opacity-90 font-bold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "שלח פנייה"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
