import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, X, Share2, Copy, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useNotebookStore,
  type NotebookListKey,
  type NotebookItem,
} from "@/lib/notebook-store";
import { useSiteText } from "@/lib/site-texts";

export const Route = createFileRoute("/notebook")({
  component: NotebookPage,
});

interface ListConfig {
  key: NotebookListKey;
  title: string;
  emoji: string;
  placeholder: string;
}

const LISTS: ListConfig[] = [
  {
    key: "tasks",
    title: "משימות להיום",
    emoji: "✅",
    placeholder: 'לדוגמה: "לבדוק חיי מדף של רוטב שמנת"',
  },
  {
    key: "shopping",
    title: "רשימת קניות לסופר",
    emoji: "🛒",
    placeholder: 'לדוגמה: "בננות", "ביצים 2 תבניות"',
  },
  {
    key: "orders",
    title: "חוסרים והזמנות סחורה",
    emoji: "📦",
    placeholder: 'לדוגמה: "בצל סגול — 10 ק״ג"',
  },
  {
    key: "warehouse",
    title: "להביא מהמחסן",
    emoji: "🏬",
    placeholder: 'לדוגמה: "קרטון מפיות", "שקיות ואקום"',
  },
];

function NotebookPage() {
  const title = useSiteText("notebook.title", "פנקס עבודה יומי");
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          Daily Workbook
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          📋 <span className="text-neon text-glow-neon">{title}</span>
        </h1>
        <p className="text-foreground/80 mt-2 text-sm flex items-center gap-2 flex-wrap">
          <Users className="h-4 w-4 text-neon" />
          רשימות משותפות בזמן אמת לכל הצוות. כל שינוי מסונכרן מיידית.
        </p>
      </div>

      <div className="space-y-4">
        {LISTS.map((cfg) => (
          <NotebookList key={cfg.key} cfg={cfg} />
        ))}
      </div>
    </div>
  );
}

function buildShareText(cfg: ListConfig, items: NotebookItem[]): string {
  const lines = items.map((it) => `${it.done ? "✔" : "•"} ${it.text}`);
  return `${cfg.emoji} ${cfg.title} — Pizza X\n\n${lines.join("\n")}`;
}

function NotebookList({ cfg }: { cfg: ListConfig }) {
  const items = useNotebookStore((s) => s.lists[cfg.key]);
  const addItem = useNotebookStore((s) => s.addItem);
  const toggleItem = useNotebookStore((s) => s.toggleItem);
  const removeItem = useNotebookStore((s) => s.removeItem);
  const clearDone = useNotebookStore((s) => s.clearDone);
  const [draft, setDraft] = useState("");

  const doneCount = items.filter((i) => i.done).length;

  const submit = async () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await addItem(cfg.key, text);
  };

  const openItems = items.filter((i) => !i.done);

  const shareWhatsApp = () => {
    if (openItems.length === 0) {
      toast.info("אין פריטים פתוחים לשתף");
      return;
    }
    const text = encodeURIComponent(buildShareText(cfg, openItems));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const copyToClipboard = async () => {
    if (openItems.length === 0) {
      toast.info("אין פריטים פתוחים להעתיק");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildShareText(cfg, openItems));
      toast.success("הרשימה הועתקה ללוח");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };

  const nativeShare = async () => {
    if (openItems.length === 0) {
      toast.info("אין פריטים פתוחים לשתף");
      return;
    }
    const text = buildShareText(cfg, openItems);
    if (navigator.share) {
      try {
        await navigator.share({ title: cfg.title, text });
      } catch {
        /* user dismissed */
      }
    } else {
      await copyToClipboard();
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/80 backdrop-blur p-4 sm:p-5">
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-right">
            {cfg.emoji} {cfg.title}
          </h2>
          <div className="text-[11px] text-muted-foreground mt-0.5 text-right tabular-nums">
            {items.length} פריטים · {doneCount} הושלמו
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={shareWhatsApp}
            aria-label="שתף בוואטסאפ"
            title="שתף בוואטסאפ"
            className="p-2 rounded-md border border-border hover:border-jungle hover:text-jungle text-muted-foreground transition"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            aria-label="העתק רשימה"
            title="העתק רשימה"
            className="p-2 rounded-md border border-border hover:border-neon hover:text-neon text-muted-foreground transition"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nativeShare}
            aria-label="שתף"
            title="שתף"
            className="p-2 rounded-md border border-border hover:border-neon hover:text-neon text-muted-foreground transition"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => void clearDone(cfg.key)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive transition px-2 py-1 rounded-md border border-border"
            >
              <Trash2 className="h-3 w-3" />
              נקה הושלמו
            </button>
          )}
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex gap-2 mb-3"
      >
        <button
          type="submit"
          aria-label="הוסף פריט"
          disabled={!draft.trim()}
          className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-neon text-primary-foreground glow-neon disabled:opacity-40 disabled:glow-none"
        >
          <Plus className="h-5 w-5" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={cfg.placeholder}
          maxLength={500}
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
          dir="rtl"
        />
      </form>

      {items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-md">
          הרשימה ריקה. הוסף פריט ראשון למעלה.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded-lg bg-background/40 border border-border/60 px-2.5 py-2 hover:border-neon/40 transition"
            >
              <button
                type="button"
                onClick={() => void removeItem(cfg.key, it.id)}
                aria-label="מחק"
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive transition"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void toggleItem(cfg.key, it.id)}
                className={`flex-1 min-w-0 flex items-center gap-3 text-right cursor-pointer ${
                  it.done ? "opacity-50" : ""
                }`}
                aria-pressed={it.done}
              >
                <span
                  className={`flex-1 min-w-0 break-words text-sm ${
                    it.done ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {it.text}
                </span>
                <span
                  className={`shrink-0 grid place-content-center h-5 w-5 rounded border-2 transition ${
                    it.done
                      ? "bg-neon border-neon"
                      : "border-neon/50 hover:border-neon"
                  }`}
                  aria-hidden
                >
                  {it.done && (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M3 8l3.5 3.5L13 5" />
                    </svg>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
