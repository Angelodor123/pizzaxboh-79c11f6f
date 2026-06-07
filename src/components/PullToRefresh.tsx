// Touch-based pull-to-refresh wrapper. Activates only when the scroll
// container is at the top and the user pulls down with a touch gesture.
// On desktop/no-touch the component is a transparent passthrough.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface Props {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
  /** Distance in px needed to trigger refresh. */
  threshold?: number;
  /** Hard cap for visual pull distance. */
  maxPull?: number;
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 70,
  maxPull = 120,
  disabled = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const atTop = () =>
      (window.scrollY ?? document.documentElement.scrollTop ?? 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshing || !atTop()) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Resistance curve
      const distance = Math.min(maxPull, dy * 0.5);
      setPull(distance);
      if (distance > 10 && e.cancelable) e.preventDefault();
    };
    const onEnd = async () => {
      const distance = pullRef.current;
      startY.current = null;
      if (distance >= threshold && !refreshing) {
        setRefreshing(true);
        triggerHaptic("medium");
        try {
          await onRefresh();
        } catch {
          /* swallowed; consumer should toast */
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, refreshing, threshold, maxPull, onRefresh]);

  // Keep the latest pull value visible to the touchend listener
  const pullRef = useRef(0);
  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  const ready = pull >= threshold;

  return (
    <div ref={ref} className="relative">
      <div
        className="pointer-events-none absolute left-0 right-0 -top-2 flex justify-center transition-opacity"
        style={{
          opacity: pull > 0 || refreshing ? 1 : 0,
          transform: `translateY(${Math.min(pull, maxPull)}px)`,
        }}
      >
        <div className="mt-2 rounded-full bg-background/90 border shadow px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {refreshing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              מרענן…
            </>
          ) : ready ? (
            <>
              <ArrowDown className="h-3.5 w-3.5 rotate-180 transition-transform" />
              שחרר לרענון
            </>
          ) : (
            <>
              <ArrowDown className="h-3.5 w-3.5" />
              משוך לרענון
            </>
          )}
        </div>
      </div>
      <div
        style={{
          transform: refreshing
            ? `translateY(${threshold * 0.6}px)`
            : pull > 0
              ? `translateY(${pull * 0.6}px)`
              : undefined,
          transition: pull > 0 && !refreshing ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
