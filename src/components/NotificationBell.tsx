import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications-store";

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

export function NotificationBell() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { items, unreadCount, markAllRead, markRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!userId) return null;

  return (
    <div ref={ref} className="relative" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`התראות${unreadCount ? ` (${unreadCount} חדשות)` : ""}`}
        className="relative inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-card hover:border-neon/60 transition"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-border bg-card shadow-2xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-card">
            <span className="font-bold text-sm">התראות</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs text-neon hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                סמן הכל כנקרא
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">אין התראות עדיין.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`p-3 border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/30 transition ${
                    !n.read_at ? "bg-neon/5" : ""
                  }`}
                  onClick={() => void markRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-neon shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{relTime(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
