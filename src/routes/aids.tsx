import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Info, ChevronDown, Package } from "lucide-react";
import { SUPPLIER_AIDS, type SupplierAid } from "@/lib/aids-suppliers";

export const Route = createFileRoute("/aids")({
  head: () => ({
    meta: [
      { title: "עזרים — תקני ספקים" },
      { name: "description", content: "קטלוג ספקים ותקני הזמנה תפעוליים." },
    ],
  }),
  component: AidsPage,
});

function AidsPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(SUPPLIER_AIDS[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPLIER_AIDS;
    return SUPPLIER_AIDS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.rows.some((r) => r.name.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-neon/10 text-neon">
              <Package className="h-6 w-6" />
            </span>
            עזרים — תקני ספקים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            קטלוג ספקים, מוצרים ותקני הזמנה. חיפוש לפי שם ספק, קטגוריה או מוצר.
          </p>
        </header>

        <div className="relative mb-5">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש ספק / מוצר / קטגוריה..."
            className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-card/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
          />
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              לא נמצאו ספקים התואמים לחיפוש.
            </div>
          )}
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              open={openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SupplierCard({
  supplier,
  open,
  onToggle,
}: {
  supplier: SupplierAid;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/40 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-bold text-foreground">{supplier.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {supplier.category} · {supplier.rows.length} פריטים
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          {supplier.callout && (
            <div className="mb-3 flex gap-2 items-start rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{supplier.callout}</span>
            </div>
          )}
          <SupplierTable supplier={supplier} />
        </div>
      )}
    </div>
  );
}

function SupplierTable({ supplier }: { supplier: SupplierAid }) {
  const cellBase = "px-3 py-2 text-sm border-b border-border/60";
  const headBase =
    "px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-zinc-900/40 text-right";

  if (supplier.kind === "static") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right">
          <thead>
            <tr>
              <th className={headBase}>שם מוצר</th>
              <th className={`${headBase} w-32`}>תקן</th>
            </tr>
          </thead>
          <tbody>
            {supplier.rows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-800/30">
                <td className={`${cellBase} font-medium`}>{r.name}</td>
                <td className={`${cellBase} text-muted-foreground`}>{r.standard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-right">
        <thead>
          <tr>
            <th className={headBase}>שם מוצר</th>
            {supplier.days.map((d) => (
              <th key={d} className={`${headBase} w-28`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {supplier.rows.map((r, i) => (
            <tr key={i} className="hover:bg-zinc-800/30">
              <td className={`${cellBase} font-medium`}>{r.name}</td>
              {supplier.days.map((d) => (
                <td key={d} className={`${cellBase} text-muted-foreground`}>
                  {r.amounts[d] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
