import { useMemo, useState } from "react";
import { categoryLabels, type Recipe } from "@/lib/cookbook";
import { estimateRecipeCost, useCookbookStore } from "@/lib/store";
import { CountdownTimer } from "./CountdownTimer";

function formatQty(q: number): string {
  const r = Math.round(q * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
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

  return (
    <article className="rounded-2xl border border-border bg-card/80 backdrop-blur p-5 flex flex-col gap-4 hover:border-neon/60 transition">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-brand font-bold">
            {categoryLabels[recipe.category]}
          </div>
          <h3 className="font-display text-xl font-bold mt-1">{recipe.nameHebrew}</h3>
          <div className="text-xs text-muted-foreground mt-1">
            תפוקה בסיסית: {recipe.baseYieldHebrew}
          </div>
        </div>
        {recipe.textureTargetHebrew && (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-jungle/20 text-jungle border border-jungle/40">
            {recipe.textureTargetHebrew}
          </span>
        )}
      </header>

      <div className="rounded-lg bg-background/60 border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-muted-foreground">
            מכפיל באטץ׳
          </div>
          <div className="text-neon font-display font-bold text-lg tabular-nums">
            ×{scale}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[0.5, 1, 2, 3, 5, 10].map((m) => (
            <button
              key={m}
              onClick={() => setScale(m)}
              className={`flex-1 py-2 rounded-md text-sm font-bold border transition ${
                scale === m
                  ? "bg-neon text-primary-foreground border-neon glow-neon"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              ×{m}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={scale}
          onChange={(e) => setScale(Math.max(0.1, Number(e.target.value) || 1))}
          className="mt-2 w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-right tabular-nums"
        />
      </div>

      {expanded && (
        <>
          <section>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              מצרכים
            </h4>
            <ul className="space-y-1.5">
              {scaledIngredients.map((i) => (
                <li
                  key={i.name}
                  className="flex justify-between items-center text-sm border-b border-border/50 pb-1.5"
                >
                  <span>{i.name}</span>
                  <span className="font-bold tabular-nums text-neon-soft">
                    {formatQty(i.quantity)} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {scaledSpiceBag && (
            <section className="rounded-lg border border-amber-brand/40 bg-amber-brand/5 p-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-amber-brand">
                  {scaledSpiceBag.name}
                </h4>
                <span className="text-xs tabular-nums text-amber-brand font-bold">
                  סה״כ {formatQty(scaledSpiceBag.totalWeightGrams)} גרם
                </span>
              </div>
              <ul className="space-y-1">
                {scaledSpiceBag.items.map((i) => (
                  <li
                    key={i.name}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{i.name}</span>
                    <span className="tabular-nums">
                      {formatQty(i.quantity)} {i.unit}
                    </span>
                  </li>
                ))}
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
