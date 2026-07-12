import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench, Upload, Loader2, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { EquipmentType, MaintenanceTicket, Urgency } from "@/lib/maintenance-store";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: 'תחזוקה — Pizza X' },
      { name: "description", content: 'מעקב תקלות וטיפול בתחזוקת ציוד.' },
    
      { property: "og:title", content: 'תחזוקה — Pizza X' },
      { property: "og:description", content: 'מעקב תקלות וטיפול בתחזוקת ציוד.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/maintenance" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/maintenance" }],
  }),
  component: MaintenancePage,
});

const URGENCIES: Urgency[] = [
  "קריטי - משבית עבודה",
  "דחוף - מפריע לעבודה",
  "רגיל",
];

const URGENCY_BADGE: Record<Urgency, string> = {
  "קריטי - משבית עבודה": "bg-red-500/20 text-red-300 border-red-500/40",
  "דחוף - מפריע לעבודה": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "רגיל": "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

const STATUS_LABEL: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  resolved: "טופל",
};

function MaintenancePage() {
  const { session, assignedBranchId } = useAuth();
  const router = useRouter();
  const [equipment, setEquipment] = useState<EquipmentType[]>([]);
  const [tickets, setTickets] = useState<
    (MaintenanceTicket & { equipment_types: { name: string } | null })[]
  >([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [urgency, setUrgency] = useState<Urgency>("רגיל");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void supabase
      .from("equipment_types")
      .select("id, name")
      .order("name")
      .then(({ data }) => setEquipment((data ?? []) as EquipmentType[]));
  }, []);

  const refreshTickets = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("maintenance_tickets")
      .select("*, equipment_types(name)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setTickets((data ?? []) as never);
  };

  useEffect(() => {
    void refreshTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = session?.user?.id;
    if (!uid) {
      toast.error("אנא התחבר מחדש");
      return;
    }
    if (!equipmentId || !description.trim()) {
      toast.error("בחר ציוד והוסף תיאור");
      return;
    }
    setSubmitting(true);
    try {
      let photo_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${uid}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("ticket-attachments")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("ticket-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        photo_url = signed?.signedUrl ?? null;
      }
      const { error } = await supabase.from("maintenance_tickets").insert({
        user_id: uid,
        branch_id: assignedBranchId,
        equipment_type_id: equipmentId,
        urgency,
        description: description.trim(),
        photo_url,
      });
      if (error) throw error;
      toast.success("הקריאה נשלחה למנהל");
      setDescription("");
      setFile(null);
      setEquipmentId("");
      setUrgency("רגיל");
      await refreshTickets();
    } catch (err) {
      toast.error("שליחה נכשלה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <Wrench className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">פתיחת קריאת שירות</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-card/40 p-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1.5">ציוד</label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {equipment.map((eq) => {
              const active = equipmentId === eq.id;
              return (
                <button
                  type="button"
                  key={eq.id}
                  onClick={() => setEquipmentId(eq.id)}
                  className={
                    active
                      ? "rounded-full px-3 py-1.5 text-sm font-bold border-2 border-neon text-neon bg-neon/10 shrink-0 whitespace-nowrap transition"
                      : "rounded-full px-3 py-1.5 text-sm font-bold border border-border text-muted-foreground bg-card shrink-0 whitespace-nowrap hover:border-neon/50 transition"
                  }
                >
                  {eq.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">דחיפות</label>
          <div className="space-y-2">
            {URGENCIES.map((u) => {
              const active = urgency === u;
              const kind: "critical" | "urgent" | "normal" =
                u === "קריטי - משבית עבודה" ? "critical" : u === "דחוף - מפריע לעבודה" ? "urgent" : "normal";
              const accent =
                kind === "critical" ? "bg-red-500" : kind === "urgent" ? "bg-orange-500" : "bg-zinc-500";
              const desc =
                kind === "critical"
                  ? "משביתה את העבודה, דרוש טיפול מיידי"
                  : kind === "urgent"
                    ? "מפריעה לעבודה, יש לטפל בהקדם"
                    : "אינה דחופה, ניתן לתזמן טיפול";
              return (
                <button
                  type="button"
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-right transition ${
                    active ? "border-neon bg-neon/5" : "border-border bg-card/40 hover:border-border/80"
                  }`}
                >
                  <div className={`w-1 rounded-full h-full shrink-0 ${accent}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{u}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">תיאור התקלה</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background p-3 resize-none"
            placeholder="תאר את התקלה בקצרה..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">תמונה (אופציונלי)</label>
          <label className="flex items-center gap-2 h-11 rounded-lg border border-dashed border-border bg-background/50 px-3 cursor-pointer hover:border-neon/60 transition">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : "צרף תמונה..."}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-11 rounded-lg bg-neon text-primary-foreground font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            שלח קריאה
          </button>
          <button
            type="button"
            onClick={() => router.navigate({ to: "/" })}
            className="h-11 px-4 rounded-lg border border-border"
          >
            ביטול
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3">הקריאות שלי</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">לא נפתחו קריאות עדיין.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {t.equipment_types?.name ?? "ציוד"}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${URGENCY_BADGE[t.urgency]}`}
                    >
                      {t.urgency}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                {t.photo_url && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    <a
                      href={t.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      צפה בתמונה
                    </a>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(t.created_at).toLocaleString("he-IL")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
