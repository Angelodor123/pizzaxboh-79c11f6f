import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, Flame, Timer, Snowflake, Sparkles, ChefHat, Droplets } from "lucide-react";
import { pizzaXCookbook, categoryLabels, type Recipe } from "@/lib/cookbook";

export const Route = createFileRoute("/tips")({
  head: () => ({
    meta: [
      { title: "טיפים ודגשים קולינריים — Pizza X" },
      {
        name: "description",
        content:
          "ריכוז דגשים מקצועיים מתוך מתכוני המטבח של Pizza X: זמני בישול, מרקמים, טכניקות וזילוף.",
      },
    ],
  }),
  component: TipsPage,
});

interface DerivedTip {
  recipeId: string;
  recipeName: string;
  category: string;
  text: string;
}

function fmtDuration(sec: number): string {
  if (sec >= 60) {
    const min = sec / 60;
    return `${Number.isInteger(min) ? min : min.toFixed(1)} דקות`;
  }
  return `${sec} שניות`;
}

function deriveTips() {
  const technique: DerivedTip[] = [];
  const timing: DerivedTip[] = [];
  const texture: DerivedTip[] = [];
  const slowCook: DerivedTip[] = [];
  const storage: DerivedTip[] = [];
  const emulsion: DerivedTip[] = [];

  const base = (r: Recipe) => ({
    recipeId: r.id,
    recipeName: r.nameHebrew,
    category: categoryLabels[r.category],
  });

  for (const r of pizzaXCookbook) {
    if (r.deleted) continue;

    if (r.techniqueNotesHebrew) {
      technique.push({ ...base(r), text: r.techniqueNotesHebrew });
    }

    if (r.timerSeconds) {
      timing.push({
        ...base(r),
        text: `${fmtDuration(r.timerSeconds)} — ${r.instructionsHebrew}`,
      });
    }

    if (r.textureTargetHebrew) {
      texture.push({
        ...base(r),
        text: `יעד מרקם: ${r.textureTargetHebrew}.`,
      });
    }

    const ins = r.instructionsHebrew;
    if (/בישול ארוך|8\s*עד\s*14|8-14 שעות/.test(ins)) {
      slowCook.push({ ...base(r), text: ins });
    }
    if (/קירור מוחלט|קירור של שעתיים|אחסון/.test(ins)) {
      storage.push({ ...base(r), text: ins });
    }
    if (/בזילוף|זרם דק|זילוף איטי/.test(ins) || /זילוף/.test(r.techniqueNotesHebrew ?? "")) {
      emulsion.push({ ...base(r), text: ins });
    }
  }

  return { technique, timing, texture, slowCook, storage, emulsion };
}

interface SectionDef {
  key: string;
  title: string;
  subtitle: string;
  Icon: typeof Flame;
  items: DerivedTip[];
}

function TipsPage() {
  const groups = useMemo(deriveTips, []);

  const sections: SectionDef[] = [
    {
      key: "timing",
      title: "תזמון מדויק",
      subtitle: "שניות וזמנים שמופיעים במתכונים — לעבוד עם טיימר.",
      Icon: Timer,
      items: groups.timing,
    },
    {
      key: "technique",
      title: "טכניקות מטבח",
      subtitle: "הערות טכניקה מתוך הוראות ההכנה.",
      Icon: ChefHat,
      items: groups.technique,
    },
    {
      key: "texture",
      title: "מרקם אחיד ויעדי טקסטורה",
      subtitle: "המרקם הסופי שצריך להגיע אליו בכל מתכון.",
      Icon: Sparkles,
      items: groups.texture,
    },
    {
      key: "slowCook",
      title: "בישול ארוך ואיטי",
      subtitle: "ריבות וקרמים שדורשים שעות ארוכות — לעקוב ולא לשרוף בתחתית.",
      Icon: Flame,
      items: groups.slowCook,
    },
    {
      key: "emulsion",
      title: "זילוף איטי ואיחוד רטבים",
      subtitle: "איולי, פסטו ושום קונפי — שמן או ירוקים נכנסים בזרם דק בסוף.",
      Icon: Droplets,
      items: groups.emulsion,
    },
    {
      key: "storage",
      title: "מנוחה, קירור ואחסון",
      subtitle: "שלבי קירור ומנוחה שמופיעים בהוראות.",
      Icon: Snowflake,
      items: groups.storage,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-neon hover:text-neon/80 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          חזרה למטבח
        </Link>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
            Kitchen Wisdom
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
            דגשים <span className="text-neon text-glow-neon">וטיפים</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            כל הדגשים בעמוד הזה מופקים ישירות ממתכוני Pizza X — טמפרטורת ליבה,
            זילוף איטי, מנוחה ומרקם אחיד. אין כאן עצה שלא מופיעה במתכון.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {sections.map(({ key, title, subtitle, Icon, items }) => (
          <section key={key}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full border border-neon/60 flex items-center justify-center text-neon">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold leading-tight">
                  {title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              </div>
            </div>

            <ul className="space-y-3">
              {items.map((t, idx) => (
                <li
                  key={`${t.recipeId}-${idx}`}
                  className="rounded-xl border border-border bg-card/70 backdrop-blur p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <h3 className="font-bold text-foreground text-sm">
                      {t.recipeName}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-brand">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {t.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-border text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border border-neon text-neon font-bold px-5 py-2.5 text-sm hover:bg-neon hover:text-primary-foreground transition"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לדשבורד המתכונים
        </Link>
      </div>
    </div>
  );
}
