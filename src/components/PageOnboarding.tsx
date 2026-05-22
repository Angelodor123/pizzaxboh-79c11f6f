import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingRow {
  title: string;
  body: string;
}

const cache = new Map<string, OnboardingRow>();
const listeners = new Map<string, Set<(r: OnboardingRow) => void>>();

async function loadOnboarding(key: string) {
  const { data } = await supabase
    .from("page_onboarding")
    .select("title,body")
    .eq("page_key", key)
    .maybeSingle();
  const row: OnboardingRow = {
    title: data?.title ?? "",
    body: data?.body ?? "",
  };
  cache.set(key, row);
  listeners.get(key)?.forEach((cb) => cb(row));
  return row;
}

export function PageOnboarding({ pageKey }: { pageKey: string }) {
  const [row, setRow] = useState<OnboardingRow | null>(() => cache.get(pageKey) ?? null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const storageKey = `pizzax-onboarding-hidden-${pageKey}`;
    if (typeof window !== "undefined" && localStorage.getItem(storageKey) === "1") {
      setHidden(true);
    }
    let set = listeners.get(pageKey);
    if (!set) {
      set = new Set();
      listeners.set(pageKey, set);
    }
    const cb = (r: OnboardingRow) => setRow(r);
    set.add(cb);
    if (!cache.has(pageKey)) void loadOnboarding(pageKey);
    else setRow(cache.get(pageKey)!);
    return () => {
      set!.delete(cb);
    };
  }, [pageKey]);

  if (hidden) return null;
  if (!row || (!row.title && !row.body)) return null;

  return (
    <div
      dir="rtl"
      className="relative mx-auto max-w-5xl px-4 mt-3"
    >
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md px-4 py-3 shadow-[0_4px_20px_-8px_rgba(16,185,129,0.4)]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            {row.title && (
              <div className="text-sm font-bold text-emerald-200">{row.title}</div>
            )}
            {row.body && (
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">
                {row.body}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setHidden(true);
              if (typeof window !== "undefined")
                localStorage.setItem(`pizzax-onboarding-hidden-${pageKey}`, "1");
            }}
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-emerald-500/15 transition"
            aria-label="הסתר הסבר"
            title="הסתר"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Allow other modules (admin editor) to invalidate
export function refreshOnboarding(key: string) {
  cache.delete(key);
  void loadOnboarding(key);
}

// Map a router pathname to the page_key used in DB.
export function pageKeyFromPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "index";
  const seg = pathname.replace(/^\/+/, "").split("/")[0];
  return seg || "index";
}
