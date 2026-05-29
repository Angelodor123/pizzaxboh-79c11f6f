import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";

const STORAGE_KEY = "pizzax-notepad-fab-pos-v1";

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* noop */
  }
  return null;
}

export function DraggableNotepadFab() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<Pos | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startPointer = useRef<Pos>({ x: 0, y: 0 });
  const startPos = useRef<Pos>({ x: 0, y: 0 });

  // Initialize position (default: bottom-left, RTL → visually right)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = loadPos();
    if (saved) {
      setPos(clampToViewport(saved));
    } else {
      setPos({
        x: 20,
        y: window.innerHeight - 160,
      });
    }
    const onResize = () => setPos((p) => (p ? clampToViewport(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = pos;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    setPos(
      clampToViewport({
        x: startPos.current.x + dx,
        y: startPos.current.y + dy,
      }),
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragging.current = false;
    if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        /* noop */
      }
    }
    if (!moved.current) {
      navigate({ to: "/notebook" });
    }
  };

  if (!pos) return null;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 45,
        touchAction: "none",
      }}
      aria-label="פתח את פנקס העבודה"
      title="פנקס עבודה"
      className="h-14 w-14 rounded-full bg-neon text-primary-foreground shadow-[0_0_18px_rgba(57,255,20,0.55)] border-2 border-neon/80 flex items-center justify-center active:scale-95 transition"
    >
      <NotebookPen className="h-6 w-6" />
    </button>
  );
}

function clampToViewport(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const size = 56;
  return {
    x: Math.max(8, Math.min(p.x, w - size - 8)),
    y: Math.max(8, Math.min(p.y, h - size - 8)),
  };
}
