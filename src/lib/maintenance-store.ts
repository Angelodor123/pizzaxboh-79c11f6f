import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Urgency = "קריטי - משבית עבודה" | "דחוף - מפריע לעבודה" | "רגיל";
export type TicketStatus = "open" | "in_progress" | "resolved";

export interface MaintenanceTicket {
  id: string;
  created_at: string;
  user_id: string;
  equipment_type_id: string | null;
  urgency: Urgency;
  description: string;
  photo_url: string | null;
  status: TicketStatus;
  is_read_by_admin: boolean;
}

export interface EquipmentType {
  id: string;
  name: string;
}

/** Live count of unread open tickets, refreshed via realtime. */
export function useUnreadTicketCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      const { count: c } = await supabase
        .from("maintenance_tickets")
        .select("id", { count: "exact", head: true })
        .eq("is_read_by_admin", false)
        .neq("status", "resolved");
      if (!cancelled) setCount(c ?? 0);
    };

    void refresh();

    const ch = supabase
      .channel("maintenance_tickets_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_tickets" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [enabled]);

  return count;
}

/** Live list of critical/urgent unread tickets for the interceptor modal. */
export function useUrgentUnreadTickets(enabled: boolean) {
  const [tickets, setTickets] = useState<
    (MaintenanceTicket & { equipment_name: string | null; reporter_name: string | null })[]
  >([]);

  useEffect(() => {
    if (!enabled) {
      setTickets([]);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase
        .from("maintenance_tickets")
        .select("*, equipment_types(name)")
        .eq("is_read_by_admin", false)
        .neq("status", "resolved")
        .in("urgency", ["קריטי - משבית עבודה", "דחוף - מפריע לעבודה"])
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as unknown as Array<
        MaintenanceTicket & { equipment_types: { name: string } | null }
      >;
      // fetch reporter names
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
      setTickets(
        rows.map((r) => ({
          ...r,
          equipment_name: r.equipment_types?.name ?? null,
          reporter_name: names[r.user_id] ?? null,
        })),
      );
    };

    void refresh();

    const ch = supabase
      .channel("maintenance_tickets_urgent")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_tickets" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [enabled]);

  return tickets;
}

export async function markTicketRead(id: string) {
  await supabase
    .from("maintenance_tickets")
    .update({ is_read_by_admin: true })
    .eq("id", id);
}
