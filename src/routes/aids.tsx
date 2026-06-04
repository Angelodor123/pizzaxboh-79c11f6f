import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Package, BookOpen, Sparkles, Phone } from "lucide-react";

export const Route = createFileRoute("/aids")({
  head: () => ({
    meta: [
      { title: "עזרים — ספרייה דיגיטלית" },
      { name: "description", content: "ספרייה דיגיטלית: ספקים, מתכונים, ניקיון ואנשי קשר." },
    ],
  }),
  component: AidsHubPage,
});

type Folder = {
  title: string;
  emoji: string;
  Icon: typeof Package;
  to: string;
  accent: string;
};

const FOLDERS: Folder[] = [
  {
    title: "ספקים ותקנים",
    emoji: "📦",
    Icon: Package,
    to: "/aids/suppliers",
    accent: "from-neon/20 to-neon/5 border-neon/40 text-neon",
  },
  {
    title: "ספרי מתכונים",
    emoji: "📖",
    Icon: BookOpen,
    to: "/recipes",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-300",
  },
  {
    title: "נהלי ניקיון",
    emoji: "🧹",
    Icon: Sparkles,
    to: "/aids/cleaning",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/40 text-sky-300",
  },
  {
    title: "אנשי קשר",
    emoji: "📞",
    Icon: Phone,
    to: "/aids/contacts",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/40 text-violet-300",
  },
];

function AidsHubPage() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold">📚 עזרים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ספרייה דיגיטלית — בחר קטגוריה כדי להיכנס לתוכן.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {FOLDERS.map((f) => (
            <button
              key={f.title}
              type="button"
              onClick={() => navigate({ to: f.to })}
              className={`group relative text-right rounded-2xl border-2 bg-gradient-to-br ${f.accent} p-4 min-h-[140px] flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl leading-none">{f.emoji}</span>
                <f.Icon className="h-5 w-5 opacity-70" />
              </div>
              <div>
                <div className="text-base font-extrabold text-foreground leading-tight">
                  {f.title}
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold opacity-80">
                  פתח <ArrowRight className="h-3 w-3 rotate-180" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
