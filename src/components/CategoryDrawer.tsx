import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  Settings,
  LogOut,
  ChevronDown,
  NotebookPen,
  CalendarDays,
  Truck,
  Home,
  ChefHat,
  UtensilsCrossed,
  ListChecks,
  Package,
} from "lucide-react";
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

// Shared item classes for consistent padding + modern hover.
const itemClass =
  "flex items-center justify-end gap-3 px-4 py-2 mx-2 my-0.5 rounded-lg text-base font-bold text-foreground hover:bg-zinc-800/80 hover:text-neon transition-colors";

const groupLabelClass =
  "text-zinc-500 text-xs font-bold mb-2 px-4 pt-3 uppercase tracking-wider text-right";

function GroupDivider() {
  return <div className="border-t border-zinc-800/50 mx-2 my-2" />;
}

export function CategoryDrawer() {
  const {
    category,
    menuCategory,
    drawerOpen,
    setCategory,
    openDishes,
    setDrawerOpen,
  } = useUIStore();
  const {
    email,
    role,
    isSuperAdmin: effIsSuperAdmin,
    realIsSuperAdmin,
    simulatedRole,
    setSimulatedRole,
    signOut,
  } = useAuth();
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [dishesOpen, setDishesOpen] = useState(false);

  // Effective role mapping for menu visibility. Uses the *effective* values
  // from useAuth() so "View As" simulation immediately rewires the menu.
  // - admin role + super admin flag → super_admin (all groups)
  // - admin role only               → manager     (groups A + B)
  // - viewer / null                 → employee    (group A only)
  const isSuperAdmin = effIsSuperAdmin;
  const isManager = role === "admin" && !effIsSuperAdmin;
  const canSeeLogistics = isSuperAdmin || isManager;
  const canSeeManagement = isSuperAdmin;
  const isDishesView = category === "dishes";
  const close = () => setDrawerOpen(false);

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
        className="bg-[#18181b] border-l border-zinc-800/60 w-[88%] sm:w-80 p-0 flex flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <SheetHeader className="px-6 py-5 border-b border-zinc-800/60 text-right">
          <SheetTitle className="font-display text-xl text-foreground">
            תפריט
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-2">
          {/* ───── Group A: מטבח ותפעול ───── */}
          <div className={groupLabelClass}>מטבח ותפעול</div>
          <ul className="flex flex-col">
            <li>
              <Link to="/" onClick={close} className={itemClass}>
                <span className="flex-1 text-right">🏠 דף הבית</span>
                <Home className="h-5 w-5" />
              </Link>
            </li>
            <li>
              <Link to="/tasks" onClick={close} className={itemClass}>
                <span className="flex-1 text-right">✅ משימות יומיות</span>
                <ListChecks className="h-5 w-5" />
              </Link>
            </li>
            <li>
              <Link to="/notebook" onClick={close} className={itemClass}>
                <span className="flex-1 text-right">📋 פנקס עבודה יומי</span>
                <NotebookPen className="h-5 w-5" />
              </Link>
            </li>

            <li>
              <button
                type="button"
                onClick={() => setDishesOpen((o) => !o)}
                aria-expanded={dishesOpen}
                className={`w-full ${itemClass} ${
                  isDishesView ? "bg-neon/10 text-neon" : ""
                }`}
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    dishesOpen ? "rotate-180" : ""
                  }`}
                />
                <span className="flex-1 text-right">🍽️ תפריט המנות</span>
                <UtensilsCrossed className="h-5 w-5" />
              </button>
              {dishesOpen && (
                <ul className="bg-background/40 border-y border-zinc-800/50 my-1">
                  <li>
                    <Link
                      to="/recipes"
                      onClick={() => openDishes("all")}
                      className={`flex items-center justify-end gap-3 px-8 py-3 text-sm font-bold border-r-4 transition ${
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
                          className={`flex items-center justify-end gap-3 px-8 py-3 text-sm font-bold border-r-4 transition ${
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
                className={`w-full ${itemClass}`}
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    recipesOpen ? "rotate-180" : ""
                  }`}
                />
                <span className="flex-1 text-right">📖 ספר מתכונים</span>
                <ChefHat className="h-5 w-5" />
              </button>
              {recipesOpen && (
                <ul className="bg-background/40 border-y border-zinc-800/50 my-1">
                  <li>
                    <Link
                      to="/recipes"
                      onClick={() => {
                        setCategory("all");
                        close();
                      }}
                      className={`flex items-center justify-end gap-3 px-8 py-3 text-sm font-bold border-r-4 transition ${
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
                            close();
                          }}
                          className={`flex items-center justify-end gap-3 px-8 py-3 text-sm font-bold border-r-4 transition ${
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
          </ul>

          {/* ───── Group B: לוגיסטיקה ───── */}
          {canSeeLogistics && (
            <>
              <GroupDivider />
              <div className={groupLabelClass}>לוגיסטיקה</div>
              <ul className="flex flex-col">
                <li>
                  <Link to="/orders" onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">
                      📦 הזמנות וקבלת סחורה
                    </span>
                    <Package className="h-5 w-5" />
                  </Link>
                </li>
                <li>
                  <Link to="/calendar" onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">
                      📅 לוח אירועים וסחורות
                    </span>
                    <CalendarDays className="h-5 w-5" />
                  </Link>
                </li>
              </ul>
            </>
          )}

          {/* ───── Group C: הנהלה ───── */}
          {canSeeManagement && (
            <>
              <GroupDivider />
              <div className={groupLabelClass}>הנהלה</div>
              <ul className="flex flex-col">
                <li>
                  <Link to="/suppliers" onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">🚚 ניהול ספקים</span>
                    <Truck className="h-5 w-5" />
                  </Link>
                </li>
                <li>
                  <Link to="/admin" onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">
                      ⚙️ הגדרות מערכת וצוות
                    </span>
                    <Settings className="h-5 w-5" />
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Sticky footer: email + logout */}
        <div className="sticky bottom-0 border-t border-zinc-800/60 bg-[#18181b] px-6 py-4 flex items-center justify-between gap-3">
          {email && (
            <div className="text-[11px] text-muted-foreground truncate text-right flex-1">
              {email}
            </div>
          )}
          <button
            onClick={async () => {
              close();
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
