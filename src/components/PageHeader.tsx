import { useRouter } from "@tanstack/react-router";

interface PageMeta {
  title: string;
  subtitle?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "מטבח Pizza X", subtitle: "Back of House — מרכז הבקרה התפעולי" },
  "/recipes": { title: "מתכונים", subtitle: "ספריית המתכונים הרשמית של Pizza X" },
  "/dishes": { title: "מנות", subtitle: "תפריט המנות הפעיל של Pizza X" },
  "/prep": { title: "הכנות יומיות", subtitle: "מעקב משימות הכנה ומלאי פעיל" },
  "/restock": { title: "מילוי מלאי", subtitle: "ניהול מלאי מחסן ופריטים" },
  "/calendar": { title: "לוח שנה", subtitle: "אירועים, ספקים והגעות סחורה" },
  "/suppliers": { title: "ספקים", subtitle: "ניהול ספקים, ימי הגעה וקטגוריות" },
  "/notebook": { title: "מחברת המטבח", subtitle: "תקשורת והערות צוות יומיות" },
  "/guide": { title: "המדריך", subtitle: "מדריך ההפעלה המלא של המערכת" },
  "/admin": { title: "ניהול", subtitle: "הגדרות מערכת, סניפים, משתמשים ותכנים" },
};

export function PageHeader({ isDishesView = false }: { isDishesView?: boolean } = {}) {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const key = isDishesView && pathname === "/recipes" ? "/dishes" : pathname;
  const meta = PAGE_META[key];
  if (!meta) return null;

  return (
    <div dir="rtl" className="mx-auto max-w-7xl px-4 pt-4">
      <div className="border-b border-border/60 pb-3">
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="mt-1 text-[13px] text-muted-foreground">{meta.subtitle}</p>
        )}
      </div>
    </div>
  );
}
