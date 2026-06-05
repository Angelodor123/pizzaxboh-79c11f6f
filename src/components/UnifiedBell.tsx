import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Wrench, MessageSquareWarning, Inbox, CheckCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications-store";

type Item = {
  id: string;
  kind: "ticket" | "complaint" | "notification";
  title: string;
  subtitle?: string;
  href: string;
  createdAt: string;
  urgent?: boolean;
  read?: boolean;
  onRead?: () => void;
};

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

export function UnifiedBell() {
  const { session, isSuperAdmin, assignedBranchId } = useAuth();
  const userId = session?.user?.id ?? null;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { items: notifications, unreadCount: userUnread, markAllRead, markRead } =
    useNotifications(userId);

  const [adminTickets, setAdminTickets] = useState<
    Array<{ id: string; description: string; urgency: string; created_at: string }>
  >([]);
  const [adminComplaints, setAdminComplaints] = useState<
    Array<{ id: string; customer_name: string; description: string; created_at: string }>
  >([]);
  const [adminBadge, setAdminBadge] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin || !assignedBranchId) {
      setAdminBadge(0);
      setAdminTickets([]);
      setAdminComplaints([]);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const [{ data: tickets, count: tCount }, { data: complaints, count: cCount }] =
        await Promise.all([
          supabase
            .from("maintenance_tickets")
            .select("id, description, urgency, created_at", { count: "exact" })
            .neq("status", "resolved")
            .eq("is_read_by_admin", false)
            .eq("branch_id", assignedBranchId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("customer_complaints")
            .select("id, customer_name, description, created_at", { count: "exact" })
            .eq("status", "new")
            .eq("branch_id", assignedBranchId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
      if (cancelled) return;
      setAdminTickets((tickets ?? []) as typeof adminTickets);
      setAdminComplaints((complaints ?? []) as typeof adminComplaints);
      setAdminBadge((tCount ?? 0) + (cCount ?? 0));
    };
    void refresh();

    const channel = supabase
      .channel("unified-bell-" + assignedBranchId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_tickets", filter: `branch_id=eq.${assignedBranchId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_complaints", filter: `branch_id=eq.${assignedBranchId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, assignedBranchId]);

  if (!userId) return null;

  const items: Item[] = [
    ...adminTickets.map((t) => ({
      id: `t-${t.id}`,
      kind: "ticket" as const,
      title: "🛠️ קריאת שירות חדשה",
      subtitle: t.description || t.urgency,
      href: "/service-calls",
      createdAt: t.created_at,
      urgent: typeof t.urgency === "string" && t.urgency.startsWith("קריטי"),
    })),
    ...adminComplaints.map((c) => ({
      id: `c-${c.id}`,
      kind: "complaint" as const,
      title: "🔴 תלונה חדשה מלקוח",
      subtitle: `${c.customer_name} — ${c.description}`.slice(0, 80),
      href: "/complaints",
      createdAt: c.created_at,
      urgent: true,
    })),
    ...notifications.map((n) => ({
      id: `n-${n.id}`,
      kind: "notification" as const,
      title: n.title,
      subtitle: n.body ?? undefined,
      href: n.link ?? "/notifications",
      createdAt: n.created_at,
      read: !!n.read_at,
      onRead: n.read_at ? undefined : () => void markRead(n.id),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalBadge = adminBadge + userUnread;

  const go = (item: Item) => {
    item.onRead?.();
    setOpen(false);
    void navigate({ to: item.href });
  };

  const handleMarkAll = async () => {
    if (userUnread > 0) await markAllRead();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
          aria-label="התראות"
          title="התראות"
        >
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #ff1493, #ff66c4)",
                boxShadow: "0 0 8px rgba(255,20,147,0.9), 0 0 16px rgba(255,20,147,0.6)",
              }}
            >
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[340px] p-0 bg-card border border-border"
        dir="rtl"
      >
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <span className="font-display text-sm font-bold">התראות</span>
          <div className="flex items-center gap-2">
            {userUnread > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="inline-flex items-center gap-1 text-[11px] text-neon hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                סמן הכל
              </button>
            )}
            <Bell className="h-4 w-4 text-neon" />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין התראות חדשות</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon =
                  n.kind === "ticket"
                    ? Wrench
                    : n.kind === "complaint"
                      ? MessageSquareWarning
                      : Bell;
                const isUnread = n.kind === "notification" ? !n.read : true;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={`w-full text-right px-3 py-2.5 hover:bg-background/60 transition flex items-start gap-2.5 ${
                        isUnread && n.kind === "notification" ? "bg-neon/5" : ""
                      }`}
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
                            {relTime(n.createdAt)}
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
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/notifications" });
            }}
            className="text-[11px] font-bold text-neon hover:underline"
          >
            כל ההתראות
          </button>
          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/complaints" });
                }}
                className="text-[11px] font-bold text-muted-foreground hover:text-neon"
              >
                תלונות
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/service-calls" });
                }}
                className="text-[11px] font-bold text-muted-foreground hover:text-neon"
              >
                קריאות שירות
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
