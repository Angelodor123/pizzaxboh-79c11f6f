// Realtime notifications store + helpers.
// Subscribes per-user, exposes list + unread count, and fires toast/native push
// when a new row arrives.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notify as nativeNotify } from "@/lib/notifications";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(userId: string | null | undefined) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications" as never)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as unknown as AppNotification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications_rt_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as unknown as AppNotification;
          setItems((prev) => [n, ...prev].slice(0, 50));
          toast(n.title, { description: n.body ?? undefined });
          void nativeNotify(n.title, { body: n.body ?? undefined, tag: n.id });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as unknown as AppNotification;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notifications" as never) as any)
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  }, [userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("notifications" as never) as any)
        .update({ read_at: now })
        .eq("id", id);
    },
    [userId],
  );

  return { items, unreadCount, loading, markAllRead, markRead, refresh: load };
}

/** Inserts notification rows for the given user_ids. */
export async function createNotifications(
  userIds: string[],
  payload: { type?: string; title: string; body?: string; link?: string; data?: Record<string, unknown> },
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  const rows = unique.map((uid) => ({
    user_id: uid,
    type: payload.type ?? "info",
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    data: payload.data ?? {},
  }));
  await supabase.from("notifications" as never).insert(rows as never);
}

/** Parses @[name](user_id) tokens AND plain @name tokens given a name→id map. */
export interface MentionUser {
  user_id: string;
  full_name: string;
}

export function extractMentionedUserIds(text: string, users: MentionUser[]): string[] {
  const ids = new Set<string>();
  // explicit format @[Name](uuid)
  const re1 = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text))) ids.add(m[2]);
  // fallback: @Name (match longest first)
  const sorted = [...users].sort((a, b) => b.full_name.length - a.full_name.length);
  for (const u of sorted) {
    const escaped = u.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@${escaped}(?![\\u0590-\\u05FFa-zA-Z0-9])`, "g");
    if (re.test(text)) ids.add(u.user_id);
  }
  return Array.from(ids);
}
