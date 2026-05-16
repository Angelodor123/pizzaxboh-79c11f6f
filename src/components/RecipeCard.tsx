import { useMemo, useState } from "react";
import { categoryLabels, type Recipe } from "@/lib/cookbook";
import { estimateRecipeCost, useCookbookStore } from "@/lib/store";
import { CountdownTimer } from "./CountdownTimer";

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

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const prices = useCookbookStore((s) => s.prices);

  const cost = useMemo(
    () => estimateRecipeCost(recipe, scale, prices),
    [recipe, scale, prices],
  );

  const scaledIngredients = recipe.ingredients.map((i) => ({
    ...i,
    quantity: i.quantity * scale,
  }));
  const scaledSpiceBag = recipe.spiceBag
    ? {
        ...recipe.spiceBag,
        totalWeightGrams: recipe.spiceBag.totalWeightGrams * scale,
        items: recipe.spiceBag.items.map((i) => ({
          ...i,
          quantity: i.quantity * scale,
        })),
      }
    : undefined;

  const isScaled = Math.abs(scale - 1) > 1e-6;

  function rescaleFromIngredient(originalQty: number, newQty: number) {
    if (originalQty <= 0 || !Number.isFinite(newQty) || newQty <= 0) return;
    setScale(newQty / originalQty);
  }

  return (
    <article className="rounded-2xl border border-border bg-card/80 backdrop-blur p-5 flex flex-col gap-4 hover:border-neon/60 transition">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-brand font-bold">
            {categoryLabels[recipe.category]}
          </div>
          <h3 className="font-display text-xl font-bold mt-1">{recipe.nameHebrew}</h3>
        </div>
        {recipe.textureTargetHebrew && (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-jungle/20 text-jungle border border-jungle/40">
            {recipe.textureTargetHebrew}
          </span>
        )}
      </header>

      <div className="rounded-lg bg-background/60 border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-muted-foreground">מכפיל באטץ׳</div>
          <div className="text-neon font-display font-bold text-lg tabular-nums">
            ×{formatNum(scale)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[0.5, 1, 2, 3, 5, 10].map((m) => (
            <button
              key={m}
              onClick={() => setScale(m)}
              className={`flex-1 py-2 rounded-md text-sm font-bold border transition ${
                Math.abs(scale - m) < 1e-6
                  ? "bg-neon text-primary-foreground border-neon glow-neon"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              ×{m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={Number(scale.toFixed(3))}
            onChange={(e) => setScale(Math.max(0.01, Number(e.target.value) || 1))}
            className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-right tabular-nums"
          />
          {isScaled && (
            <button
              onClick={() => setScale(1)}
              className="px-3 py-2 rounded-md text-xs font-bold bg-neon text-primary-foreground glow-neon whitespace-nowrap"
            >
              אפס למקור
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <section>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                מצרכים
              </h4>
              <span className="text-[10px] text-muted-foreground">
                ערוך כמות כדי להתאים את כל המתכון
              </span>
            </div>
            <ul className="space-y-1.5">
              {scaledIngredients.map((i, idx) => {
                const original = recipe.ingredients[idx];
                const display = formatQtyUnit(i.quantity, i.unit);
                return (
                  <li
                    key={i.name}
                    className="flex justify-between items-center gap-2 text-sm border-b border-border/50 pb-1.5"
                  >
                    <span style={{ color: "#F4F4F4" }} className="flex-1">
                      {i.name}
                    </span>
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={display.value}
                        onChange={(e) =>
                          rescaleFromIngredient(
                            original.unit === "גרם" && display.unit === 'ק"ג'
                              ? original.quantity / 1000
                              : original.unit === 'מ"ל' && display.unit === "ליטר"
                                ? original.quantity / 1000
                                : original.quantity,
                            Number(e.target.value),
                          )
                        }
                        className="w-20 bg-input border border-border rounded-md px-2 py-1 text-right text-neon font-bold tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {display.unit}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {scaledSpiceBag && (
            <section className="rounded-lg border border-amber-brand/40 bg-amber-brand/5 p-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-amber-brand">
                  {scaledSpiceBag.name}
                </h4>
                <span className="text-xs tabular-nums text-amber-brand font-bold">
                  סה״כ {formatQtyUnit(scaledSpiceBag.totalWeightGrams, "גרם").value}{" "}
                  {formatQtyUnit(scaledSpiceBag.totalWeightGrams, "גרם").unit}
                </span>
              </div>
              <ul className="space-y-1">
                {scaledSpiceBag.items.map((i) => {
                  const d = formatQtyUnit(i.quantity, i.unit);
                  return (
                    <li
                      key={i.name}
                      className="flex justify-between items-center gap-2 text-xs"
                    >
                      <span style={{ color: "#F4F4F4" }}>{i.name}</span>
                      <span className="tabular-nums">
                        <span className="text-neon font-bold">{d.value}</span>{" "}
                        <span className="text-muted-foreground">{d.unit}</span>
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
            <p className="text-sm leading-relaxed">{recipe.instructionsHebrew}</p>
            {recipe.techniqueNotesHebrew && (
              <p className="mt-2 text-xs text-amber-brand">
                ⚠ {recipe.techniqueNotesHebrew}
              </p>
            )}
          </section>

          {recipe.timerSeconds && (
            <CountdownTimer
              seconds={recipe.timerSeconds}
              label={`${recipe.timerSeconds >= 60 ? `${recipe.timerSeconds / 60} דקות` : `${recipe.timerSeconds} שניות`}`}
            />
          )}
        </>
      )}

      <footer className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-xs">
          <div className="text-muted-foreground">עלות חומר גלם משוערת</div>
          <div className="font-display font-bold text-jungle text-lg tabular-nums">
            ₪{cost.total.toFixed(2)}
          </div>
          {cost.unknown > 0 && (
            <div className="text-[10px] text-muted-foreground">
              {cost.unknown} מצרכים ללא מחיר
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="px-4 py-2 rounded-md border border-neon text-neon font-bold text-sm hover:bg-neon hover:text-primary-foreground transition"
        >
          {expanded ? "סגור" : "פתח מתכון"}
        </button>
      </footer>
    </article>
  );
}
