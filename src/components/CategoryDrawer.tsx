import { Link } from "@tanstack/react-router";
import { Menu, Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { categoryLabels, type RecipeCategory } from "@/lib/cookbook";
import { useUIStore } from "@/lib/ui-store";

const ITEMS: { key: RecipeCategory | "all"; emoji: string; label: string }[] = [
  { key: "sauces_bases", emoji: "🍅", label: categoryLabels.sauces_bases },
  { key: "aiolis_sauces", emoji: "🍯", label: categoryLabels.aiolis_sauces },
  { key: "jams_creams", emoji: "🥘", label: categoryLabels.jams_creams },
  { key: "starters", emoji: "🌽", label: categoryLabels.starters },
  { key: "desserts", emoji: "🍪", label: categoryLabels.desserts },
  { key: "all", emoji: "📋", label: "כל המתכונים" },
];

export function CategoryDrawer() {
  const { category, drawerOpen, setCategory, setDrawerOpen } = useUIStore();

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="פתח תפריט"
          className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border text-foreground hover:text-neon hover:border-neon transition"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-[#1A1A1A] border-l border-border w-[88%] sm:w-80 p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-5 border-b border-border text-right">
          <SheetTitle className="font-display text-xl text-foreground">
            תפריט <span className="text-neon text-glow-neon">קטגוריות</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="flex flex-col">
            {ITEMS.map((it) => {
              const active = category === it.key;
              return (
                <li key={it.key}>
                  <Link
                    to="/"
                    onClick={() => setCategory(it.key)}
                    className={`flex items-center justify-end gap-3 px-6 py-4 text-lg font-bold border-r-4 transition ${
                      active
                        ? "bg-neon/10 text-neon border-neon glow-neon"
                        : "text-foreground border-transparent hover:bg-card hover:text-neon"
                    }`}
                  >
                    <span className="flex-1 text-right">{it.label}</span>
                    <span className="text-2xl leading-none">{it.emoji}</span>
                  </Link>
                </li>
              );
            })}

            <li className="mt-3 border-t border-border pt-3">
              <Link
                to="/guide"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-end gap-3 px-6 py-4 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <span className="flex-1 text-right">מדריך מקצועי</span>
                <span className="text-2xl leading-none">📖</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="border-t border-border p-4">
          <Link
            to="/admin"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-end gap-3 px-4 py-3 rounded-md bg-card text-foreground font-bold hover:bg-neon hover:text-primary-foreground transition"
          >
            <span className="flex-1 text-right">מערכת ניהול</span>
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
