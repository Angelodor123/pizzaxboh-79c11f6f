import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ComplaintStatus = "new" | "in_progress" | "resolved";

export interface Complaint {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  customer_name: string;
  phone_number: string;
  address: string | null;
  description: string;
  status: ComplaintStatus;
  manager_notes: string | null;
  compensation_notes: string | null;
  order_date: string | null;
  order_number: string | null;
}

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  new: "חדש",
  in_progress: "בטיפול",
  resolved: "טופל",
};

/** Subscribe to all complaints (super admin only) with realtime updates. */
export function useComplaints() {
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("customer_complaints")
        .select("*")
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (!error && data) setItems(data as Complaint[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`complaints-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_complaints" },
        () => load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [isSuperAdmin]);

  return { items, loading };
}

/** Count of 'new' complaints — for badge in drawer (super admin only). */
export function useNewComplaintCount() {
  const { isSuperAdmin } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("customer_complaints")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (alive) setCount(c ?? 0);
    };
    load();
    const ch = supabase
      .channel("complaints-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_complaints" },
        () => load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [isSuperAdmin]);

  return count;
}
