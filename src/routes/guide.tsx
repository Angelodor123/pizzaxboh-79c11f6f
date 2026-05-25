import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { pizzaXCookbook, type Recipe } from "@/lib/cookbook";

export const Route = createFileRoute("/guide")({
  component: GuidePage,
});

function fmtTime(sec: number): string {
  if (sec >= 60) {
    const m = sec / 60;
    return Number.isInteger(m) ? `${m} דקות` : `${m.toFixed(1)} דקות`;
  }
  return `${sec} שניות`;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 backdrop-blur p-5 sm:p-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
        {subtitle}
      </div>
      <h2 className="font-display text-2xl font-bold mt-1 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "neon" | "jungle" | "amber";
}) {
  const cls =
    accent === "jungle"
      ? "text-jungle"
      : accent === "amber"
        ? "text-amber-brand"
        : "text-neon";
  return (
    <li className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-2">
      <span className="flex-1 min-w-0 break-words">
        {label}
      </span>
      <span className={`font-bold tabular-nums shrink-0 ${cls}`}>{value}</span>
    </li>
  );
}

function GuidePage() {
  const recipes = pizzaXCookbook;

  const timed = useMemo(
    () =>
      recipes
        .filter((r) => r.timerSeconds)
        .sort((a, b) => (a.timerSeconds ?? 0) - (b.timerSeconds ?? 0)),
    [recipes],
  );

  // Heat: parsed from instruction text
  const heat = useMemo(() => {
    const out: { recipe: Recipe; temps: string[] }[] = [];
    for (const r of recipes) {
      const matches = Array.from(
        r.instructionsHebrew.matchAll(/(\d{2,3})\s*מעלות/g),
      ).map((m) => `${m[1]}°C`);
      if (matches.length) out.push({ recipe: r, temps: matches });
    }
    return out;
  }, [recipes]);

  const textures = useMemo(
    () => recipes.filter((r) => r.textureTargetHebrew),
    [recipes],
  );

  const techniques = useMemo(
    () => recipes.filter((r) => r.techniqueNotesHebrew),
    [recipes],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
          Pro Standards
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">
          מדריך <span className="text-neon text-glow-neon">מקצועי</span>
        </h1>
        <p className="hidden sm:block text-muted-foreground mt-2 text-sm">
          סטנדרטים מחייבים — זמנים, חום, מרקמים וטכניקות, ישירות מספר המתכונים.
        </p>
      </div>

      <section className="rounded-2xl border-2 border-neon/40 bg-gradient-to-br from-neon/5 to-transparent p-5 sm:p-6 mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          What's New
        </div>
        <h2 className="font-display text-2xl font-bold mt-1 mb-4">
          חדש במערכת
        </h2>
        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <div className="font-bold text-foreground mb-1">
              ספקים וקבלת סחורה
            </div>
            <p className="text-muted-foreground">
              מנהלים יכולים כעת לשכפל הזמנות עבר ישירות מהיסטוריית הספק בלחיצה אחת.
              בנוסף, נוסף תהליך <span className="text-foreground font-bold">"קבלת סחורה"</span>:
              צילום תעודת המשלוח מפעיל זיהוי OCR חכם שמתאים אוטומטית בין הפריטים שהוזמנו
              למה שהתקבל בפועל, ומדגיש פערים בכמויות או במחירים. תמיד אפשר לעבור להזנה ידנית
              כגיבוי.
            </p>
          </div>
          <div>
            <div className="font-bold text-foreground mb-1">
              מעקב בצקים — היסטוריה
            </div>
            <p className="text-muted-foreground">
              כעת לחיצה על אייקון השעון בכרטיס{" "}
              <span className="text-amber-brand font-bold">סטטוס בצקים</span>{" "}
              חושפת יומן מלא של מי עדכן את כמות המגשים ומתי בדיוק — שקיפות מלאה
              ואחריותיות לכל צוות המשמרת.
            </p>
          </div>
          <div>
            <div className="font-bold text-foreground mb-1">
              צ'קליסטים יומיים — סגירה מהירה
            </div>
            <p className="text-muted-foreground">
              נוספו חיצים לסגירה מהירה בתחתית כל קטגוריה פתוחה, לניווט נוח יותר במובייל
              בלי לחזור לראש הקטגוריה.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Section title="סטנדרטים של זמן" subtitle="Timing Standards">
          <ul className="space-y-2">
            {timed.map((r) => (
              <Row
                key={r.id}
                label={r.nameHebrew}
                value={fmtTime(r.timerSeconds!)}
                accent="neon"
              />
            ))}
          </ul>
        </Section>

        <Section title="בקרת חום" subtitle="Heat Control">
          <ul className="space-y-2">
            {heat.map(({ recipe, temps }) => (
              <Row
                key={recipe.id}
                label={recipe.nameHebrew}
                value={temps.join(" → ")}
                accent="amber"
              />
            ))}
          </ul>
        </Section>

        <Section title="יעדי מרקם" subtitle="Texture Goals">
          <ul className="space-y-2">
            {textures.map((r) => (
              <Row
                key={r.id}
                label={r.nameHebrew}
                value={r.textureTargetHebrew!}
                accent="jungle"
              />
            ))}
          </ul>
        </Section>

        <Section title="טכניקות מקצועיות" subtitle="Pro-Techniques">
          <ul className="space-y-3">
            {techniques.map((r) => (
              <li
                key={r.id}
                className="border-b border-border/50 pb-2"
              >
                <div className="text-sm font-bold" >
                  {r.nameHebrew}
                </div>
                <div className="text-xs text-amber-brand mt-1">
                  ⚠ {r.techniqueNotesHebrew}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
