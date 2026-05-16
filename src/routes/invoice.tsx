import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCookbookStore, type IngredientPrice } from "@/lib/store";

export const Route = createFileRoute("/invoice")({
  component: InvoicePage,
});

const mockInvoiceResults: IngredientPrice[] = [
  { name: "מיונז", unitPrice: 19.4, unit: "ק\"ג", updatedAt: "", source: "invoice-ai" },
  { name: "שמנת", unitPrice: 15.2, unit: "ליטר", updatedAt: "", source: "invoice-ai" },
  { name: "סוכר", unitPrice: 5.1, unit: "ק\"ג", updatedAt: "", source: "invoice-ai" },
  { name: "שמן זית", unitPrice: 42, unit: "ליטר", updatedAt: "", source: "invoice-ai" },
  { name: "פרמזן", unitPrice: 158, unit: "ק\"ג", updatedAt: "", source: "invoice-ai" },
  { name: "שום קלוף", unitPrice: 26, unit: "ק\"ג", updatedAt: "", source: "invoice-ai" },
  { name: "בייקון קצוץ", unitPrice: 82, unit: "ק\"ג", updatedAt: "", source: "invoice-ai" },
  { name: "חלב", unitPrice: 6.2, unit: "ליטר", updatedAt: "", source: "invoice-ai" },
];

function InvoicePage() {
  const [stage, setStage] = useState<"idle" | "loading" | "review">("idle");
  const [results, setResults] = useState<IngredientPrice[]>([]);
  const setPricesBulk = useCookbookStore((s) => s.setPricesBulk);
  const currentPrices = useCookbookStore((s) => s.prices);

  function simulateScan() {
    setStage("loading");
    setTimeout(() => {
      setResults(
        mockInvoiceResults.map((r) => ({ ...r, updatedAt: new Date().toISOString() })),
      );
      setStage("review");
    }, 2000);
  }

  function applyPrices() {
    setPricesBulk(results);
    setStage("idle");
    setResults([]);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
        AI Invoice Intake
      </div>
      <h1 className="font-display text-4xl font-bold mt-1">
        חשבונית <span className="text-neon text-glow-neon">חכמה</span>
      </h1>
      <p className="text-muted-foreground mt-2 text-sm mb-6">
        העלאת חשבונית סורקת מחירים חדשים ומעדכנת אוטומטית את עלויות המתכונים.
      </p>

      {stage === "idle" && (
        <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center bg-card/40">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-muted-foreground mb-4 text-sm">
            גרור חשבונית או לחץ לסריקה. במצב MVP — סריקה מדומה.
          </p>
          <button
            onClick={simulateScan}
            className="px-6 py-3 rounded-md bg-neon text-primary-foreground font-bold glow-neon"
          >
            סרוק חשבונית (Mock AI)
          </button>
        </div>
      )}

      {stage === "loading" && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="inline-block w-12 h-12 border-4 border-neon border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-bold">קורא חשבונית עם AI…</p>
          <p className="text-xs text-muted-foreground mt-1">מזהה מצרכים ומחירים</p>
        </div>
      )}

      {stage === "review" && (
        <div className="rounded-2xl border border-jungle/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-jungle">
              ✓ זוהו {results.length} מצרכים
            </h2>
            <button
              onClick={() => setStage("idle")}
              className="text-xs text-muted-foreground"
            >
              ביטול
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-muted-foreground border-b border-border">
                  <th className="py-2">מצרך</th>
                  <th className="py-2">מחיר ישן</th>
                  <th className="py-2">מחיר חדש</th>
                  <th className="py-2">שינוי</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const old = currentPrices[r.name];
                  const diff = old ? r.unitPrice - old.unitPrice : 0;
                  const pct = old ? (diff / old.unitPrice) * 100 : 0;
                  return (
                    <tr key={r.name} className="border-b border-border/40">
                      <td className="py-2 font-bold">{r.name}</td>
                      <td className="py-2 tabular-nums text-muted-foreground">
                        {old ? `₪${old.unitPrice}/${old.unit}` : "—"}
                      </td>
                      <td className="py-2 tabular-nums text-neon font-bold">
                        ₪{r.unitPrice}/{r.unit}
                      </td>
                      <td
                        className={`py-2 tabular-nums font-bold ${
                          diff > 0 ? "text-destructive" : diff < 0 ? "text-jungle" : "text-muted-foreground"
                        }`}
                      >
                        {old ? `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%` : "חדש"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={applyPrices}
            className="mt-5 w-full py-3 rounded-md bg-jungle text-jungle-foreground font-bold glow-jungle"
          >
            אשר ועדכן מחירים
          </button>
        </div>
      )}
    </div>
  );
}
