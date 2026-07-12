// Internal team "Shift Updates" board, scoped to the active branch.
// Realtime sync via Supabase channels; integrates @mentions which trigger
// notifications (and push) for tagged users — including group tags.
// Features: reactions, threaded comments, pinning, edit-within-15min, categories,
// seen-by tracking, image attachments, search, and AI daily summary.

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Send,
  Trash2,
  MessageSquare,
  MessageCircle,
  SmilePlus,
  Pin,
  PinOff,
  Pencil,
  X,
  Image as ImageIcon,
  Search,
  Sparkles,
  Eye,
  Check,
} from "lucide-react";
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
import { summarizeShiftFeedToday } from "@/lib/shift-feed-summary.functions";
import { toast } from "sonner";

type Category = "general" | "urgent" | "shift" | "fix" | "celebration";

interface FeedRow {
  id: string;
  user_id: string;
  branch_id: string;
  message: string;
  mentions: string[];
  created_at: string;
  category?: Category;
  pinned_at?: string | null;
  pinned_by?: string | null;
  edited_at?: string | null;
  image_url?: string | null;
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
interface ReadRow {
  post_id: string;
  user_id: string;
}

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "✅", "🙏"];

const CATEGORIES: Record<Category, { label: string; emoji: string; ring: string; chip: string }> = {
  general: { label: "כללי", emoji: "💬", ring: "border-r-border", chip: "bg-muted text-muted-foreground" },
  urgent: { label: "דחוף", emoji: "🚨", ring: "border-r-red-500", chip: "bg-red-500/15 text-red-400" },
  shift: { label: "משמרת", emoji: "🕒", ring: "border-r-neon", chip: "bg-neon/15 text-neon" },
  fix: { label: "תיקון", emoji: "🛠", ring: "border-r-amber-500", chip: "bg-amber-500/15 text-amber-400" },
  celebration: { label: "חגיגה", emoji: "🎉", ring: "border-r-fuchsia-500", chip: "bg-fuchsia-500/15 text-fuchsia-400" },
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
  const { session, fullName, isSuperAdmin, role } = useAuth();
  const uid = session?.user?.id ?? null;
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [reads, setReads] = useState<ReadRow[]>([]);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [sending, setSending] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [openEmojiFor, setOpenEmojiFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [search, setSearch] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [seenByOpen, setSeenByOpen] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const markedReadRef = useRef<Set<string>>(new Set());
  const pushFn = useServerFn(sendPushToUsers);
  const summarizeFn = useServerFn(summarizeShiftFeedToday);

  useEffect(() => subscribeBranch((b) => setBranchId(b)), []);

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
        const [{ data: rxs }, { data: cms }, { data: rds }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("shift_feed_reactions" as never) as any).select("*").in("post_id", ids),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("shift_feed_comments" as never) as any)
            .select("*")
            .in("post_id", ids)
            .order("created_at", { ascending: true }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("shift_feed_reads" as never) as any).select("post_id,user_id").in("post_id", ids),
        ]);
        if (!mounted) return;
        setReactions((rxs ?? []) as ReactionRow[]);
        setComments((cms ?? []) as CommentRow[]);
        setReads((rds ?? []) as ReadRow[]);
      } else {
        setReactions([]);
        setComments([]);
        setReads([]);
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
        { event: "UPDATE", schema: "public", table: "shift_feed", filter: `branch_id=eq.${branchId}` },
        (p) =>
          setRows((prev) =>
            prev.map((r) => (r.id === (p.new as FeedRow).id ? (p.new as FeedRow) : r)),
          ),
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_feed_reads" },
        (p) => setReads((prev) => [...prev, p.new as ReadRow]),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  useEffect(() => {
    if (!mentionUsers.length) return;
    setProfileNames((prev) => {
      const map = { ...prev };
      for (const u of mentionUsers) map[u.user_id] = u.full_name;
      return map;
    });
  }, [mentionUsers]);

  // Auto mark-as-read for posts that aren't authored by current user
  useEffect(() => {
    if (!uid || !rows.length) return;
    const toMark = rows
      .filter((r) => r.user_id !== uid && !markedReadRef.current.has(r.id))
      .filter((r) => !reads.some((x) => x.post_id === r.id && x.user_id === uid));
    if (!toMark.length) return;
    toMark.forEach((r) => markedReadRef.current.add(r.id));
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("shift_feed_reads" as never) as any).upsert(
        toMark.map((r) => ({ post_id: r.id, user_id: uid })),
        { onConflict: "post_id,user_id", ignoreDuplicates: true },
      );
    })();
  }, [rows, reads, uid]);

  const onPickImage = (f: File | null) => {
    setPendingImage(f);
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImagePreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!uid) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("shift-feed").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      toast.error("העלאת התמונה נכשלה");
      return null;
    }
    const { data: signed } = await supabase.storage
      .from("shift-feed")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? null;
  };

  const send = async () => {
    const text = message.trim();
    if ((!text && !pendingImage) || !uid || !branchId || sending) return;
    setSending(true);
    try {
      const directIds = extractMentionedUserIds(text, mentionUsers);
      const groupKeys = GROUP_TAGS.filter((g) =>
        new RegExp(`@${g.tag}(?![\\u0590-\\u05FFa-zA-Z0-9])`).test(text),
      ).map((g) => g.key);
      const groupExpansions = await Promise.all(groupKeys.map((k) => fetchGroupUserIds(k)));
      const allMentioned = new Set<string>([...directIds, ...groupExpansions.flat()]);

      let image_url: string | null = null;
      if (pendingImage) image_url = await uploadImage(pendingImage);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("shift_feed" as never) as any).insert({
        user_id: uid,
        branch_id: branchId,
        message: text,
        mentions: Array.from(allMentioned),
        category,
        image_url,
      });
      if (error) throw error;
      setMessage("");
      setCategory("general");
      onPickImage(null);

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
          }
        }
      }
    } catch (e) {
      toast.error("שליחת הודעה נכשלה");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shift_feed" as never) as any).delete().eq("id", id);
  };

  const togglePin = async (r: FeedRow) => {
    if (!isSuperAdmin || !uid) return;
    const next = r.pinned_at ? null : new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shift_feed" as never) as any)
      .update({ pinned_at: next, pinned_by: next ? uid : null })
      .eq("id", r.id);
    if (error) toast.error("ההצמדה נכשלה");
  };

  const startEdit = (r: FeedRow) => {
    setEditingId(r.id);
    setEditText(r.message);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };
  const saveEdit = async (r: FeedRow) => {
    const t = editText.trim();
    if (!t) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shift_feed" as never) as any)
      .update({ message: t, edited_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error("עדכון נכשל");
    else cancelEdit();
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

  const runSummary = async () => {
    if (!branchId) return;
    setSummaryLoading(true);
    try {
      const res = await summarizeFn({ data: { branchId } });
      setSummary(res.summary);
    } catch (e) {
      toast.error("סיכום AI נכשל");
    } finally {
      setSummaryLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.message.toLowerCase().includes(q)) : rows;
    return [...list].sort((a, b) => {
      const ap = a.pinned_at ? 1 : 0;
      const bp = b.pinned_at ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [rows, search]);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return rows.filter((r) => new Date(r.created_at) >= start).length;
  }, [rows]);

  const unreadCount = useMemo(() => {
    if (!uid) return 0;
    return rows.filter(
      (r) =>
        r.user_id !== uid &&
        !reads.some((x) => x.post_id === r.id && x.user_id === uid),
    ).length;
  }, [rows, reads, uid]);

  return (
    <div dir="rtl" className="rounded-xl border-2 border-jungle/30 bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-neon" />
          <h2 className="font-display text-lg font-bold">עדכוני משמרת</h2>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-neon text-primary-foreground px-2 py-0.5 rounded-full font-bold glow-neon">
              {unreadCount}
            </span>
          )}
          {todayCount > 0 && (
            <span className="text-[10px] bg-neon/15 text-neon px-2 py-0.5 rounded-full font-bold">
              {todayCount} היום
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void runSummary()}
          disabled={summaryLoading || !branchId}
          className="inline-flex items-center gap-1 text-xs rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-1 hover:bg-fuchsia-500/20 transition disabled:opacity-50"
          title="סיכום AI ליום"
        >
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          {summaryLoading ? "מסכם…" : "סיכום AI"}
        </button>
      </div>

      {summary && (
        <div className="mb-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-sm whitespace-pre-line">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-fuchsia-400 inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> סיכום של היום
            </span>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="סגור"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-foreground/90">{summary}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש בפיד…"
          className="w-full bg-background/40 border border-border rounded-lg pr-8 pl-3 py-1.5 text-sm focus:border-neon/60 outline-none"
        />
      </div>

      {/* Composer */}
      <div className="space-y-2 mb-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <MentionInput
              value={message}
              onChange={setMessage}
              onMentionUsersChange={setMentionUsers}
              placeholder="כתוב עדכון לצוות… @ לתיוג (גם @כולם / @מטבח / @דלפק / @שליחים / @מנהלים)"
              multiline
              rows={2}
              disabled={!uid || !branchId}
              onSubmit={() => void send()}
            />
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={(!message.trim() && !pendingImage) || sending}
            className="inline-flex items-center gap-1 rounded-lg bg-neon text-primary-foreground font-bold px-4 py-2 text-sm glow-neon hover:brightness-110 transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "שולח…" : "שלח"}
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(CATEGORIES) as Category[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setCategory(k)}
              className={`text-[11px] rounded-full px-2 py-0.5 border transition ${
                category === k
                  ? "border-neon/70 bg-neon/15 text-foreground font-bold"
                  : "border-border text-muted-foreground hover:border-neon/40"
              }`}
            >
              {CATEGORIES[k].emoji} {CATEGORIES[k].label}
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-dashed border-border text-muted-foreground hover:border-neon/40 hover:text-foreground transition"
          >
            <ImageIcon className="h-3 w-3" /> תמונה
          </button>
          {pendingImagePreview && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-muted/40 rounded-full pr-1 pl-2 py-0.5">
              <img src={pendingImagePreview} alt="" className="h-5 w-5 rounded object-cover" />
              <button
                type="button"
                onClick={() => onPickImage(null)}
                className="text-muted-foreground hover:text-red-500"
                aria-label="הסר תמונה"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-2 max-h-[34rem] overflow-auto pr-1">
        {filtered.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-6">
            {search ? "לא נמצאו עדכונים תואמים." : "עדיין אין עדכונים. תהיה הראשון!"}
          </li>
        )}
        {filtered.map((r) => {
          const cat = (r.category ?? "general") as Category;
          const meta = CATEGORIES[cat] ?? CATEGORIES.general;
          const name = profileNames[r.user_id] ?? (r.user_id === uid ? fullName : null);
          const isOwner = r.user_id === uid;
          const canDelete = isOwner || isSuperAdmin;
          const canEdit =
            isOwner && Date.now() - new Date(r.created_at).getTime() < EDIT_WINDOW_MS;
          const postReactions = reactions.filter((x) => x.post_id === r.id);
          const postComments = comments.filter((x) => x.post_id === r.id);
          const postReads = reads.filter((x) => x.post_id === r.id);
          const grouped = postReactions.reduce<Record<string, ReactionRow[]>>((acc, rx) => {
            (acc[rx.emoji] ||= []).push(rx);
            return acc;
          }, {});
          const isOpen = !!openComments[r.id];
          const isEditing = editingId === r.id;
          const isPinned = !!r.pinned_at;

          return (
            <li
              key={r.id}
              className={`rounded-lg border border-border/60 bg-background/40 p-3 border-r-4 ${meta.ring} ${
                isPinned ? "ring-1 ring-amber-500/40 bg-amber-500/5" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-neon/15 text-neon text-xs font-bold flex items-center justify-center">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {name ?? "משתמש"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.chip}`}>
                        {meta.emoji} {meta.label}
                      </span>
                      {isPinned && (
                        <span className="text-[10px] inline-flex items-center gap-0.5 text-amber-400">
                          <Pin className="h-2.5 w-2.5" /> מוצמד
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {relTime(r.created_at)}
                      {r.edited_at && " · נערך"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="mt-1 space-y-1">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full bg-background/60 border border-border rounded p-2 text-sm focus:border-neon/60 outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void saveEdit(r)}
                          className="inline-flex items-center gap-1 rounded bg-neon text-primary-foreground px-2 py-1 text-xs font-bold"
                        >
                          <Check className="h-3 w-3" /> שמור
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground/90 mt-1">
                        <FeedText text={r.message} users={mentionUsers} />
                      </p>
                      {r.image_url && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(r.image_url!)}
                          className="block mt-2"
                          aria-label="הצג תמונה מצורפת"
                        >
                          <img
                            src={r.image_url}
                            alt="תמונה מצורפת"
                            loading="lazy"
                            className="w-20 h-20 rounded-lg border border-border object-cover float-left ml-2"
                          />
                        </button>
                      )}
                    </>
                  )}

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
                    {postReads.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setSeenByOpen((cur) => (cur === r.id ? null : r.id))
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-neon/40 hover:text-foreground transition"
                          title="נקרא על־ידי"
                        >
                          <Eye className="h-3 w-3" />
                          <span>{postReads.length}</span>
                        </button>
                        {seenByOpen === r.id && (
                          <div className="absolute z-10 top-full mt-1 right-0 min-w-[140px] rounded-lg border border-border bg-popover p-2 shadow-lg text-[11px] space-y-0.5">
                            <div className="font-bold text-muted-foreground mb-1">
                              נקרא על־ידי
                            </div>
                            {postReads.map((rd) => (
                              <div key={rd.user_id} className="truncate">
                                {profileNames[rd.user_id] ??
                                  (rd.user_id === uid ? fullName : "משתמש")}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                <div className="flex flex-col items-center gap-1">
                  {(isSuperAdmin || role === "admin") && (
                    <button
                      type="button"
                      onClick={() => void togglePin(r)}
                      aria-label={isPinned ? "בטל הצמדה" : "הצמד"}
                      className={`transition ${
                        isPinned
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-muted-foreground hover:text-amber-400"
                      }`}
                    >
                      {isPinned ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      aria-label="ערוך"
                      className="text-muted-foreground hover:text-foreground transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
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
              </div>
            </li>
          );
        })}
      </ul>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxUrl(null);
            }}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="תמונה מצורפת"
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
          }
        }
      }
    } catch (e) {
      toast.error("שליחת התגובה נכשלה");
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
