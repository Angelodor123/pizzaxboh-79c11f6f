import { useState, useEffect, useMemo } from "react";
import { useCookbookStore } from "@/lib/store";
import { recipeToMenuCategory, isMenuItem } from "@/lib/menu-categories";
import { Pencil, Check, X, Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  UserCircle,
  Wrench,
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

// Static catalog of all known categories — actual sidebar list is filtered
// dynamically below based on what's present in the live recipes table.
const ALL_RECIPE_CATEGORIES = BACK_OF_HOUSE_CATEGORIES.map((key) => ({
  key,
  emoji: RECIPE_EMOJI[key],
  label: categoryLabels[key],
}));

const ALL_MENU_CATEGORIES = menuCategoryOrder.map((key) => ({
  key,
  emoji: menuCategoryEmoji[key],
  label: menuCategoryLabels[key],
}));

// Shared item classes for consistent padding + modern hover.
// RTL: text anchors to the right (start), icon anchors to the far left (end).
const itemClass =
  "flex w-full items-center justify-between gap-3 px-4 py-2 mx-2 my-0.5 rounded-lg text-base font-bold text-foreground hover:bg-zinc-800/80 hover:text-neon transition-colors";

const iconWrap = "w-6 flex justify-center shrink-0";

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
    session,
    email,
    fullName,
    role,
    isSuperAdmin: effIsSuperAdmin,
    realIsSuperAdmin,
    simulatedRole,
    setSimulatedRole,
    signOut,
    refreshRole,
  } = useAuth();
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [dishesOpen, setDishesOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();

  // Dynamically filter sidebar categories to only those with ≥1 active item
  // in the live recipes store. Empty categories are hidden entirely.
  const recipes = useCookbookStore((s) => s.recipes);
  const { RECIPE_CATEGORIES, MENU_CATEGORIES } = useMemo(() => {
    const active = recipes.filter((r) => !r.deleted);
    const recipeCounts = new Map<RecipeCategory, number>();
    const menuCounts = new Map<MenuCategory, number>();
    for (const r of active) {
      if (isMenuItem(r)) {
        const mc = recipeToMenuCategory(r);
        menuCounts.set(mc, (menuCounts.get(mc) ?? 0) + 1);
      } else {
        recipeCounts.set(r.category, (recipeCounts.get(r.category) ?? 0) + 1);
      }
    }
    return {
      RECIPE_CATEGORIES: ALL_RECIPE_CATEGORIES.filter((c) => (recipeCounts.get(c.key) ?? 0) > 0),
      MENU_CATEGORIES: ALL_MENU_CATEGORIES.filter((c) => (menuCounts.get(c.key) ?? 0) > 0),
    };
  }, [recipes]);

  useEffect(() => {
    if (!editingName) setNameDraft(fullName ?? "");
  }, [fullName, editingName]);

  const saveName = async () => {
    const userId = session?.user?.id;
    const next = nameDraft.trim();
    if (!userId || !next || next === (fullName ?? "")) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: next })
      .eq("user_id", userId);
    setSavingName(false);
    if (error) {
      toast.error("שגיאה בעדכון השם");
      return;
    }
    await refreshRole();
    toast.success("השם עודכן");
    setEditingName(false);
  };

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
        <SheetHeader className="px-6 py-5 pl-14 border-b border-zinc-800/60 flex flex-row items-center justify-between gap-4 text-right space-y-0">
          <SheetTitle className="font-display text-xl text-foreground flex-1 text-right">
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
                <span className={iconWrap}><Home className="h-5 w-5" /></span>
              </Link>
            </li>



            <li>
              <Link to="/tasks" onClick={close} className={itemClass}>
                <span className="flex-1 text-right">✅ משימות יומיות</span>
                <span className={iconWrap}><ListChecks className="h-5 w-5" /></span>
              </Link>
            </li>
            <li>
              <Link to="/notebook" onClick={close} className={itemClass}>
                <span className="flex-1 text-right">📋 פנקס עבודה יומי</span>
                <span className={iconWrap}><NotebookPen className="h-5 w-5" /></span>
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
                <span className={iconWrap}><UtensilsCrossed className="h-5 w-5" /></span>
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
                <span className={iconWrap}><ChefHat className="h-5 w-5" /></span>
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
                    <span className={iconWrap}><Package className="h-5 w-5" /></span>
                  </Link>
                </li>
                <li>
                  <Link to="/calendar" onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">
                      📅 לוח אירועים וסחורות
                    </span>
                    <span className={iconWrap}><CalendarDays className="h-5 w-5" /></span>
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
                    <span className={iconWrap}><Truck className="h-5 w-5" /></span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin" search={{ edit: undefined }} onClick={close} className={itemClass}>
                    <span className="flex-1 text-right">
                      ⚙️ הגדרות מערכת וצוות
                    </span>
                    <span className={iconWrap}><Settings className="h-5 w-5" /></span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Sticky footer: View As (super admins only) + name + logout */}
        <div className="sticky bottom-0 border-t border-zinc-800/60 bg-[#18181b]">
          {realIsSuperAdmin && (
            <div className="px-3 py-1.5 border-b border-zinc-800/40 flex items-center gap-2" dir="rtl">
              <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 shrink-0">
                תצוגה:
              </span>
              <div
                role="group"
                aria-label="תצוגת ממשק"
                className="flex-1 flex items-stretch rounded-md bg-zinc-800/50 border border-zinc-700/60 p-0.5 text-xs"
              >
                {(
                  [
                    { key: "super_admin", label: "סופר אדמין" },
                    { key: "manager", label: "מנהל" },
                    { key: "employee", label: "עובד" },
                  ] as const
                ).map((opt) => {
                  const active =
                    (simulatedRole ?? "super_admin") === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        setSimulatedRole(
                          opt.key === "super_admin" ? null : opt.key,
                        )
                      }
                      className={`flex-1 px-1 py-1 rounded-[4px] font-bold transition-colors text-[11px] whitespace-nowrap ${
                        active
                          ? "bg-neon text-primary-foreground shadow-sm"
                          : "text-zinc-300 hover:bg-zinc-700/60"
                      }`}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {simulatedRole && (
                <span className="text-[9px] text-neon/80 shrink-0">סימולציה</span>
              )}
            </div>
          )}
          <div className="px-4 py-2 space-y-1.5">
            {/* Name editor */}
            <div dir="rtl">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    placeholder="השם שלך"
                    className="flex-1 min-w-0 bg-zinc-900 border border-neon/50 rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-neon/40 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={savingName}
                    aria-label="שמור שם"
                    className="p-1 rounded-md border border-neon/50 text-neon hover:bg-neon/10 active:scale-95 transition disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    aria-label="ביטול"
                    className="p-1 rounded-md border border-zinc-700 text-muted-foreground hover:text-foreground active:scale-95 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(fullName ?? "");
                    setEditingName(true);
                  }}
                  className="w-full flex items-center justify-between gap-2 group text-right"
                  aria-label="ערוך את השם שלך"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-neon transition shrink-0" />
                  <span className="text-sm font-bold text-foreground truncate group-hover:text-neon transition leading-tight">
                    {fullName?.trim() || "הוסף את שמך"}
                  </span>
                </button>
              )}
              {email && (
                <div className="text-[10px] text-muted-foreground truncate text-right leading-tight">
                  {email}
                </div>
              )}
            </div>

            {canInstall && (
              <button
                onClick={() => void promptInstall()}
                className="w-full text-pink-500 border border-pink-500/30 hover:bg-pink-500/10 rounded-lg py-2 px-4 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
              >
                <Download className="h-4 w-4" />
                התקן אפליקציה
              </button>
            )}

            <Link
              to="/my-profile"
              onClick={close}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-neon border border-neon/40 hover:bg-neon/10 rounded-md py-1.5 transition"
            >
              <UserCircle className="h-3.5 w-3.5" />
              האזור האישי שלי
            </Link>

            <button
              onClick={async () => {
                close();
                await signOut();
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-foreground hover:text-neon border border-zinc-800 rounded-md py-1.5 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              התנתק
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
