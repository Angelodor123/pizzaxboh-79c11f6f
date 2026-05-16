import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, LogOut, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { categoryLabels, type RecipeCategory } from "@/lib/cookbook";
import { useUIStore } from "@/lib/ui-store";
import { useAuth } from "@/lib/auth";

const SUPER_ADMIN_EMAIL = "dorbareket123@gmail.com";

const CATEGORIES: { key: RecipeCategory | "all"; emoji: string; label: string }[] = [
  { key: "sauces_bases", emoji: "🍅", label: categoryLabels.sauces_bases },
  { key: "aiolis_sauces", emoji: "🍯", label: categoryLabels.aiolis_sauces },
  { key: "jams_creams", emoji: "🥘", label: categoryLabels.jams_creams },
  { key: "starters", emoji: "🌽", label: categoryLabels.starters },
  { key: "spices", emoji: "🧂", label: categoryLabels.spices },
  { key: "desserts", emoji: "🍪", label: categoryLabels.desserts },
];

export function CategoryDrawer() {
  const { category, drawerOpen, setCategory, setDrawerOpen } = useUIStore();
  const { email, role, signOut } = useAuth();
  const [catsOpen, setCatsOpen] = useState(false);
  const isSuperAdmin = role === "admin";

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
            תפריט
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="flex flex-col">
            <li>
              <button
                onClick={() => setCatsOpen((o) => !o)}
                className="w-full flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${catsOpen ? "rotate-180" : ""}`}
                />
                <span className="flex-1 text-right">📋 כל המתכונים</span>
              </button>

              {catsOpen && (
                <ul className="bg-background/40 border-y border-border">
                  <li>
                    <Link
                      to="/"
                      onClick={() => setCategory("all")}
                      className={`flex items-center justify-end gap-3 px-8 py-4 text-base font-bold border-r-4 transition ${
                        category === "all"
                          ? "bg-neon/10 text-neon border-neon"
                          : "text-foreground border-transparent hover:text-neon"
                      }`}
                    >
                      <span className="flex-1 text-right">📋 הצג את כל המתכונים</span>
                    </Link>
                  </li>
                  {CATEGORIES.map((it) => {
                    const active = category === it.key;
                    return (
                      <li key={it.key}>
                        <Link
                          to="/"
                          onClick={() => setCategory(it.key)}
                          className={`flex items-center justify-end gap-3 px-8 py-4 text-base font-bold border-r-4 transition ${
                            active
                              ? "bg-neon/10 text-neon border-neon"
                              : "text-foreground border-transparent hover:text-neon"
                          }`}
                        >
                          <span className="flex-1 text-right">
                            {it.emoji} {it.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>

            {isSuperAdmin && (
              <li>
                <div className="mx-6 my-2 h-px bg-border/60" />
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
                >
                  <span className="flex-1 text-right">מערכת ניהול</span>
                  <Settings className="h-5 w-5" />
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="border-t border-border px-6 py-5 flex items-center justify-between gap-3">
          {email && (
            <div className="text-[11px] text-muted-foreground truncate text-right flex-1">
              {email}
            </div>
          )}
          <button
            onClick={async () => {
              setDrawerOpen(false);
              await signOut();
            }}
            className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-neon transition"
          >
            <LogOut className="h-4 w-4" />
            התנתק
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
