import { Zap } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/ui-store";

export function ServiceModeToggle() {
  const active = useUIStore((s) => s.isServiceMode);
  const toggle = useUIStore((s) => s.toggleServiceMode);

  const handleClick = () => {
    const next = !active;
    toggle();
    if (next) {
      toast.success("מצב סרוויס הופעל", {
        description: "תצוגה מהירה למתכונים — כמויות מוגדלות, ניווט מקוצר ומידע קריטי בלבד.",
      });
    } else {
      toast("מצב סרוויס כובה", {
        description: "חזרה לתצוגת ה-Back of House המלאה.",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label="מצב סרוויס"
      title={active ? "מצב סרוויס פעיל — לחץ לכיבוי" : "הפעל מצב סרוויס"}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg border-2 transition ${
        active
          ? "border-orange-500 bg-orange-500/15 text-orange-300 shadow-[0_0_18px_rgba(255,140,0,0.55)]"
          : "border-border text-muted-foreground hover:text-neon hover:border-neon/60"
      }`}
    >
      <Zap
        className={`h-5 w-5 ${active ? "fill-orange-300" : ""}`}
        strokeWidth={active ? 2.5 : 2}
      />
      <span className="text-[9px] font-bold tracking-wider leading-none">
        סרוויס
      </span>
    </button>
  );
}

