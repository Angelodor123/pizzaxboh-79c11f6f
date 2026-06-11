// Internal team "Shift Updates" board, scoped to the active branch.
// Realtime sync via Supabase channels; integrates @mentions which trigger
// notifications (and push) for tagged users — including group tags.
// Now with emoji reactions and threaded comments.

import { useEffect, useMemo, useState, useCallback } from "react";
import { Send, Trash2, MessageSquare, MessageCircle, SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";
import { MentionInput } from "@/components/MentionInput";
import {
  createNotifications,
  extractMentionedUserIds,
  type MentionUser,
} from "@/lib/notifications-store";
import { fetchGroupUserIds, GROUP_TAGS } from "@/lib/employee-directory";
import { FeedText } from "@/components/FeedText";
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
}
interface ReactionRow {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
}
interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  message: string;
  mentions: string[];
  created_at: string;
}

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "✅", "🙏"];

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
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [openEmojiFor, setOpenEmojiFor] = useState<string | null>(null);
  const pushFn = useServerFn(sendPushToUsers);

  useEffect(() => subscribeBranch((b) => setBranchId(b)), []);

  // Load feed + reactions + comments and subscribe to realtime
  useEffect(() => {
    if (!branchId) return;
    let mounted = true;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: feed } = await (supabase.from("shift_feed" as never) as any)
        .select("*")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      const list = (feed ?? []) as FeedRow[];
      setRows(list);
      const ids = list.map((r) => r.id);
      if (ids.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: rxs }, { data: cms }] = await Promise.all([
          (supabase.from("shift_feed_reactions" as never) as any).select("*").in("post_id", ids),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("shift_feed_comments" as never) as any)
            .select("*")
            .in("post_id", ids)
            .order("created_at", { ascending: true }),
        ]);
        if (!mounted) return;
        setReactions((rxs ?? []) as ReactionRow[]);
        setComments((cms ?? []) as CommentRow[]);
      } else {
        setReactions([]);
        setComments([]);
      }
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_feed_reactions" },
        (p) => setReactions((prev) => [...prev, p.new as ReactionRow]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shift_feed_reactions" },
        (p) => setReactions((prev) => prev.filter((r) => r.id !== (p.old as ReactionRow).id)),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_feed_comments" },
        (p) => setComments((prev) => [...prev, p.new as CommentRow]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shift_feed_comments" },
        (p) => setComments((prev) => prev.filter((r) => r.id !== (p.old as CommentRow).id)),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

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
      const directIds = extractMentionedUserIds(text, mentionUsers);
      const groupKeys = GROUP_TAGS.filter((g) =>
        new RegExp(`@${g.tag}(?![\\u0590-\\u05FFa-zA-Z0-9])`).test(text),
      ).map((g) => g.key);
      const groupExpansions = await Promise.all(groupKeys.map((k) => fetchGroupUserIds(k)));
      const allMentioned = new Set<string>([...directIds, ...groupExpansions.flat()]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("shift_feed" as never) as any).insert({
        user_id: uid,
        branch_id: branchId,
        message: text,
        mentions: Array.from(allMentioned),
      });
      if (error) throw error;
      setMessage("");

      const targets = Array.from(allMentioned);
      if (targets.length) {
        const title = `${fullName ?? "מישהו"} תייג אותך בעדכוני משמרת`;
        await createNotifications(targets, {
          type: "mention",
          title,
          body: text.slice(0, 200),
          link: "/",
          data: { source: "shift_feed", groups: groupKeys },
        });
        const pushTargets = targets.filter((id) => id !== uid);
        if (pushTargets.length) {
          try {
            await pushFn({ data: { userIds: pushTargets, title, body: text.slice(0, 200) } });
          } catch (e) {
            console.warn("[push] mention push failed", e);
          }
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

  const toggleReaction = useCallback(
    async (postId: string, emoji: string) => {
      if (!uid) return;
      const mine = reactions.find(
        (r) => r.post_id === postId && r.user_id === uid && r.emoji === emoji,
      );
      if (mine) {
        setReactions((prev) => prev.filter((r) => r.id !== mine.id));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("shift_feed_reactions" as never) as any).delete().eq("id", mine.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("shift_feed_reactions" as never) as any)
          .insert({ post_id: postId, user_id: uid, emoji })
          .select()
          .single();
        if (!error && data) {
          setReactions((prev) =>
            prev.some((r) => r.id === (data as ReactionRow).id)
              ? prev
              : [...prev, data as ReactionRow],
          );
        }
      }
      setOpenEmojiFor(null);
    },
    [reactions, uid],
  );

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
            placeholder="כתוב עדכון לצוות… השתמש ב-@ לתיוג (גם @כולם / @מטבח / @דלפק / @שליחים / @מנהלים)"
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

      <ul className="space-y-2 max-h-[32rem] overflow-auto pr-1">
        {sorted.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-6">
            עדיין אין עדכונים. תהיה הראשון!
          </li>
        )}
        {sorted.map((r) => {
          const name = profileNames[r.user_id] ?? (r.user_id === uid ? fullName : null);
          const canDelete = r.user_id === uid || isSuperAdmin;
          const postReactions = reactions.filter((x) => x.post_id === r.id);
          const postComments = comments.filter((x) => x.post_id === r.id);
          const grouped = postReactions.reduce<Record<string, ReactionRow[]>>((acc, rx) => {
            (acc[rx.emoji] ||= []).push(rx);
            return acc;
          }, {});
          const isOpen = !!openComments[r.id];
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
                  <p className="text-sm text-foreground/90 mt-1">
                    <FeedText text={r.message} users={mentionUsers} />
                  </p>

                  {/* Reactions row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {Object.entries(grouped).map(([emoji, list]) => {
                      const mine = !!uid && list.some((x) => x.user_id === uid);
                      const names = list
                        .map((x) => profileNames[x.user_id] ?? (x.user_id === uid ? fullName : "משתמש"))
                        .join(", ");
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void toggleReaction(r.id, emoji)}
                          title={names}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                            mine
                              ? "border-neon/70 bg-neon/15 text-foreground"
                              : "border-border bg-background/50 text-muted-foreground hover:border-neon/40"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold">{list.length}</span>
                        </button>
                      );
                    })}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenEmojiFor((cur) => (cur === r.id ? null : r.id))}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-neon/50 hover:text-foreground transition"
                        aria-label="הוסף ריאקציה"
                      >
                        <SmilePlus className="h-3 w-3" />
                      </button>
                      {openEmojiFor === r.id && (
                        <div className="absolute z-10 top-full mt-1 right-0 flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
                          {QUICK_EMOJIS.map((e) => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => void toggleReaction(r.id, e)}
                              className="h-7 w-7 rounded hover:bg-muted text-base leading-none"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenComments((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-neon/40 hover:text-foreground transition"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span>{postComments.length || "תגובה"}</span>
                    </button>
                  </div>

                  {/* Comments thread */}
                  {isOpen && (
                    <CommentsThread
                      postId={r.id}
                      postAuthorId={r.user_id}
                      comments={postComments}
                      profileNames={profileNames}
                      uid={uid}
                      fullName={fullName}
                      isSuperAdmin={isSuperAdmin}
                      pushFn={pushFn}
                    />
                  )}
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

function CommentsThread({
  postId,
  postAuthorId,
  comments,
  profileNames,
  uid,
  fullName,
  isSuperAdmin,
  pushFn,
}: {
  postId: string;
  postAuthorId: string;
  comments: CommentRow[];
  profileNames: Record<string, string>;
  uid: string | null;
  fullName: string | null | undefined;
  isSuperAdmin: boolean;
  pushFn: (args: { data: { userIds: string[]; title: string; body?: string } }) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [mu, setMu] = useState<MentionUser[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (!t || !uid || busy) return;
    setBusy(true);
    try {
      const directIds = extractMentionedUserIds(t, mu);
      const groupKeys = GROUP_TAGS.filter((g) =>
        new RegExp(`@${g.tag}(?![\\u0590-\\u05FFa-zA-Z0-9])`).test(t),
      ).map((g) => g.key);
      const groupExpansions = await Promise.all(groupKeys.map((k) => fetchGroupUserIds(k)));
      const mentioned = new Set<string>([...directIds, ...groupExpansions.flat()]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("shift_feed_comments" as never) as any).insert({
        post_id: postId,
        user_id: uid,
        message: t,
        mentions: Array.from(mentioned),
      });
      if (error) throw error;
      setText("");

      // Notify post author + mentioned (de-dup, exclude self for push)
      const targets = new Set<string>(mentioned);
      if (postAuthorId && postAuthorId !== uid) targets.add(postAuthorId);
      const ids = Array.from(targets);
      if (ids.length) {
        const title =
          postAuthorId === uid
            ? `${fullName ?? "מישהו"} הגיב בעדכוני משמרת`
            : `${fullName ?? "מישהו"} הגיב לעדכון שלך`;
        await createNotifications(ids, {
          type: "comment",
          title,
          body: t.slice(0, 200),
          link: "/",
          data: { source: "shift_feed_comment", post_id: postId },
        });
        const pushTargets = ids.filter((id) => id !== uid);
        if (pushTargets.length) {
          try {
            await pushFn({ data: { userIds: pushTargets, title, body: t.slice(0, 200) } });
          } catch (e) {
            console.warn("[push] comment push failed", e);
          }
        }
      }
    } catch (e) {
      toast.error("שליחת התגובה נכשלה");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const removeC = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shift_feed_comments" as never) as any).delete().eq("id", id);
  };

  return (
    <div className="mt-3 border-t border-border/50 pt-2 space-y-2">
      {comments.length === 0 && (
        <p className="text-[11px] text-muted-foreground">אין תגובות עדיין. תהיה הראשון להגיב.</p>
      )}
      {comments.map((c) => {
        const cName = profileNames[c.user_id] ?? (c.user_id === uid ? fullName : null);
        const canDel = c.user_id === uid || isSuperAdmin;
        return (
          <div key={c.id} className="flex items-start gap-2 group">
            <div className="h-6 w-6 shrink-0 rounded-full bg-neon/10 text-neon text-[10px] font-bold flex items-center justify-center">
              {initials(cName)}
            </div>
            <div className="flex-1 min-w-0 rounded-md bg-background/60 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold truncate">{cName ?? "משתמש"}</span>
                <span className="text-[10px] text-muted-foreground">{relTime(c.created_at)}</span>
              </div>
              <p className="text-[13px] text-foreground/90 mt-0.5">
                <FeedText text={c.message} users={mu} />
              </p>
            </div>
            {canDel && (
              <button
                type="button"
                onClick={() => void removeC(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition"
                aria-label="מחק תגובה"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}

      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1">
          <MentionInput
            value={text}
            onChange={setText}
            onMentionUsersChange={setMu}
            placeholder="כתוב תגובה… @ לתיוג"
            multiline
            rows={1}
            disabled={!uid}
            onSubmit={() => void submit()}
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!text.trim() || busy}
          className="inline-flex items-center gap-1 rounded-md bg-neon/90 text-primary-foreground font-bold px-3 py-1.5 text-xs hover:brightness-110 transition disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {busy ? "…" : "שלח"}
        </button>
      </div>
    </div>
  );
}
