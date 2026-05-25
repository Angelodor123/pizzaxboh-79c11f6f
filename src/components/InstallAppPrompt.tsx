import { useEffect, useState } from "react";
import { Download, Share, MoreVertical, X } from "lucide-react";

const STORAGE_KEY = "hasSeenInstallPrompt";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function InstallAppPrompt({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      return;
    }
    // small delay so it appears after NDA fade
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [active]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-background/85 backdrop-blur-sm grid place-items-center p-4"
      dir="rtl"
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-900 border-2 border-neon rounded-2xl p-6 space-y-5 glow-neon"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-neon" />
            <h2 className="font-display text-xl font-bold text-zinc-100">
              התקן את האפליקציה
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="סגור"
            className="h-8 w-8 grid place-content-center rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">
          הוסף את Pizza X למסך הבית לגישה מהירה, מסך מלא וחוויית אפליקציה
          אמיתית.
        </p>

        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Share className="h-4 w-4 text-neon" />
              <div className="text-sm font-bold text-zinc-100">iPhone (Safari)</div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              לחץ על כפתור השיתוף בתחתית המסך ובחר{" "}
              <span className="text-zinc-200 font-bold">
                "הוסף למסך הבית"
              </span>{" "}
              (Add to Home Screen).
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MoreVertical className="h-4 w-4 text-neon" />
              <div className="text-sm font-bold text-zinc-100">Android (Chrome)</div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              לחץ על 3 הנקודות בפינה העליונה ובחר{" "}
              <span className="text-zinc-200 font-bold">"התקן אפליקציה"</span>{" "}
              (Install App).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="w-full h-11 rounded-lg bg-neon text-primary-foreground font-bold glow-neon"
        >
          הבנתי, סגור
        </button>
      </div>
    </div>
  );
}
