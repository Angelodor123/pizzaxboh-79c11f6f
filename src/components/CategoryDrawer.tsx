import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
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

        {/* Sticky footer: View As (super admins only) + email + logout */}
        <div className="sticky bottom-0 border-t border-zinc-800/60 bg-[#18181b]">
          {realIsSuperAdmin && (
            <div className="px-6 pt-3 pb-2 border-b border-zinc-800/40">
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500 mb-1.5 text-right">
                תצוגת ממשק:
              </div>
              <div
                role="group"
                aria-label="תצוגת ממשק"
                className="flex items-stretch rounded-md bg-zinc-800/50 border border-zinc-700/60 p-0.5 text-xs"
                dir="rtl"
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
                      className={`flex-1 px-2 py-1.5 rounded-[5px] font-bold transition-colors ${
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
                <div className="mt-1.5 text-[10px] text-neon/80 text-right">
                  מצב סימולציה פעיל
                </div>
              )}
            </div>
          )}
          <div className="px-6 py-4 space-y-3">
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
                    className="p-1.5 rounded-md border border-neon/50 text-neon hover:bg-neon/10 active:scale-95 transition disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    aria-label="ביטול"
                    className="p-1.5 rounded-md border border-zinc-700 text-muted-foreground hover:text-foreground active:scale-95 transition"
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
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground group-hover:text-neon transition shrink-0" />
                  <span className="text-sm font-bold text-foreground truncate group-hover:text-neon transition">
                    {fullName?.trim() || "הוסף את שמך"}
                  </span>
                </button>
              )}
              {email && (
                <div className="text-[11px] text-muted-foreground truncate text-right mt-1">
                  {email}
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                close();
                await signOut();
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-foreground hover:text-neon border border-zinc-800 rounded-md py-2 transition"
            >
              <LogOut className="h-4 w-4" />
              התנתק
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
