import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  categoryLabels,
  getRecipeSpeed,
  DEFAULT_SHELF_LIFE,
  type Recipe,
} from "@/lib/cookbook";


import { useAuth } from "@/lib/auth";
import { useUIStore } from "@/lib/ui-store";
import { useRecipeProgressStore } from "@/lib/notebook-store";
import { CountdownTimer } from "./CountdownTimer";

// canEdit is derived from the authenticated user's role (admin) — see below.

function formatNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, "");
}

// Auto-promote grams→kg and ml→liters when value ≥ 1000.
function formatQtyUnit(quantity: number, unit: string): { value: string; unit: string } {
  if (unit === "גרם" && quantity >= 1000) {
    return { value: formatNum(quantity / 1000), unit: 'ק"ג' };
  }
  if (unit === 'מ"ל' && quantity >= 1000) {
    return { value: formatNum(quantity / 1000), unit: "ליטר" };
  }
  return { value: formatNum(quantity), unit };
}

// Units that represent non-quantifiable amounts — not scaled, not editable.
const NON_SCALABLE_UNITS = new Set(["חופן", "לפי טעם"]);
function isScalable(unit: string) {
  return !NON_SCALABLE_UNITS.has(unit);
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [expanded, setExpanded] = useState(false);
  const [alarming, setAlarming] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#recipe-${recipe.id}`) {
      setExpanded(true);
      const el = document.getElementById(`recipe-${recipe.id}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [recipe.id]);

  const scaledIngredients = recipe.ingredients;
  const scaledSpiceBag = recipe.spiceBag;

  const { role } = useAuth();
  const isServiceMode = useUIStore((s) => s.isServiceMode);
  const canEdit = role === "admin" && !isServiceMode;
  const speed = getRecipeSpeed(recipe);
  const shelfLife = recipe.shelfLifeHebrew?.trim() || DEFAULT_SHELF_LIFE;

  const checkedIndices = useRecipeProgressStore((s) => s.checked[recipe.id]);
  const toggleIngredient = useRecipeProgressStore((s) => s.toggleIngredient);
  const resetRecipe = useRecipeProgressStore((s) => s.resetRecipe);
  const isChecked = (idx: number) => !!checkedIndices?.includes(idx);

  const handleComplete = () => {
    resetRecipe(recipe.id);
    toast.success("ההכנה הושלמה! שלבי ההכנה אופסו", { duration: 2500 });
  };

  // In service mode, scale typography up ~20% for at-a-glance reading.
  const titleClass = isServiceMode
    ? "font-display text-2xl sm:text-3xl font-bold mt-1 break-words"
    : "font-display text-xl font-bold mt-1 break-words";
  const ingredientTextClass = isServiceMode
    ? "flex-1 min-w-0 break-words text-base sm:text-lg self-center font-semibold"
    : "flex-1 min-w-0 break-words text-sm self-center";
  const instructionsClass = isServiceMode
    ? "text-base sm:text-lg leading-relaxed whitespace-pre-line font-medium"
    : "text-sm leading-relaxed whitespace-pre-line";

  return (
    <article
      className={`rounded-2xl border bg-card/80 backdrop-blur p-4 sm:p-5 flex flex-col gap-3 transition ${
        isServiceMode
          ? "border-orange-500/60 hover:border-orange-400"
          : "border-border hover:border-neon/60"
      } ${alarming ? "pulse-alarm" : ""}`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-brand font-bold">
            {categoryLabels[recipe.category]}
          </div>
          <h3 className={titleClass}>{recipe.nameHebrew}</h3>
        </div>
        <span
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${speed.className}`}
          title={`קצב הכנה: ${speed.label}`}
        >
          {speed.emoji} {speed.shortLabel}
        </span>
      </header>


      {expanded && (
        <>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              isServiceMode
                ? "border-orange-500/50 bg-orange-500/10"
                : "border-amber-brand/40 bg-amber-brand/5"
            }`}
          >
            <Clock
              className={`h-4 w-4 shrink-0 ${
                isServiceMode ? "text-orange-300" : "text-amber-brand"
              }`}
            />
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                חיי מדף
              </div>
              <div
                className={`text-sm font-bold ${
                  isServiceMode ? "text-orange-200" : "text-amber-brand"
                }`}
              >
                {shelfLife}
              </div>
            </div>
          </div>

          <section>
            <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                מצרכים
              </h4>
            </div>
          <ul className="space-y-1.5">
            {scaledIngredients.map((i, idx) => {
              const display = formatQtyUnit(i.quantity, i.unit);
              return (
                <li
                  key={i.name}
                  className={`flex items-stretch gap-2 rounded-lg bg-background/40 border border-border/60 p-2 hover:border-neon/40 transition ${
                    isChecked(idx) ? "opacity-40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleIngredient(recipe.id, idx)}
                    aria-pressed={isChecked(idx)}
                    aria-label={isChecked(idx) ? "בטל סימון" : "סמן כהוכן"}
                    className={`shrink-0 self-center grid place-content-center h-6 w-6 rounded border-2 transition ${
                      isChecked(idx)
                        ? "bg-neon border-neon glow-neon"
                        : "border-neon/50 hover:border-neon"
                    }`}
                  >
                    {isChecked(idx) && (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-4 w-4 text-primary-foreground"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M3 8l3.5 3.5L13 5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex flex-col items-center justify-center shrink-0 w-[72px] px-2 rounded-md bg-neon/10 border border-neon/30">
                    <span
                      className={`text-neon font-display font-bold tabular-nums leading-tight ${
                        isServiceMode ? "text-xl" : "text-lg"
                      }`}
                    >
                      {display.value}
                    </span>
                    <span className="text-[10px] font-bold text-neon/80 uppercase tracking-wide mt-0.5">
                      {display.unit}
                    </span>
                  </div>
                  <span
                    style={{ color: "#F4F4F4" }}
                    className={`${ingredientTextClass} ${
                      isChecked(idx) ? "line-through" : ""
                    }`}
                  >
                    {i.name}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {scaledSpiceBag && !isServiceMode && (
          <section className="rounded-lg border border-amber-brand/40 bg-amber-brand/5 p-3">
            <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-amber-brand">
                {scaledSpiceBag.name}
              </h4>
              <span className="text-xs tabular-nums text-amber-brand font-bold">
                סה״כ {formatQtyUnit(scaledSpiceBag.totalWeightGrams, "גרם").value}{" "}
                {formatQtyUnit(scaledSpiceBag.totalWeightGrams, "גרם").unit}
              </span>
            </div>
            <ul className="space-y-1.5">
              {scaledSpiceBag.items.map((i) => {
                const d = formatQtyUnit(i.quantity, i.unit);
                return (
                  <li
                    key={i.name}
                    className="flex items-center gap-2 text-xs bg-background/30 rounded-md px-2 py-1.5"
                  >
                    <span className="shrink-0 min-w-[58px] text-center px-1.5 py-0.5 rounded bg-amber-brand/15 border border-amber-brand/30">
                      <span className="text-amber-brand font-bold tabular-nums">{d.value}</span>
                      <span className="text-amber-brand/70 mr-1 text-[10px]">{d.unit}</span>
                    </span>
                    <span style={{ color: "#F4F4F4" }} className="flex-1 min-w-0 break-words">
                      {i.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              הוראות הכנה
            </h4>
            <p className={instructionsClass}>{recipe.instructionsHebrew}</p>
            {recipe.techniqueNotesHebrew && !isServiceMode && (
              <p className="mt-2 text-xs text-amber-brand">
                ⚠ {recipe.techniqueNotesHebrew}
              </p>
            )}
          </section>

          {recipe.timerSeconds && !isServiceMode && (
            <CountdownTimer
              seconds={recipe.timerSeconds}
              label={`${
                recipe.timerSeconds >= 60
                  ? `${recipe.timerSeconds / 60} דקות`
                  : `${recipe.timerSeconds} שניות`
              }`}
              onAlarmChange={setAlarming}
            />
          )}

          <button
            type="button"
            onClick={handleComplete}
            className="w-full inline-flex items-center justify-center gap-2 bg-neon text-primary-foreground font-bold text-base px-4 py-3 rounded-lg glow-neon hover:opacity-95 transition"
          >
            <CheckCircle2 className="h-5 w-5" />
            מתכון מוכן
          </button>
        </>
      )}

      <footer className="flex items-center justify-center gap-2 pt-3 border-t border-border" id={`recipe-${recipe.id}`}>
        <button
          onClick={() => {
            setExpanded((x) => {
              const next = !x;
              if (next) {
                useUIStore.getState().setLastRecipe(recipe.id, recipe.nameHebrew);
              }
              return next;
            });
            if (expanded) {
              setEditing(false);
              setDrafts({});
            }
          }}
          className={`w-4/5 px-4 py-2 rounded-md border font-bold text-sm transition ${
            isServiceMode
              ? "border-orange-500 text-orange-300 hover:bg-orange-500 hover:text-background"
              : "border-neon text-neon hover:bg-neon hover:text-primary-foreground"
          }`}
        >
          {expanded ? "סגור" : "פתח מתכון"}
        </button>
        {canEdit && (
          <Link
            to="/admin"
            search={{ edit: recipe.id }}
            aria-label="ערוך מתכון"
            title="ערוך מתכון"
            className="shrink-0 p-2 rounded-md border border-border text-muted-foreground hover:text-neon hover:border-neon transition"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        )}
      </footer>
    </article>
  );
}
