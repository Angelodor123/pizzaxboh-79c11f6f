import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Plus, Minus, Loader2, Wallet, UserPlus, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getActiveBranchIdSync } from "@/lib/current-branch";

export const Route = createFileRoute("/cibus")({
  beforeLoad: async () => {
    // Feature-flag: this module is currently active only for the Modiin branch.
    const id = getActiveBranchIdSync();
    if (!id) return;
    const { data } = await supabase.from("branches").select("name").eq("id", id).maybeSingle();
    if (data?.name && data.name !== "מודיעין") {
      throw redirect({ to: "/" });
    }
  },
  component: CibusPage,
});

interface Wallet {
  id: string;
  customer_name: string;
  phone_number: string;
  balance: number;
  last_updated: string;
}

interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: "add" | "deduct" | "initial";
  balance_after: number;
  note: string | null;
  created_at: string;
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

  // Keep the selected wallet in sync with realtime balance changes
  useEffect(() => {
    if (!selected) return;
    const fresh = wallets.find((w) => w.id === selected.id);
    if (fresh && fresh.balance !== selected.balance) setSelected(fresh);
  }, [wallets, selected]);

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
          <Wallet className="h-5 w-5 text-amber-brand" />
          <h1 className="text-lg font-bold text-foreground">ארנק סיבוס</h1>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="h-9 bg-amber-brand text-amber-brand-foreground hover:opacity-90 font-bold"
        >
          <UserPlus className="h-4 w-4 ml-1.5" />
          חדש
        </Button>
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
            className="w-full h-12 bg-amber-brand text-amber-brand-foreground hover:opacity-90 font-bold"
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
                  className="w-full text-right p-4 rounded-xl bg-card border border-zinc-800 hover:border-amber-brand/40 transition flex items-center gap-3"
                >
                  <div className="flex-1 text-right">
                    <div className="font-bold text-foreground">{w.customer_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{w.phone_number}</div>
                  </div>
                  <div
                    className={`text-2xl font-black tabular-nums ${
                      w.balance > 0 ? "text-success" : w.balance < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    ₪{Number(w.balance).toFixed(2)}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && !showCreateBtn && (
              <li className="text-center py-10 space-y-3">
                <div className="text-muted-foreground text-sm">
                  {q ? "לא נמצאו תוצאות" : "אין ארנקים במערכת"}
                </div>
                <Button
                  onClick={() => setShowCreate(true)}
                  className="h-11 px-6 bg-amber-brand text-amber-brand-foreground hover:opacity-90 font-bold"
                >
                  <UserPlus className="h-4 w-4 ml-2" />
                  צור ארנק ראשון
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      <WalletDetail
        wallet={selected}
        onClose={() => setSelected(null)}
        userId={session?.user?.id ?? null}
      />
      <CreateWalletDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        prefillSearch={q}
        userId={session?.user?.id ?? null}
      />
    </div>
  );
}

function WalletDetail({
  wallet,
  onClose,
  userId,
}: {
  wallet: Wallet | null;
  onClose: () => void;
  userId: string | null;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setAmount("");
      setHistory([]);
      return;
    }
    let alive = true;
    setHistoryLoading(true);
    supabase
      .from("cibus_transactions_log")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!alive) return;
        setHistory((data ?? []) as Transaction[]);
        setHistoryLoading(false);
      });

    const ch = supabase
      .channel(`cibus-tx-${wallet.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cibus_transactions_log",
          filter: `wallet_id=eq.${wallet.id}`,
        },
        (payload) => setHistory((prev) => [payload.new as Transaction, ...prev]),
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
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
    if (error) {
      setBusy(false);
      toast.error("שגיאה בעדכון");
      return;
    }

    // Audit log — best-effort; UI continues even if logging fails
    await supabase.from("cibus_transactions_log").insert({
      wallet_id: wallet.id,
      amount: num,
      type: sign === 1 ? "add" : "deduct",
      balance_after: newBalance,
      created_by: userId,
    });

    setBusy(false);
    toast.success(sign === 1 ? `נוספו ₪${num.toFixed(2)}` : `נוצלו ₪${num.toFixed(2)}`);
    setAmount("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-card border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
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
              wallet.balance > 0 ? "text-success" : wallet.balance < 0 ? "text-destructive" : "text-foreground"
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
            className="h-14 bg-destructive text-destructive-foreground hover:opacity-90 font-bold text-base"
          >
            <Minus className="h-5 w-5 ml-2" />
            מימוש יתרה
          </Button>
          <Button
            onClick={() => apply(1)}
            disabled={busy}
            className="h-14 bg-success text-success-foreground hover:opacity-90 font-bold text-base"
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף צבירה
          </Button>
        </div>

        {/* Transaction history timeline */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-amber-brand" />
            <h3 className="text-sm font-bold text-foreground">היסטוריית עסקאות</h3>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-zinc-800 rounded-lg">
              אין עסקאות עדיין
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {history.map((tx) => {
                const isAdd = tx.type === "add" || tx.type === "initial";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60 text-xs"
                  >
                    <span
                      className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full ${
                        isAdd ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {isAdd ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold tabular-nums ${isAdd ? "text-success" : "text-destructive"}`}>
                        {isAdd ? "+" : "-"}₪{Number(tx.amount).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {tx.type === "initial" ? "יתרת פתיחה" : isAdd ? "הוספה" : "מימוש"} ·{" "}
                        {new Date(tx.created_at).toLocaleString("he-IL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      → ₪{Number(tx.balance_after).toFixed(2)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
    const initialBalance = parseFloat(initial) || 0;
    const { data: newWallet, error } = await supabase
      .from("cibus_wallets")
      .insert({
        customer_name: name.trim(),
        phone_number: phone.trim(),
        balance: initialBalance,
        created_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      setBusy(false);
      toast.error(error.message.includes("unique") ? "כבר קיים ארנק עם טלפון זה" : "שגיאה ביצירה");
      return;
    }

    // Log the initial balance if non-zero
    if (newWallet?.id && initialBalance !== 0) {
      await supabase.from("cibus_transactions_log").insert({
        wallet_id: newWallet.id,
        amount: Math.abs(initialBalance),
        type: "initial",
        balance_after: initialBalance,
        note: "יתרת פתיחה",
        created_by: userId,
      });
    }

    setBusy(false);
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
          <Button onClick={submit} disabled={busy} className="flex-1 bg-amber-brand text-amber-brand-foreground hover:opacity-90 font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "צור ארנק"}
          </Button>
        </div>
      </div>
    </div>
  );
}
