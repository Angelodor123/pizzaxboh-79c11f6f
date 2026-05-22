import { useRef } from "react";

export function useSwipe(opts: {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const threshold = opts.threshold ?? 60;

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current == null || startY.current == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      startX.current = null;
      startY.current = null;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      // RTL: swipe right (positive dx) means user swiped to the right visually
      if (dx > 0) opts.onSwipeRight?.();
      else opts.onSwipeLeft?.();
    },
  };
}
