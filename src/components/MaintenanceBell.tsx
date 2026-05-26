import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Wrench, AlertTriangle, Inbox } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUnreadTicketCount } from "@/lib/maintenance-store";

type NotificationItem = {
  id: string;
  kind: "ticket" | "shortage";
  title: string;
  subtitle?: string;
  href: string;
  createdAt: string;
  urgent?: boolean;
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "כעת";
  if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.round(h / 24);
  return `לפני ${d} ימים`;
}

export function MaintenanceBell() {
  const { role } = useAuth();
  const isManager = role === "admin";
  const ticketBadge = useUnreadTicketCount(isManager);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isManager || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: tickets }, { data: shortages }] = await Promise.all([
        supabase
          .from("maintenance_tickets")
          .select("id, description, urgency, created_at, status")
          .neq("status", "resolved")
          .eq("is_read_by_admin", false)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notebook_items")
          .select("id, text, created_at, is_urgent")
          .eq("list_key", "shortages")
          .eq("done", false)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      const merged: NotificationItem[] = [
        ...((tickets ?? []) as Array<{ id: string; description: string; urgency: string; created_at: string }>).map(
          (t) => ({
            id: `t-${t.id}`,
            kind: "ticket" as const,
            title: t.description || "קריאת שירות חדשה",
            subtitle: t.urgency,
            href: "/service-calls",
            createdAt: t.created_at,
            urgent: typeof t.urgency === "string" && t.urgency.startsWith("קריטי"),
          }),
        ),
        ...((shortages ?? []) as Array<{ id: string; text: string; created_at: string; is_urgent: boolean }>).map(
          (s) => ({
            id: `s-${s.id}`,
            kind: "shortage" as const,
            title: s.text,
            subtitle: "חוסר במלאי",
            href: "/notebook",
            createdAt: s.created_at,
            urgent: !!s.is_urgent,
          }),
        ),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isManager, open]);

  if (!isManager) return null;

  const badge = ticketBadge + items.filter((i) => i.kind === "shortage").length;

  const go = (href: string) => {
    setOpen(false);
    void navigate({ to: href });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
          aria-label="התראות מערכת"
          title="התראות"
        >
          <Bell className="h-4 w-4" />
          {(ticketBadge > 0 || badge > 0) && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #ff1493, #ff66c4)",
                boxShadow: "0 0 8px rgba(255,20,147,0.9), 0 0 16px rgba(255,20,147,0.6)",
              }}
            >
              {(ticketBadge || badge) > 99 ? "99+" : ticketBadge || badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[320px] p-0 bg-card border border-border"
        dir="rtl"
      >
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <span className="font-display text-sm font-bold">התראות מערכת</span>
          <Bell className="h-4 w-4 text-neon" />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">טוען…</div>
          )}

          {!loading && items.length === 0 && (
            <div className="px-3 py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין התראות חדשות</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = n.kind === "ticket" ? Wrench : AlertTriangle;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n.href)}
                      className="w-full text-right px-3 py-2.5 hover:bg-background/60 transition flex items-start gap-2.5"
                    >
                      <span
                        className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                          n.urgent
                            ? "bg-destructive/15 text-destructive"
                            : "bg-neon/10 text-neon"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{n.title}</span>
                        <span className="flex items-center justify-between gap-2 mt-0.5">
                          {n.subtitle && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              {n.subtitle}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelative(n.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => go("/service-calls")}
            className="text-[11px] font-bold text-neon hover:underline"
          >
            כל קריאות השירות
          </button>
          <button
            type="button"
            onClick={() => go("/notebook")}
            className="text-[11px] font-bold text-neon hover:underline"
          >
            פנקס וחוסרים
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
