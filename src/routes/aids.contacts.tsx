import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Phone,
  Plus,
  Pencil,
  Trash2,
  PhoneCall,
  User,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/aids/contacts")({
  head: () => ({ meta: [{ title: "אנשי קשר — עזרים" }, { name: "description", content: "ספרייה של אנשי קשר חיצוניים לסניף Pizza X." }, { property: "og:title", content: "אנשי קשר — עזרים" }, { property: "og:description", content: "ספרייה של אנשי קשר חיצוניים לסניף Pizza X." }, { property: "og:url", content: "https://pizzaxboh.lovable.app/aids/contacts" }, { property: "og:type", content: "website" }], links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/aids/contacts" }] }),
  component: AidsContactsPage,
});

type Contact = {
  id: string;
  role: string;
  name: string;
  phone: string;
  sort_order: number;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase.from("emergency_contacts" as never) as any);

function AidsContactsPage() {
  const { role, isSuperAdmin } = useAuth();
  const canManage = isSuperAdmin || role === "admin";

  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await table()
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("טעינת אנשי הקשר נכשלה");
    } else {
      setItems((data ?? []) as Contact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (c: Contact) => {
    const ok = await confirmDelete({
      title: "מחיקת איש קשר",
      itemName: c.name,
    });
    if (!ok) return;
    const { error } = await table().delete().eq("id", c.id);
    if (error) {
      toast.error("מחיקה נכשלה");
    } else {
      toast.success("נמחק");
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
          {canManage && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neon text-primary-foreground font-bold px-3 py-1.5 text-xs glow-neon hover:brightness-110 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף איש קשר
            </button>
          )}
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-violet-500/15 text-violet-300">
              <Phone className="h-5 w-5" />
            </span>
            אנשי קשר
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ספקים, טכנאים ובעלי תפקיד — לחיצה על מספר תפתח חיוג ישיר.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-8 text-center">
            <User className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-bold text-foreground">אין עדיין אנשי קשר</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {canManage
                ? "לחץ על 'הוסף איש קשר' כדי להתחיל."
                : "מנהל המערכת טרם הוסיף אנשי קשר."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border bg-card/60 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    {c.role}
                  </div>
                  <div className="font-bold text-foreground truncate">{c.name}</div>
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1.5 mt-1 text-sm text-neon font-bold hover:underline"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    {c.phone}
                  </a>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="p-2 rounded-md hover:bg-zinc-800/60 text-muted-foreground hover:text-foreground"
                      aria-label="ערוך"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="p-2 rounded-md hover:bg-red-500/15 text-muted-foreground hover:text-red-400"
                      aria-label="מחק"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <ContactFormModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ContactFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState(initial?.role ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim() || !name.trim() || !phone.trim()) {
      toast.error("חובה למלא תפקיד, שם וטלפון");
      return;
    }
    setBusy(true);
    const payload = { role: role.trim(), name: name.trim(), phone: phone.trim() };
    const op = initial
      ? table().update(payload).eq("id", initial.id)
      : table().insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) {
      toast.error("שמירה נכשלה");
      return;
    }
    toast.success(initial ? "עודכן" : "נוסף");
    onSaved();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg">
            {initial ? "עריכת איש קשר" : "איש קשר חדש"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800/60 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="תפקיד" value={role} onChange={setRole} placeholder="לדוגמה: טכנאי תנורים" />
          <Field label="שם" value={name} onChange={setName} placeholder="שם מלא" />
          <Field
            label="טלפון"
            value={phone}
            onChange={setPhone}
            placeholder="050-0000000"
            type="tel"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-primary-foreground font-bold py-2.5 glow-neon hover:brightness-110 transition disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
      />
    </label>
  );
}
