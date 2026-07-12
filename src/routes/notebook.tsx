import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, X, Share2, Copy, MessageCircle, Users, Flame, Pencil, Check, CheckSquare, CheckCheck, RotateCcw, GripVertical, ChevronDown } from "lucide-react";
import { ReactNode } from "react";
import { SortableList } from "@/components/SortableList";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";
import { supabase } from "@/integrations/supabase/client";
import {
  useNotebookStore,
  type NotebookListKey,
  type NotebookItem,
} from "@/lib/notebook-store";
import { useSiteText } from "@/lib/site-texts";
import { BulkActionBar } from "@/components/BulkActionBar";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { ShortageCatalogInput } from "@/components/ShortageCatalogInput";
import { useAuth } from "@/lib/auth";
import { PullToRefresh } from "@/components/PullToRefresh";



export const Route = createFileRoute("/notebook")({
  head: () => ({
    meta: [
      { title: 'Pizza X' },
      { name: "description", content: 'Pizza X' },
    
      { property: "og:title", content: 'Pizza X' },
      { property: "og:description", content: 'Pizza X' },
      { property: "og:url", content: "https://pizzaxboh.lovable.app/notebook" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pizzaxboh.lovable.app/notebook" }],
  }),
  component: NotebookPage,
});

interface ListConfig {
  key: NotebookListKey;
  title: string;
  emoji: string;
  placeholder: string;
}

const DAILY_LISTS: ListConfig[] = [
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
    title: "הזמנת סחורה",
    emoji: "📦",
    placeholder: 'לדוגמה: "בצל סגול — 10 ק״ג"',
  },
  {
    key: "shortages",
    title: "חוסרים",
    emoji: "⚠️",
    placeholder: 'לדוגמה: "נגמר רוטב עגבניות"',
  },
];

const WAREHOUSE_LISTS: ListConfig[] = [
  {
    key: "warehouse",
    title: "רשימת מחסן",
    emoji: "🏬",
    placeholder: 'לדוגמה: "קרטון מפיות", "שקיות ואקום"',
  },
];

function NotebookPage() {
  const title = useSiteText("notebook.title", "פנקס עבודה יומי");
  const [tab, setTab] = useState<"daily" | "warehouse">("daily");
  const lists = tab === "daily" ? DAILY_LISTS : WAREHOUSE_LISTS;
  const refresh = useNotebookStore((s) => s.refresh);
  return (
    <PullToRefresh onRefresh={refresh}>
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

      <div className="flex gap-2 mb-4 border-b border-border px-1">
        {[
          { id: "daily" as const, label: "📋 פנקס יומי" },
          { id: "warehouse" as const, label: "🏬 רשימת מחסן" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-neon text-neon"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {lists.map((cfg) => (
          <NotebookList key={cfg.key} cfg={cfg} />
        ))}
      </div>
    </div>
    </PullToRefresh>
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
  const refresh = useNotebookStore((s) => s.refresh);
  const reorderList = useNotebookStore((s) => s.reorderList);
  const [draft, setDraft] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bulk = useBulkSelection();
  const { role } = useAuth();
  const isAdmin = role === "admin";


  const doneCount = items.filter((i) => i.done).length;
  const openCount = items.length - doneCount;

  const submit = async () => {
    if (!draft.trim()) return;
    const text = draft;
    const wasUrgent = urgent;
    setDraft("");
    setUrgent(false);
    await addItem(cfg.key, text, { priority: wasUrgent ? "urgent" : "normal" });
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
      <header className="mb-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="w-full text-center group"
        >
          <div className="inline-flex items-center justify-center gap-2">
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
            <h2 className="font-display text-lg font-bold">
              {cfg.emoji} {cfg.title}
            </h2>
            {openCount > 0 && (
              <span className="text-[10px] bg-neon/15 text-neon px-2 py-0.5 rounded-full font-bold tabular-nums">
                {openCount}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
            <bdi>{items.length}</bdi> פריטים · <bdi>{doneCount}</bdi> הושלמו
          </div>
        </button>
        <div className="mt-3 flex items-center justify-center flex-wrap gap-1.5">
          <button
            type="button"
            onClick={shareWhatsApp}
            aria-label="שתף בוואטסאפ"
            title="שתף בוואטסאפ"
            className="p-2 rounded-md border border-border hover:border-jungle hover:text-jungle active:scale-95 text-muted-foreground transition min-h-11 min-w-11 inline-flex items-center justify-center"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            aria-label="העתק רשימה"
            title="העתק רשימה"
            className="p-2 rounded-md border border-border hover:border-neon hover:text-neon active:scale-95 text-muted-foreground transition min-h-11 min-w-11 inline-flex items-center justify-center"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nativeShare}
            aria-label="שתף"
            title="שתף"
            className="p-2 rounded-md border border-border hover:border-neon hover:text-neon active:scale-95 text-muted-foreground transition min-h-11 min-w-11 inline-flex items-center justify-center"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => bulk.toggleAll(items.map((i) => i.id))}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-neon hover:border-neon active:scale-95 transition px-2 py-1 rounded-md border border-border min-h-9"
              title="בחירה מרובה"
            >
              <CheckSquare className="h-3 w-3" />
              {bulk.selectionMode ? "סיים" : "בחר"}
            </button>
          )}
          {doneCount > 0 && isAdmin && (
            <button
              type="button"
              onClick={() => void clearDone(cfg.key)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive active:scale-95 transition px-2 py-1 rounded-md border border-border min-h-9"
            >
              <Trash2 className="h-3 w-3" />
              נקה הושלמו
            </button>
          )}
        </div>
      </header>

      {!collapsed && (
        <>
      {cfg.key === "shortages" ? (
        <div className="mb-3">
          <ShortageCatalogInput
            placeholder='חפש פריט שחסר... (לדוגמה: "סוכר")'
            onSubmit={async ({ catalogProductId, text, unit: u, currentStock, urgent: isUrgent }) => {
              await addItem("shortages", text, {
                priority: isUrgent ? "urgent" : "normal",
                catalogProductId,
                currentStock,
                unit: u,
              });
            }}
          />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex gap-2 mb-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={cfg.placeholder}
            maxLength={500}
            aria-label={`הוסף פריט ל${cfg.title}`}
            className="flex-1 min-w-0 bg-input border border-border rounded-md px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-neon/60 focus:border-neon"
            dir="rtl"
          />
          <button
            type="button"
            onClick={() => setUrgent((u) => !u)}
            aria-pressed={urgent}
            aria-label={urgent ? "בטל סימון דחוף" : "סמן כדחוף"}
            title={urgent ? "דחוף" : "סמן כדחוף"}
            className={`shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md border transition active:scale-95 ${
              urgent
                ? "bg-neon/15 border-neon text-neon glow-neon"
                : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
            }`}
          >
            <Flame className="h-4 w-4" />
          </button>
          <button
            type="submit"
            aria-label="הוסף פריט"
            disabled={!draft.trim()}
            className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-neon text-primary-foreground glow-neon disabled:opacity-40 disabled:glow-none active:scale-95 transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      )}


      {items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-md">
          הרשימה ריקה. הוסף פריט ראשון למעלה.
        </p>
      ) : (
        <SortableList
          items={items}
          getId={(it) => it.id}
          onReorder={(reordered) => reorderList(cfg.key, reordered)}
          disabled={bulk.selectionMode}
          className="space-y-1.5"
        >
          {(it, handle) => (
            <NotebookRow
              item={it}
              listKey={cfg.key}
              selectionMode={bulk.selectionMode}
              selected={bulk.isSelected(it.id)}
              onSelectToggle={() => bulk.toggle(it.id)}
              dragHandle={handle}
            />
          )}
        </SortableList>
      )}

      <BulkActionBar
        count={bulk.count}
        totalCount={items.length}
        allSelected={bulk.count === items.length && items.length > 0}
        onClear={bulk.clear}
        onSelectAll={() => bulk.toggleAll(items.map((i) => i.id))}
        actions={[
          {
            key: "done",
            label: "סמן כבוצע",
            icon: CheckCheck,
            onClick: async () => {
              const { error } = await supabase
                .from("notebook_items")
                .update({ done: true })
                .in("id", bulk.ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`סומנו ${bulk.count} פריטים`);
              bulk.clear();
              void refresh();
            },
          },
          {
            key: "undone",
            label: "החזר",
            icon: RotateCcw,
            onClick: async () => {
              const { error } = await supabase
                .from("notebook_items")
                .update({ done: false })
                .in("id", bulk.ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`הוחזרו ${bulk.count} פריטים`);
              bulk.clear();
              void refresh();
            },
          },
          {
            key: "urgent",
            label: "סמן כדחוף",
            icon: Flame,
            onClick: async () => {
              const { error } = await supabase
                .from("notebook_items")
                .update({ priority: "urgent" })
                .in("id", bulk.ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`סומנו ${bulk.count} כדחופים`);
              bulk.clear();
              void refresh();
            },
          },
          {
            key: "delete",
            label: "מחק",
            icon: Trash2,
            variant: "destructive",
            confirm: "למחוק {count} פריטים?",
            onClick: async () => {
              const ids = bulk.ids;
              const { error } = await supabase
                .from("notebook_items")
                .delete()
                .in("id", ids);
              if (error) { toast.error(error.message); return; }
              toast.success(`נמחקו ${ids.length} פריטים`);
              bulk.clear();
              void refresh();
            },
          },
        ]}
        />
        </>
      )}
    </section>
  );
}

function NotebookRow({
  item,
  listKey,
  selectionMode = false,
  selected = false,
  onSelectToggle,
  dragHandle,
}: {
  item: NotebookItem;
  listKey: NotebookListKey;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
  dragHandle?: ReactNode;
}) {
  const toggleItem = useNotebookStore((s) => s.toggleItem);
  const removeItem = useNotebookStore((s) => s.removeItem);
  const editItem = useNotebookStore((s) => s.editItem);
  const togglePriority = useNotebookStore((s) => s.togglePriority);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const startEdit = () => {
    setDraft(item.text);
    setEditing(true);
  };

  const saveEdit = async () => {
    const clean = draft.trim();
    if (!clean || clean === item.text) {
      setEditing(false);
      return;
    }
    await editItem(listKey, item.id, clean);
    setEditing(false);
  };

  return (
    <div
      onClickCapture={(e) => {
        if (selectionMode && onSelectToggle) {
          e.preventDefault();
          e.stopPropagation();
          onSelectToggle();
        }
      }}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:border-neon/40 transition ${
        selected ? "ring-2 ring-neon " : ""
      }${
        item.priority === "urgent" && !item.done
          ? "bg-neon/10 border-neon/50"
          : "bg-background/40 border-border/60"
      }`}
    >
      {!selectionMode && (
        dragHandle ?? (
          <span className="shrink-0 inline-flex items-center justify-center h-9 w-6 text-muted-foreground/50" aria-hidden>
            <GripVertical className="h-4 w-4" />
          </span>
        )
      )}
      {selectionMode && (
        <span
          className={`shrink-0 grid place-content-center h-5 w-5 rounded-full border-2 ${
            selected ? "bg-neon border-neon text-primary-foreground" : "border-border"
          }`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      )}

      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={() => void saveEdit()}
            maxLength={500}
            dir="rtl"
            aria-label="ערוך פריט"
            className="flex-1 min-w-0 bg-input border border-neon/60 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-neon/60"
          />
          <button
            type="button"
            onClick={() => void saveEdit()}
            aria-label="שמור שינוי"
            className="shrink-0 p-2 rounded text-neon hover:text-neon active:scale-95 transition min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 inline-flex items-center justify-center"
          >
            <Check className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleItem(listKey, item.id);
            }}
            aria-label={item.done ? `החזר: ${item.text}` : `סמן כבוצע: ${item.text}`}
            aria-pressed={item.done}
            className={`shrink-0 grid place-content-center h-6 w-6 rounded border-2 transition cursor-pointer ${
              item.done ? "bg-neon border-neon" : "border-neon/50 hover:border-neon"
            }`}
          >
            {item.done && (
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
          </button>
          <button
            type="button"
            onClick={startEdit}
            aria-label={`ערוך: ${item.text}`}
            className={`flex-1 min-w-0 text-right text-sm cursor-pointer hover:bg-white/5 rounded px-1.5 py-1 transition flex items-center gap-1.5 ${
              item.done ? "opacity-50" : ""
            }`}
          >
            {item.priority === "urgent" && !item.done && (
              <Flame className="h-3.5 w-3.5 text-neon shrink-0" aria-label="דחוף" />
            )}
            <span
              className={`min-w-0 break-words ${
                item.done ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {item.text}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void togglePriority(listKey, item.id);
            }}
            aria-label={item.priority === "urgent" ? "בטל דחיפות" : "סמן כדחוף"}
            aria-pressed={item.priority === "urgent"}
            title={item.priority === "urgent" ? "דחוף" : "סמן כדחוף"}
            className={`shrink-0 h-8 w-8 grid place-content-center rounded active:scale-95 transition ${
              item.priority === "urgent"
                ? "text-orange-400 bg-orange-500/15"
                : "text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"
            }`}
          >
            <Flame className={`h-4 w-4 ${item.priority === "urgent" ? "fill-orange-400/30" : ""}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            aria-label={`ערוך: ${item.text}`}
            className="shrink-0 h-8 w-8 grid place-content-center rounded text-muted-foreground hover:text-neon active:scale-95 transition"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirmDelete({ title: "מחיקת פריט", itemName: item.text });
              if (ok) void removeItem(listKey, item.id);
            }}
            aria-label={`מחק: ${item.text}`}
            className="shrink-0 h-8 w-8 grid place-content-center rounded text-muted-foreground hover:text-destructive active:scale-95 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

