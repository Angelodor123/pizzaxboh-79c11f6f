import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Resolver = (v: boolean) => void;

let externalRequest: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDelete(opts: ConfirmOptions = {}): Promise<boolean> {
  if (!externalRequest) {
    // Fallback (SSR / not mounted yet)
    if (typeof window !== "undefined") {
      return Promise.resolve(window.confirm(opts.description || opts.title || "האם להמשיך?"));
    }
    return Promise.resolve(false);
  }
  return externalRequest(opts);
}

type State = { open: boolean; opts: ConfirmOptions; resolver: Resolver | null };

export function ConfirmHost() {
  const [state, setState] = useState<State>({ open: false, opts: {}, resolver: null });

  useEffect(() => {
    externalRequest = (opts) =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, opts, resolver: resolve });
      });
    return () => {
      externalRequest = null;
    };
  }, []);

  const close = useCallback(
    (val: boolean) => {
      state.resolver?.(val);
      setState((s) => ({ ...s, open: false, resolver: null }));
    },
    [state.resolver],
  );

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, close]);

  if (!state.open) return null;
  const {
    title = "מחיקת פריט",
    description,
    itemName,
    confirmLabel = "למחוק",
    cancelLabel = "ביטול",
    destructive = true,
  } = state.opts;

  const body =
    description ||
    (itemName
      ? `האם אתה בטוח שברצונך למחוק את "${itemName}"? פעולה זו אינה ניתנת לשחזור.`
      : "האם אתה בטוח שברצונך למחוק? פעולה זו אינה ניתנת לשחזור.");

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[1000] bg-background/80 backdrop-blur-sm grid place-items-center p-4 animate-in fade-in"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        style={{ borderInlineStartWidth: 4, borderInlineStartColor: destructive ? "var(--destructive, #dc2626)" : "var(--neon)" }}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className={`h-10 w-10 shrink-0 grid place-content-center rounded-full ${destructive ? "bg-red-500/15 text-red-400" : "bg-neon/15 text-neon"}`}>
            {destructive ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{body}</p>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            className="h-8 w-8 -mt-1 -ml-1 grid place-content-center rounded-md text-zinc-500 hover:text-foreground hover:bg-zinc-800"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-5 pb-5 pt-2">
          <button
            type="button"
            onClick={() => close(true)}
            className={`flex-1 h-11 rounded-lg font-bold inline-flex items-center justify-center gap-2 transition active:scale-[0.98] ${
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_24px_-6px_rgba(220,38,38,0.6)]"
                : "bg-neon text-primary-foreground glow-neon"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => close(false)}
            className="h-11 px-4 rounded-lg text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:text-foreground transition font-bold"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Optional context hook (kept for parity if a component prefers hook style)
const Ctx = createContext<typeof confirmDelete>(confirmDelete);
export const useConfirmDelete = () => useContext(Ctx);
