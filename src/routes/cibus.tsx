import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Plus, Minus, Loader2, Wallet, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cibus")({
  component: CibusPage,
});

interface Wallet {
  id: string;
  customer_name: string;
  phone_number: string;
  balance: number;
  last_updated: string;
}

function CibusPage() {
  const { session } = useAuth();
  const [q, setQ] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("cibus_wallets")
      .select("*")
      .order("last_updated", { ascending: false });
    if (!error && data) setWallets(data as Wallet[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("cibus-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "cibus_wallets" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return wallets;
    return wallets.filter(
      (w) => w.customer_name.toLowerCase().includes(t) || w.phone_number.includes(t),
    );
  }, [q, wallets]);

  const showCreateBtn = q.trim().length >= 2 && filtered.length === 0;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand-gold" />
          <h1 className="text-lg font-bold text-foreground">ארנק סיבוס</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון..."
            className="pr-10 text-right h-12 text-base"
            dir="rtl"
          />
        </div>

        {showCreateBtn && (
          <Button
            onClick={() => setShowCreate(true)}
            className="w-full h-12 bg-brand-gold text-brand-gold-foreground hover:opacity-90 font-bold"
          >
            <UserPlus className="h-4 w-4 ml-2" />
            צור ארנק חדש ללקוח
          </Button>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-neon" /></div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => setSelected(w)}
                  className="w-full text-right p-4 rounded-xl bg-card border border-zinc-800 hover:border-brand-gold/40 transition flex items-center gap-3"
                >
                  <div className="flex-1 text-right">
                    <div className="font-bold text-foreground">{w.customer_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{w.phone_number}</div>
                  </div>
                  <div
                    className={`text-2xl font-black tabular-nums ${
                      w.balance > 0 ? "text-olive" : w.balance < 0 ? "text-tomato" : "text-muted-foreground"
                    }`}
                  >
                    ₪{Number(w.balance).toFixed(2)}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && !showCreateBtn && (
              <li className="text-center text-muted-foreground py-8 text-sm">
                {q ? "לא נמצאו תוצאות" : "אין ארנקים במערכת"}
              </li>
            )}
          </ul>
        )}
      </div>

      <WalletDetail wallet={selected} onClose={() => setSelected(null)} />
      <CreateWalletDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        prefillSearch={q}
        userId={session?.user?.id ?? null}
      />
    </div>
  );
}

function WalletDetail({ wallet, onClose }: { wallet: Wallet | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wallet) setAmount("");
  }, [wallet]);

  if (!wallet) return null;

  const apply = async (sign: 1 | -1) => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.error("הזן סכום חיובי");
      return;
    }
    setBusy(true);
    const newBalance = Number(wallet.balance) + sign * num;
    const { error } = await supabase
      .from("cibus_wallets")
      .update({ balance: newBalance, last_updated: new Date().toISOString() })
      .eq("id", wallet.id);
    setBusy(false);
    if (error) {
      toast.error("שגיאה בעדכון");
      return;
    }
    toast.success(sign === 1 ? `נוספו ₪${num.toFixed(2)}` : `נוצלו ₪${num.toFixed(2)}`);
    setAmount("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
      >
        <div>
          <div className="text-xs text-muted-foreground">לקוח</div>
          <div className="text-xl font-bold text-foreground">{wallet.customer_name}</div>
          <div className="text-xs text-muted-foreground mt-1" dir="ltr">{wallet.phone_number}</div>
        </div>

        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-6 text-center">
          <div className="text-xs text-muted-foreground mb-2">יתרה נוכחית</div>
          <div
            className={`text-5xl font-black tabular-nums ${
              wallet.balance > 0 ? "text-olive" : wallet.balance < 0 ? "text-tomato" : "text-foreground"
            }`}
          >
            ₪{Number(wallet.balance).toFixed(2)}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">סכום (₪)</label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="text-center text-xl font-bold h-14"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => apply(-1)}
            disabled={busy}
            className="h-14 bg-tomato text-tomato-foreground hover:opacity-90 font-bold text-base"
          >
            <Minus className="h-5 w-5 ml-2" />
            מימוש יתרה
          </Button>
          <Button
            onClick={() => apply(1)}
            disabled={busy}
            className="h-14 bg-olive text-olive-foreground hover:opacity-90 font-bold text-base"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף צבירה
          </Button>
        </div>

        <Button variant="outline" onClick={onClose} className="w-full h-11 border-zinc-700">
          סגור
        </Button>
      </div>
    </div>
  );
}

function CreateWalletDialog({
  open,
  onOpenChange,
  prefillSearch,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefillSearch: string;
  userId: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      // Prefill phone if search looks like a number, otherwise name
      const t = prefillSearch.trim();
      if (/^\+?\d[\d\-\s]*$/.test(t)) {
        setPhone(t);
        setName("");
      } else {
        setName(t);
        setPhone("");
      }
      setInitial("");
    }
  }, [open, prefillSearch]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("שם וטלפון חובה");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("cibus_wallets").insert({
      customer_name: name.trim(),
      phone_number: phone.trim(),
      balance: parseFloat(initial) || 0,
      created_by: userId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "כבר קיים ארנק עם טלפון זה" : "שגיאה ביצירה");
      return;
    }
    toast.success("ארנק נוצר בהצלחה");
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => onOpenChange(false)}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-3"
      >
        <h2 className="text-lg font-bold text-foreground">ארנק חדש</h2>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">שם הלקוח *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-right" dir="rtl" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">טלפון *</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" className="text-left" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">יתרה התחלתית (₪)</label>
          <Input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" placeholder="0.00" className="text-center text-lg font-bold" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-zinc-700">ביטול</Button>
          <Button onClick={submit} disabled={busy} className="flex-1 bg-brand-gold text-brand-gold-foreground hover:opacity-90 font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "צור ארנק"}
          </Button>
        </div>
      </div>
    </div>
  );
}
