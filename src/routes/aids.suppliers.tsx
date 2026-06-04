import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Info, Package } from "lucide-react";
import { SUPPLIER_AIDS, type SupplierAid } from "@/lib/aids-suppliers";

export const Route = createFileRoute("/aids/suppliers")({
  head: () => ({
    meta: [
      { title: "ספקים ותקנים — עזרים" },
      { name: "description", content: "קטלוג ספקים ותקני הזמנה תפעוליים." },
    ],
  }),
  component: AidsSuppliersPage,
});

function AidsSuppliersPage() {
  const [openId, setOpenId] = useState<string | null>(
    SUPPLIER_AIDS[0]?.supplier ?? null,
  );

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
          <span className="text-[11px] text-muted-foreground">
            {SUPPLIER_AIDS.length} ספקים
          </span>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-neon/10 text-neon">
              <Package className="h-5 w-5" />
            </span>
            ספקים ותקנים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            תקני הזמנה לפי ספק. שורות "ראשון/רביעי" משתנות לפי יום ההזמנה.
          </p>
        </header>

        <div className="space-y-3">
          {SUPPLIER_AIDS.map((s) => (
            <SupplierCard
              key={s.supplier}
              supplier={s}
              open={openId === s.supplier}
              onToggle={() =>
                setOpenId((cur) => (cur === s.supplier ? null : s.supplier))
              }
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
  const itemCount =
    supplier.type === "static"
      ? supplier.items.length
      : Object.values(supplier.days).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/40 transition"
      >
        <div className="text-right">
          <div className="font-bold text-foreground">{supplier.supplier}</div>
          <div className="text-[11px] text-muted-foreground">
            {supplier.category ?? "כללי"} · {itemCount} פריטים
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

  if (supplier.type === "static") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right">
          <thead>
            <tr>
              <th className={headBase}>שם מוצר</th>
              <th className={`${headBase} w-32`}>כמות יעד</th>
            </tr>
          </thead>
          <tbody>
            {supplier.items.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-800/30">
                <td className={`${cellBase} font-medium`}>{r.item}</td>
                <td className={`${cellBase} text-neon font-bold`}>{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const days = Object.keys(supplier.days);
  const allItems = Array.from(
    new Set(
      days.flatMap((d) => supplier.days[d].map((it) => it.item)),
    ),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-right">
        <thead>
          <tr>
            <th className={headBase}>שם מוצר</th>
            {days.map((d) => (
              <th key={d} className={`${headBase} w-24`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItems.map((name, i) => (
            <tr key={i} className="hover:bg-zinc-800/30">
              <td className={`${cellBase} font-medium`}>{name}</td>
              {days.map((d) => {
                const found = supplier.days[d].find((it) => it.item === name);
                return (
                  <td
                    key={d}
                    className={`${cellBase} ${found ? "text-neon font-bold" : "text-muted-foreground/50"}`}
                  >
                    {found ? found.amount : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
