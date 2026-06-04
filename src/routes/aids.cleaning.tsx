import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Sparkles, CheckSquare } from "lucide-react";

export const Route = createFileRoute("/aids/cleaning")({
  head: () => ({ meta: [{ title: "נהלי ניקיון — עזרים" }] }),
  component: AidsCleaningPage,
});

type CleaningGroup = { category: string; tasks: string[] };

const CLEANING: CleaningGroup[] = [
  {
    category: "סגירת עמדת פיצה ומטבח",
    tasks: [
      "פינוי כל המרכיבים למקרר תחתון",
      "ניגוב משטחי עבודה ונירוסטה עם חומר חיטוי",
      "ריקון וניקוי פחיות רוטב",
      "טיטוא ושטיפת הרצפה בסביבת התנור",
    ],
  },
  {
    category: "ניקיון ציוד",
    tasks: [
      "ניקוי יסודי של מיקסר הבצק כולל וו לישה",
      "ניגוב דלתות התנור (רק כשהוא קר לגמרי)",
      "ניקוי פילטרים של המזגן וקולט האדים (פעם בשבוע)",
    ],
  },
  {
    category: "סגירת אולם ישיבה וקופה",
    tasks: [
      "הרמת כיסאות על השולחנות",
      "ניגוב שולחנות יסודי",
      "ריקון פחים והחלפת שקיות",
      "שטיפת רצפה כוללת באזור הלקוחות",
    ],
  },
];

function AidsCleaningPage() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-sky-500/15 text-sky-300">
              <Sparkles className="h-5 w-5" />
            </span>
            נהלי ניקיון
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            צ׳קליסטים תפעוליים לסגירת משמרת וניקוי ציוד.
          </p>
        </header>

        <div className="space-y-3">
          {CLEANING.map((g, i) => {
            const open = openIdx === i;
            return (
              <div
                key={g.category}
                className="rounded-xl border border-border bg-card/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/40 transition text-right"
                >
                  <div>
                    <div className="font-bold text-foreground">{g.category}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {g.tasks.length} משימות
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <ul className="px-4 pb-4 pt-1 space-y-2">
                    {g.tasks.map((t, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-sm text-foreground/90"
                      >
                        <CheckSquare className="h-4 w-4 mt-0.5 text-sky-300 shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
