import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
    const { error } = await supabase.from("customer_complaints").insert({
      created_by: uid,
      customer_name: name.trim(),
      phone_number: phone.trim(),
      address: address.trim() || null,
      description: desc.trim(),
      order_date: orderDate || null,
      order_number: orderNumber.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("שגיאה בפתיחת הפנייה");
      return;
    }
    setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right max-w-md bg-card border-zinc-800">
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
