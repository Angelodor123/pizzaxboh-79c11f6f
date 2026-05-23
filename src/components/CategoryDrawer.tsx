import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, LogOut, ChevronDown, NotebookPen, CalendarDays, Truck, Home, ChefHat, UtensilsCrossed } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { categoryLabels, type RecipeCategory } from "@/lib/cookbook";
import {
  BACK_OF_HOUSE_CATEGORIES,
  menuCategoryEmoji,
  menuCategoryLabels,
  menuCategoryOrder,
  type MenuCategory,
} from "@/lib/menu-categories";
import { useUIStore } from "@/lib/ui-store";
import { useAuth } from "@/lib/auth";

const RECIPE_EMOJI: Record<RecipeCategory, string> = {
  dishes: "🍕",
  sauces_bases: "🍅",
  aiolis_sauces: "🍯",
  jams_creams: "🥘",
  starters: "🌽",
  spices: "🧂",
  croutons: "🥖",
  desserts: "🍪",
  pastas: "🍝",
  authentic_pastas: "🇮🇹",
  salads: "🥗",
};

const RECIPE_CATEGORIES: { key: RecipeCategory; emoji: string; label: string }[] =
  BACK_OF_HOUSE_CATEGORIES.map((key) => ({
    key,
    emoji: RECIPE_EMOJI[key],
    label: categoryLabels[key],
  }));

const MENU_CATEGORIES: { key: MenuCategory; emoji: string; label: string }[] =
  menuCategoryOrder.map((key) => ({
    key,
    emoji: menuCategoryEmoji[key],
    label: menuCategoryLabels[key],
  }));


export function CategoryDrawer() {
  const { category, menuCategory, drawerOpen, setCategory, openDishes, setDrawerOpen } = useUIStore();
  const { email, role, signOut } = useAuth();
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [dishesOpen, setDishesOpen] = useState(false);
  const isSuperAdmin = role === "admin";
  const isDishesView = category === "dishes";


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
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <span className="flex-1 text-right">🏠 דף הבית</span>
                <Home className="h-5 w-5" />
              </Link>
            </li>

            <li>
              <button
                type="button"
                onClick={() => setDishesOpen((o) => !o)}
                aria-expanded={dishesOpen}
                className={`w-full flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold transition ${
                  isDishesView
                    ? "bg-neon/10 text-neon"
                    : "text-foreground hover:bg-card hover:text-neon"
                }`}
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${dishesOpen ? "rotate-180" : ""}`}
                />
                <span className="flex-1 text-right">🍽️ תפריט המנות</span>
                <UtensilsCrossed className="h-5 w-5" />
              </button>

              {dishesOpen && (
                <ul className="bg-background/40 border-y border-border">
                  <li>
                    <Link
                      to="/recipes"
                      onClick={() => openDishes("all")}
                      className={`flex items-center justify-end gap-3 px-8 py-4 text-base font-bold border-r-4 transition ${
                        isDishesView && menuCategory === "all"
                          ? "bg-neon/10 text-neon border-neon"
                          : "text-foreground border-transparent hover:text-neon"
                      }`}
                    >
                      <span className="flex-1 text-right">🍽️ כל המנות</span>
                    </Link>
                  </li>
                  {MENU_CATEGORIES.map((it) => {
                    const active = isDishesView && menuCategory === it.key;
                    return (
                      <li key={it.key}>
                        <Link
                          to="/recipes"
                          onClick={() => openDishes(it.key)}
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

            <li>
              <button
                type="button"
                onClick={() => setRecipesOpen((o) => !o)}
                aria-expanded={recipesOpen}
                className="w-full flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${recipesOpen ? "rotate-180" : ""}`}
                />
                <span className="flex-1 text-right">📋 כל המתכונים</span>
                <ChefHat className="h-5 w-5" />
              </button>

              {recipesOpen && (
                <ul className="bg-background/40 border-y border-border">
                  <li>
                    <Link
                      to="/recipes"
                      onClick={() => {
                        setCategory("all");
                        setDrawerOpen(false);
                      }}
                      className={`flex items-center justify-end gap-3 px-8 py-4 text-base font-bold border-r-4 transition ${
                        category === "all"
                          ? "bg-neon/10 text-neon border-neon"
                          : "text-foreground border-transparent hover:text-neon"
                      }`}
                    >
                      <span className="flex-1 text-right">📋 הצג הכל</span>
                    </Link>
                  </li>
                  {RECIPE_CATEGORIES.map((it) => {
                    const active = category === it.key;
                    return (
                      <li key={it.key}>
                        <Link
                          to="/recipes"
                          onClick={() => {
                            setCategory(it.key);
                            setDrawerOpen(false);
                          }}
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


            <li>
              <div className="mx-6 my-2 h-px bg-border/60" />
              <Link
                to="/notebook"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <span className="flex-1 text-right">📋 פנקס עבודה יומי</span>
                <NotebookPen className="h-5 w-5" />
              </Link>
              <Link
                to="/calendar"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <span className="flex-1 text-right">📅 לוח אירועים וסחורות</span>
                <CalendarDays className="h-5 w-5" />
              </Link>
              <Link
                to="/suppliers"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-end gap-3 px-6 py-5 text-lg font-bold text-foreground hover:bg-card hover:text-neon transition"
              >
                <span className="flex-1 text-right">🚚 ניהול ספקים</span>
                <Truck className="h-5 w-5" />
              </Link>
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
