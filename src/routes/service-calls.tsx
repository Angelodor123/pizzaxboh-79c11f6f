import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench, Check, Clock, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { MaintenanceTicket, TicketStatus, Urgency } from "@/lib/maintenance-store";

export const Route = createFileRoute("/service-calls")({
  head: () => ({
    meta: [
      { title: 'קריאות שירות — Pizza X' },
      { name: "description", content: 'ניהול קריאות שירות וטיפול בתקלות.' },
    
      { property: "og:title", content: 'קריאות שירות — Pizza X' },
      { property: "og:description", content: 'ניהול קריאות שירות וטיפול בתקלות.' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/service-calls" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/service-calls" }],
  }),
  component: AdminMaintenancePage,
});

type Row = MaintenanceTicket & {
  equipment_types: { name: string } | null;
  reporter_name: string | null;
};

const URGENCY_BADGE: Record<Urgency, string> = {
  "קריטי - משבית עבודה": "bg-red-500/20 text-red-300 border-red-500/40",
  "דחוף - מפריע לעבודה": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "רגיל": "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  resolved: "טופל",
};

function AdminMaintenancePage() {
  const { role, loading } = useAuth();
  const isManager = role === "admin";
  const [tickets, setTickets] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "open">("unread");

  const refresh = async () => {
    const { data } = await supabase
      .from("maintenance_tickets")
      .select("*, equipment_types(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data ?? []) as unknown as Row[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      names = Object.fromEntries(
        (profs ?? []).map((p) => [p.user_id as string, (p.full_name as string) ?? ""]),
      );
    }
    setTickets(rows.map((r) => ({ ...r, reporter_name: names[r.user_id] ?? null })));
  };

  useEffect(() => {
    if (!isManager) return;
    void refresh();
    const ch = supabase
      .channel("admin_tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_tickets" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [isManager]);

  if (loading) return null;
  if (!isManager) {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl">
        אין לך הרשאה לעמוד זה.
      </div>
    );
  }

  const filtered = tickets.filter((t) => {
    if (filter === "unread") return !t.is_read_by_admin;
    if (filter === "open") return t.status !== "resolved";
    return true;
  });

  const updateStatus = async (id: string, status: TicketStatus) => {
    const patch = {
      status,
      is_read_by_admin: true,
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase
      .from("maintenance_tickets")
      .update(patch)
      .eq("id", id);
    if (error) toast.error("עדכון נכשל");
    else toast.success("עודכן");
  };

  const markRead = async (id: string) => {
    await supabase
      .from("maintenance_tickets")
      .update({ is_read_by_admin: true })
      .eq("id", id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">קריאות שירות</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(["unread", "open", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-3 rounded-lg text-sm font-medium border transition ${
              filter === f
                ? "bg-neon text-primary-foreground border-neon"
                : "border-border hover:border-neon/60"
            }`}
          >
            {f === "unread" ? "לא נקראו" : f === "open" ? "פתוחות" : "הכל"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">אין קריאות.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border p-4 transition ${
                t.is_read_by_admin
                  ? "border-border bg-card/40"
                  : "border-neon/40 bg-card/60 shadow-[0_0_24px_-12px_rgba(255,20,147,0.6)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-lg">
                    {t.equipment_types?.name ?? "ציוד לא צוין"}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${URGENCY_BADGE[t.urgency]}`}
                  >
                    {t.urgency}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/40">
                    {STATUS_LABEL[t.status]}
                  </span>
                  {!t.is_read_by_admin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon/20 text-neon border border-neon/40">
                      חדש
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm whitespace-pre-wrap mb-2">{t.description}</p>

              {t.photo_url && (
                <a
                  href={t.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block mb-2"
                >
                  <img
                    src={t.photo_url}
                    alt="תקלה"
                    className="max-h-40 rounded-lg border border-border"
                  />
                </a>
              )}

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-3">
                <span>
                  {t.reporter_name ?? "—"} • {new Date(t.created_at).toLocaleString("he-IL")}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {!t.is_read_by_admin && (
                  <button
                    onClick={() => void markRead(t.id)}
                    className="h-8 px-3 rounded-md border border-border hover:border-neon/60 text-xs inline-flex items-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> סמן כנקרא
                  </button>
                )}
                {t.status !== "in_progress" && t.status !== "resolved" && (
                  <button
                    onClick={() => void updateStatus(t.id, "in_progress")}
                    className="h-8 px-3 rounded-md border border-orange-500/40 text-orange-300 hover:bg-orange-500/10 text-xs inline-flex items-center gap-1"
                  >
                    <Clock className="h-3.5 w-3.5" /> בטיפול
                  </button>
                )}
                {t.status !== "resolved" && (
                  <button
                    onClick={() => void updateStatus(t.id, "resolved")}
                    className="h-8 px-3 rounded-md border border-green-500/40 text-green-300 hover:bg-green-500/10 text-xs inline-flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" /> טופל
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
