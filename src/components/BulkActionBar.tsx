import { useState } from "react";
import { X, CheckSquare, Square, type LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface BulkAction {
  key: string;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "destructive" | "neon";
  /** If set, opens an AlertDialog with this message before running. */
  confirm?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

export function BulkActionBar({
  count,
  totalCount,
  onClear,
  onSelectAll,
  actions,
  allSelected,
}: {
  count: number;
  totalCount?: number;
  onClear: () => void;
  onSelectAll?: () => void;
  actions: BulkAction[];
  allSelected?: boolean;
}) {
  const [pending, setPending] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  const run = async (a: BulkAction) => {
    if (a.confirm) {
      setPending(a);
      return;
    }
    setBusy(true);
    try {
      await a.onClick();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 pointer-events-none"
      >
        <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-neon/60 bg-card/95 backdrop-blur shadow-[0_10px_40px_-10px_rgba(255,20,147,0.55)] p-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClear}
            aria-label="בטל בחירה"
            className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-destructive hover:border-destructive"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-sm font-bold tabular-nums">
            נבחרו <span className="text-neon">{count}</span>
            {typeof totalCount === "number" ? (
              <span className="text-muted-foreground"> / {totalCount}</span>
            ) : null}
          </div>

          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-bold hover:border-neon hover:text-neon"
            >
              {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allSelected ? "בטל הכל" : "בחר הכל"}
            </button>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {actions.map((a) => {
              const Icon = a.icon;
              const cls =
                a.variant === "destructive"
                  ? "border-destructive/60 text-destructive hover:bg-destructive/10"
                  : a.variant === "neon"
                  ? "border-neon text-primary-foreground bg-neon glow-neon"
                  : "border-border hover:border-neon hover:text-neon";
              return (
                <button
                  key={a.key}
                  type="button"
                  disabled={a.disabled || busy}
                  onClick={() => void run(a)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-bold transition disabled:opacity-50 ${cls}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור פעולה</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.confirm?.replace("{count}", String(count))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pending) return;
                const a = pending;
                setPending(null);
                setBusy(true);
                try {
                  await a.onClick();
                } finally {
                  setBusy(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              אישור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
