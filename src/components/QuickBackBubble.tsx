import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useUIStore } from "@/lib/ui-store";

const STORAGE_KEY = "pizzax-quickback-pos-v1";

export function QuickBackBubble() {
  const lastRecipeId = useUIStore((s) => s.lastRecipeId);
  const lastRecipeName = useUIStore((s) => s.lastRecipeName);
  const clearLastRecipe = useUIStore((s) => s.clearLastRecipe);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Initialize position bottom-left after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPos(JSON.parse(saved));
        return;
      }
    } catch {}
    setPos({ x: 16, y: window.innerHeight - 96 });
  }, []);

  // Clamp on resize
  useEffect(() => {
    function onResize() {
      setPos((p) => {
        if (!p || !bubbleRef.current) return p;
        const w = bubbleRef.current.offsetWidth;
        const h = bubbleRef.current.offsetHeight;
        return {
          x: Math.min(Math.max(0, p.x), window.innerWidth - w),
          y: Math.min(Math.max(0, p.y), window.innerHeight - h),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      movedRef.current = true;
      const w = bubbleRef.current?.offsetWidth ?? 56;
      const h = bubbleRef.current?.offsetHeight ?? 56;
      const x = Math.min(Math.max(0, e.clientX - offsetRef.current.x), window.innerWidth - w);
      const y = Math.min(Math.max(0, e.clientY - offsetRef.current.y), window.innerHeight - h);
      setPos({ x, y });
    }
    function onUp() {
      setDragging(false);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
          } catch {}
        }
        return p;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  if (!lastRecipeId || !lastRecipeName || !pos) return null;

  return (
    <div
      ref={bubbleRef}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-50 select-none"
    >
      <div
        onPointerDown={(e) => {
          if (!bubbleRef.current) return;
          movedRef.current = false;
          const rect = bubbleRef.current.getBoundingClientRect();
          offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setDragging(true);
        }}
        className="relative group"
      >
        <Link
          to="/recipes"
          hash={`recipe-${lastRecipeId}`}
          onClick={(e) => {
            if (movedRef.current) {
              e.preventDefault();
            }
          }}
          aria-label={`חזור ל${lastRecipeName}`}
          title={`חזור ל: ${lastRecipeName}`}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-neon bg-card/95 backdrop-blur glow-neon shadow-xl text-neon text-2xl font-bold cursor-grab active:cursor-grabbing"
        >
          ↩
        </Link>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            clearLastRecipe();
          }}
          aria-label="סגור"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border border-border text-muted-foreground text-[10px] leading-none flex items-center justify-center hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
