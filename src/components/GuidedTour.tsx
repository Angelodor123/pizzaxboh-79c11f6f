import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { HelpCircle, X, ChevronLeft } from "lucide-react";

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const COMMON_INTRO: TourStep = {
  selector: '[data-tour="home-header"]',
  title: "ברוכים הבאים ל-Pizza X 🍕",
  body: "זה מרכז השליטה התפעולי של המטבח. אקח אותך לסיור קצר כדי שתכיר את האזורים החשובים.",
};

const STAFF_STEPS: TourStep[] = [
  COMMON_INTRO,
  {
    selector: '[data-tour="stat-events-today"]',
    title: "אירועים להיום",
    body: "כאן רואים כמה אירועים מתוכננים להיום — אספקות, אירועים מיוחדים ומשימות עם עדיפות גבוהה.",
  },
  {
    selector: '[data-tour="card-notebook"]',
    title: "פנקס עבודה יומי",
    body: "ריכוז של כל המשימות, רשימת הקניות וההזמנות הפתוחות שלך — לחיצה כאן פותחת את הפנקס המלא.",
  },
  {
    selector: '[data-tour="tile-prep"]',
    title: "הכנות יומיות",
    body: "צ׳ק־ליסט של מה צריך להכין היום במטבח. החלקה ימינה על פריט מסמנת אותו כהושלם.",
  },
  {
    selector: '[data-tour="tile-restock"]',
    title: "השלמות מהמחסן",
    body: "מה צריך להביא מהמחסן היום. אפשר לסרוק ברקודים של פריטים ולסמן השלמה במחוות החלקה.",
  },
  {
    selector: '[data-tour="tile-recipes"]',
    title: "כל המתכונים",
    body: "ספריית המתכונים והמנות, כולל מחשבון כמויות חי לכל מתכון.",
  },
];

const ADMIN_STEPS: TourStep[] = [
  COMMON_INTRO,
  {
    selector: '[data-tour="stat-events-today"]',
    title: "תמונת מצב יומית",
    body: "כרטיסי הנתונים בראש הדף מציגים סטטוס מהיר — מתכונים פעילים, משימות פתוחות ואירועים להיום.",
  },
  {
    selector: '[data-tour="card-notebook"]',
    title: "פנקס העבודה",
    body: "כאן הצוות מנהל משימות, קניות והזמנות יומיות. מצוין למעקב תפעולי שוטף.",
  },
  {
    selector: '[data-tour="tile-suppliers"]',
    title: "ניהול ספקים",
    body: "פרטי קשר, ימי אספקה והערות עבור כל הספקים — מרוכז במקום אחד.",
  },
  {
    selector: '[data-tour="tile-recipes"]',
    title: "מתכונים ותפריט",
    body: "עריכת מתכונים, מנות, מרכיבים והעלויות. כל שינוי משתקף מיד אצל הצוות.",
  },
  {
    selector: '[data-tour="tile-admin"]',
    title: "מערכת הניהול",
    body: "מרכז הבקרה לאדמין: יחידות מידה, הכנות, השלמות, הסברי דפים, ניהול משתמשים ועוד.",
  },
];

const GUEST_STEPS: TourStep[] = [
  COMMON_INTRO,
  {
    selector: '[data-tour="stat-events-today"]',
    title: "סקירה מהירה",
    body: "כרטיסי הסטטוס בראש הדף נותנים לך תמונת מצב מיידית של כל מה שקורה היום.",
  },
  {
    selector: '[data-tour="card-notebook"]',
    title: "פנקס עבודה",
    body: "המשימות, הקניות וההזמנות של הצוות — מרוכזים במקום אחד.",
  },
  {
    selector: '[data-tour="tile-recipes"]',
    title: "ספריית המתכונים",
    body: "כל המתכונים והמנות עם מחשבוני כמויות מתקדמים.",
  },
];

function getStorageKey(uid: string | null, role: string | null) {
  return `pizzax-tour-v1::${uid ?? "guest"}::${role ?? "none"}`;
}

export function GuidedTour() {
  const { session, role, loading } = useAuth();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const uid = session?.user?.id ?? null;
  const steps = role === "admin" ? ADMIN_STEPS : session ? STAFF_STEPS : GUEST_STEPS;
  const storageKey = getStorageKey(uid, role);

  // Auto-start once per user/role
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;
    if (localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => {
      setIndex(0);
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [loading, storageKey, pathname]);

  // Listen for manual replay
  useEffect(() => {
    const handler = () => {
      if (router.state.location.pathname !== "/") {
        router.navigate({ to: "/" });
      }
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener("pizzax:start-tour", handler);
    return () => window.removeEventListener("pizzax:start-tour", handler);
  }, [router]);

  const measure = useCallback(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // wait a tick for scroll
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect(r);
    });
  }, [open, index, steps]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    const interval = setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
      clearInterval(interval);
    };
  }, [open, measure]);

  if (!open || typeof document === "undefined") return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  const finish = () => {
    localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const next = () => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const pad = 8;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Position tooltip below or above the spotlight
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const tooltipWidth = Math.min(340, vw - 24);
  let tooltipTop: number;
  let tooltipLeft: number;
  if (spotlight) {
    const spaceBelow = vh - (spotlight.top + spotlight.height);
    if (spaceBelow > 220) {
      tooltipTop = spotlight.top + spotlight.height + 12;
    } else {
      tooltipTop = Math.max(12, spotlight.top - 220);
    }
    tooltipLeft = Math.max(
      12,
      Math.min(vw - tooltipWidth - 12, spotlight.left + spotlight.width / 2 - tooltipWidth / 2),
    );
  } else {
    tooltipTop = vh / 2 - 110;
    tooltipLeft = vw / 2 - tooltipWidth / 2;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" dir="rtl">
      {/* Spotlight overlay using SVG mask */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={(e) => {
          // Block clicks outside tooltip
          e.stopPropagation();
        }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={14}
                ry={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.78)"
          mask="url(#tour-mask)"
        />
        {spotlight && (
          <rect
            x={spotlight.left}
            y={spotlight.top}
            width={spotlight.width}
            height={spotlight.height}
            rx={14}
            ry={14}
            fill="none"
            stroke="hsl(var(--neon, 142 100% 50%))"
            strokeWidth={2}
            className="animate-pulse"
            style={{ filter: "drop-shadow(0 0 12px rgba(57,255,20,0.7))" }}
          />
        )}
      </svg>

      {/* Skip button */}
      <button
        onClick={finish}
        className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-bold text-foreground/80 border border-border hover:text-neon hover:border-neon/60 transition"
      >
        <X className="h-3.5 w-3.5" />
        דלג על הסיור
      </button>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute rounded-2xl border-2 border-neon/60 bg-card shadow-[0_0_40px_-8px_rgba(57,255,20,0.5)] p-5 animate-in fade-in-0 zoom-in-95"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          width: tooltipWidth,
        }}
      >
        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-widest text-neon uppercase">
            שלב {index + 1} מתוך {steps.length}
          </span>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 rounded-full transition ${
                  i <= index ? "bg-neon" : "bg-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        <h3 className="font-display text-lg font-bold text-foreground mb-1.5">
          {step.title}
        </h3>
        <p className="text-sm text-foreground/80 leading-relaxed mb-4">
          {step.body}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="text-xs text-foreground/60 hover:text-foreground transition"
          >
            דלג
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={prev}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground hover:border-neon/60 transition"
              >
                <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
                הקודם
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1 rounded-md bg-neon px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition"
            >
              {isLast ? "סיום ✓" : "הבא →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ReplayTourButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("pizzax:start-tour"))}
      className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
      aria-label="הפעל סיור מודרך"
      title="הפעל סיור מודרך"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}
