import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { categoryLabels, type Recipe } from "@/lib/cookbook";


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

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [alarming, setAlarming] = useState(false);

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

  function confirmEdits() {
    // Find first edited ingredient with a valid numeric value, derive new scale.
    for (const [idxStr, raw] of Object.entries(drafts)) {
      const idx = Number(idxStr);
      const original = recipe.ingredients[idx];
      if (!original) continue;
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
        {recipe.textureTargetHebrew && (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-jungle/20 text-jungle border border-jungle/40 whitespace-nowrap">
            {recipe.textureTargetHebrew}
          </span>
        )}
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
          <div className="flex items-center gap-2 flex-wrap">
            {[0.5, 1, 2, 3, 5, 10].map((m) => (
              <button
                key={m}
                onClick={() => setScale(m)}
                className={`flex-1 min-w-[44px] py-2 rounded-md text-sm font-bold border transition ${
                  Math.abs(scale - m) < 1e-6
                    ? "bg-neon text-primary-foreground border-neon glow-neon"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                ×{m}
              </button>
            ))}
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
                >
                  ערוך מתכון
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {scaledIngredients.map((i, idx) => {
                const display = formatQtyUnit(i.quantity, i.unit);
                const draft = drafts[idx];
                const shownValue = draft !== undefined ? draft : display.value;
                return (
                  <li
                    key={i.name}
                    className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-2"
                  >
                    <span style={{ color: "#F4F4F4" }} className="flex-1 min-w-0 break-words">
                      {i.name}
                    </span>
                    <div className="flex items-center gap-2 tabular-nums shrink-0">
                      {editing ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={shownValue}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [idx]: e.target.value }))
                          }
                          className="w-20 bg-input border border-neon/60 rounded-md px-2 py-1 text-right text-neon font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-neon"
                        />
                      ) : (
                        <span className="w-20 px-2 py-1 text-right text-neon font-bold">
                          {display.value}
                        </span>
                      )}
                      <span
                        style={{ color: "#F4F4F4" }}
                        className="text-xs w-14 text-right opacity-70"
                      >
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
                      className="flex justify-between items-center gap-2 text-xs"
                    >
                      <span style={{ color: "#F4F4F4" }}>{i.name}</span>
                      <span className="tabular-nums">
                        <span className="text-neon font-bold">{d.value}</span>{" "}
                        <span style={{ color: "#F4F4F4" }} className="opacity-70">
                          {d.unit}
                        </span>
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
