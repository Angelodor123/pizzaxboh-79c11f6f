import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { categoryLabels, getRecipeSpeed, type Recipe } from "@/lib/cookbook";


import { useAuth } from "@/lib/auth";
import { CountdownTimer } from "./CountdownTimer";

const EDITOR_EMAIL = "dorbareket123@gmail.com";

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
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [alarming, setAlarming] = useState(false);

  const scaledIngredients = recipe.ingredients.map((i) => ({
    ...i,
    quantity: isScalable(i.unit) ? i.quantity * scale : i.quantity,
  }));
  const scaledSpiceBag = recipe.spiceBag
    ? {
        ...recipe.spiceBag,
        totalWeightGrams: recipe.spiceBag.totalWeightGrams * scale,
        items: recipe.spiceBag.items.map((i) => ({
          ...i,
          quantity: isScalable(i.unit) ? i.quantity * scale : i.quantity,
        })),
      }
    : undefined;

  const isScaled = Math.abs(scale - 1) > 1e-6;

  function confirmEdits() {
    // Find first edited ingredient with a valid numeric value, derive new scale.
    for (const [idxStr, raw] of Object.entries(drafts)) {
      const idx = Number(idxStr);
      const original = recipe.ingredients[idx];
      if (!original) continue;
      if (!isScalable(original.unit)) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) continue;
      const display = formatQtyUnit(original.quantity, original.unit);
      // Convert input back to original unit baseline
      let newInOriginalUnit = n;
      if (original.unit === "גרם" && display.unit === 'ק"ג') {
        newInOriginalUnit = n * 1000;
      } else if (original.unit === 'מ"ל' && display.unit === "ליטר") {
        newInOriginalUnit = n * 1000;
      }
      if (original.quantity > 0) {
        setScale(newInOriginalUnit / original.quantity);
        break;
      }
    }
    setDrafts({});
    setEditing(false);
  }

  function cancelEdits() {
    setDrafts({});
    setEditing(false);
  }

  const { email } = useAuth();
  const canEdit = email === EDITOR_EMAIL;
  const speed = getRecipeSpeed(recipe);

  return (
    <article
      className={`rounded-2xl border border-border bg-card/80 backdrop-blur p-4 sm:p-5 flex flex-col gap-3 hover:border-neon/60 transition ${
        alarming ? "pulse-alarm" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-brand font-bold">
            {categoryLabels[recipe.category]}
          </div>
          <h3 className="font-display text-xl font-bold mt-1 break-words">
            {recipe.nameHebrew}
          </h3>
        </div>
        <span
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${speed.className}`}
          title={`קצב הכנה: ${speed.label}`}
        >
          {speed.emoji} {speed.shortLabel}
        </span>
      </header>

      {expanded && (
        <div className="rounded-lg bg-background/60 border border-border p-3">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="text-xs font-bold text-muted-foreground">
              כמות הכנה
            </div>
            <div className="text-neon font-display font-bold text-lg tabular-nums">
              ×{formatNum(scale)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0.5, 1, 2, 3, 5, 10].map((m) => (
              <button
                key={m}
                onClick={() => setScale(m)}
                className={`py-2 rounded-md text-sm font-bold border transition ${
                  Math.abs(scale - m) < 1e-6
                    ? "bg-neon text-primary-foreground border-neon glow-neon"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                ×{m}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              מכפיל מותאם:
            </label>
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-2 flex items-center text-muted-foreground text-sm pointer-events-none">
                ×
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={scale}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v > 0) setScale(v);
                }}
                className="w-full bg-background border border-border rounded-md py-2 pr-7 pl-2 text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-neon"
              />
            </div>
          </div>
          {isScaled && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setScale(1);
                  setDrafts({});
                }}
                className="px-3 py-2 rounded-md text-xs font-bold bg-neon text-primary-foreground glow-neon"
              >
                אפס למקור
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <>
          <section>
            <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                מצרכים
              </h4>
              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdits}
                    className="px-3 py-1.5 rounded-md text-xs font-bold border border-border text-muted-foreground"
                  >
                    בטל
                  </button>
                  <button
                    onClick={confirmEdits}
                    style={{ backgroundColor: "#228B22" }}
                    className="px-4 py-1.5 rounded-md text-xs font-bold text-white glow-jungle"
                  >
                    אישור
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-bold border border-neon text-neon hover:bg-neon hover:text-primary-foreground transition"
                  title="חישוב מחדש של כל הכמויות לפי כמות שתזין למרכיב אחד (לא נשמר)"
                >
                  התאם כמויות
                </button>
              )}
            </div>
          <ul className="space-y-1.5">
            {scaledIngredients.map((i, idx) => {
              const display = formatQtyUnit(i.quantity, i.unit);
              const draft = drafts[idx];
              const shownValue = draft !== undefined ? draft : display.value;
              return (
                <li
                  key={i.name}
                  className="flex items-stretch gap-2 rounded-lg bg-background/40 border border-border/60 p-2 hover:border-neon/40 transition"
                >
                  <div className="flex flex-col items-center justify-center shrink-0 w-[72px] px-2 rounded-md bg-neon/10 border border-neon/30">
                    {editing && isScalable(i.unit) ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={shownValue}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [idx]: e.target.value }))
                        }
                        className="w-full min-w-0 bg-transparent border-b border-neon/60 text-center text-neon font-display font-bold text-lg tabular-nums focus:outline-none"
                      />
                    ) : (
                      <span className="text-neon font-display font-bold text-lg tabular-nums leading-tight">
                        {display.value}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-neon/80 uppercase tracking-wide mt-0.5">
                      {display.unit}
                    </span>
                  </div>
                  <span
                    style={{ color: "#F4F4F4" }}
                    className="flex-1 min-w-0 break-words text-sm self-center"
                  >
                    {i.name}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {scaledSpiceBag && (
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
            <p className="text-sm leading-relaxed whitespace-pre-line">{recipe.instructionsHebrew}</p>
            {recipe.techniqueNotesHebrew && (
              <p className="mt-2 text-xs text-amber-brand">
                ⚠ {recipe.techniqueNotesHebrew}
              </p>
            )}
          </section>

          {recipe.timerSeconds && (
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
        </>
      )}

      <footer className="flex items-center justify-center gap-2 pt-3 border-t border-border">
        <button
          onClick={() => {
            setExpanded((x) => !x);
            if (expanded) {
              setEditing(false);
              setDrafts({});
            }
          }}
          className="w-4/5 px-4 py-2 rounded-md border border-neon text-neon font-bold text-sm hover:bg-neon hover:text-primary-foreground transition"
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
