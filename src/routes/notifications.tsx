import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, CheckCheck, Settings as SettingsIcon, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications-store";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "התראות — Pizza X" }] }),
  component: NotificationsPage,
});

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function NotificationsPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { items, unreadCount, markAllRead, markRead, loading } = useNotifications(userId);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור
          </Link>
          <Link
            to="/my-profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            הגדרות
          </Link>
        </div>

        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <span className="p-2 rounded-md bg-neon/10 text-neon">
                <Bell className="h-5 w-5" />
              </span>
              התראות
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} התראות חדשות` : "אין התראות חדשות"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-xs font-bold text-neon hover:bg-neon/20 transition"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              סמן הכל כנקרא
            </button>
          )}
        </header>

        {!userId ? (
          <EmptyState text="יש להתחבר כדי לצפות בהתראות." />
        ) : loading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">טוען…</div>
        ) : items.length === 0 ? (
          <EmptyState text="אין עדיין התראות. כשתגיע התראה חדשה היא תופיע כאן." />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.read_at && void markRead(n.id)}
                className={`rounded-xl border p-3 cursor-pointer transition ${
                  n.read_at
                    ? "border-border bg-card/40 hover:bg-card/70"
                    : "border-neon/40 bg-neon/5 hover:bg-neon/10"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-neon shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {relTime(n.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
      <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
