// Internal team "Shift Updates" board, scoped to the active branch.
// Realtime sync via Supabase channels; integrates @mentions which trigger
// notifications (and push) for tagged users.

import { useEffect, useMemo, useState } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";
import { MentionInput } from "@/components/MentionInput";
import {
  createNotifications,
  extractMentionedUserIds,
  type MentionUser,
} from "@/lib/notifications-store";
import { useServerFn } from "@tanstack/react-start";
import { sendPushToUsers } from "@/lib/push-send.functions";
import { toast } from "sonner";

interface FeedRow {
  id: string;
  user_id: string;
  branch_id: string;
  message: string;
  mentions: string[];
  created_at: string;
  author_name?: string | null;
}

function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}
function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShiftFeedCard() {
  const { session, fullName, isSuperAdmin } = useAuth();
  const uid = session?.user?.id ?? null;
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const pushFn = useServerFn(sendPushToUsers);

  useEffect(() => subscribeBranch((b) => setBranchId(b)), []);

  // Load messages + author names.
  useEffect(() => {
    if (!branchId) return;
    let mounted = true;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("shift_feed" as never) as any)
        .select("*")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      const list = (data ?? []) as FeedRow[];
      setRows(list);
    };
    void load();

    const channel = supabase
      .channel(`shift_feed_${branchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_feed", filter: `branch_id=eq.${branchId}` },
        (p) => setRows((prev) => [p.new as FeedRow, ...prev].slice(0, 50)),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shift_feed", filter: `branch_id=eq.${branchId}` },
        (p) => setRows((prev) => prev.filter((r) => r.id !== (p.old as FeedRow).id)),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  // Resolve author display names from mention directory.
  useEffect(() => {
    if (!mentionUsers.length) return;
    const map: Record<string, string> = {};
    for (const u of mentionUsers) map[u.user_id] = u.full_name;
    setProfileNames(map);
  }, [mentionUsers]);

  const send = async () => {
    const text = message.trim();
    if (!text || !uid || !branchId || sending) return;
    setSending(true);
    try {
      const mentions = extractMentionedUserIds(text, mentionUsers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("shift_feed" as never) as any).insert({
        user_id: uid,
        branch_id: branchId,
        message: text,
        mentions,
      });
      if (error) throw error;
      setMessage("");
      // Notify tagged users (excluding self).
      const targets = mentions.filter((id) => id !== uid);
      if (targets.length) {
        const title = `${fullName ?? "מישהו"} תייג אותך בעדכוני משמרת`;
        await createNotifications(targets, {
          type: "mention",
          title,
          body: text.slice(0, 200),
          link: "/",
          data: { source: "shift_feed" },
        });
        try {
          await pushFn({ data: { userIds: targets, title, body: text.slice(0, 200) } });
        } catch (e) {
          console.warn("[push] mention push failed", e);
        }
      }
    } catch (e) {
      toast.error("שליחת הודעה נכשלה");
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shift_feed" as never) as any).delete().eq("id", id);
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)), [rows]);

  return (
    <div dir="rtl" className="rounded-xl border-2 border-jungle/30 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-5 w-5 text-neon" />
        <h2 className="font-display text-lg font-bold">עדכוני משמרת</h2>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1">
          <MentionInput
            value={message}
            onChange={setMessage}
            onMentionUsersChange={setMentionUsers}
            placeholder="כתוב עדכון לצוות… השתמש ב-@ לתיוג"
            multiline
            rows={2}
            disabled={!uid || !branchId}
            onSubmit={() => void send()}
          />
        </div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!message.trim() || sending}
          className="inline-flex items-center gap-1 rounded-lg bg-neon text-primary-foreground font-bold px-4 py-2 text-sm glow-neon hover:brightness-110 transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "שולח…" : "שלח"}
        </button>
      </div>

      <ul className="space-y-2 max-h-72 overflow-auto pr-1">
        {sorted.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-6">
            עדיין אין עדכונים. תהיה הראשון!
          </li>
        )}
        {sorted.map((r) => {
          const name = profileNames[r.user_id] ?? (r.user_id === uid ? fullName : null);
          const canDelete = r.user_id === uid || isSuperAdmin;
          return (
            <li key={r.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-neon/15 text-neon text-xs font-bold flex items-center justify-center">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground truncate">
                      {name ?? "משתמש"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{relTime(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
                    {r.message}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    aria-label="מחק"
                    className="text-muted-foreground hover:text-red-500 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
