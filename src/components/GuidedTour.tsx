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

// Version 2 — "Feature Discovery" mini-tour for existing users
const V2_DISCOVERY_STEPS: TourStep[] = [
  {
    selector: '[data-tour="stat-tasks-top"], [data-tour="tile-tasks"]',
    title: "צ'ק-ליסט משמרות חדש 🎯",
    body: "מערכת המשימות החדשה! כל הרוטינות במקום אחד עם שמירה אוטומטית ותיעוד מבצע.",
  },
  {
    selector: '[data-tour="dough-status"]',
    title: "סטטוס בצקים בקליק 🍕",
    body: "עדכון בצקים בקליק: לחצו כאן כדי לעדכן מלאי מגשים מוכנים שמתעדכן אוטומטית בכל המערכת.",
  },
  {
    selector: '[data-tour="card-notebook"]',
    title: "אוטומציה חכמה 🤖",
    body: "המערכת תציע לכם לסגור משימות בפנקס באופן אוטומטי בהתבסס על הביצועים שלכם בצ'ק-ליסט.",
  },
];

const CURRENT_TUTORIAL_VERSION = 2;

export function GuidedTour() {
  const { session, role, loading, tutorialVersion, setTutorialVersion } = useAuth();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isDiscovery = tutorialVersion === 1;
  const masterSteps = role === "admin" ? ADMIN_STEPS : session ? STAFF_STEPS : GUEST_STEPS;
  const steps = isDiscovery ? V2_DISCOVERY_STEPS : masterSteps;

  // Auto-start logic based on tutorial_version
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (pathname !== "/") return;
    if (!session) return; // anonymous users handled separately
    if (tutorialVersion >= CURRENT_TUTORIAL_VERSION) return;
    if (tutorialVersion === 0) {
      // New user — run full master tour
      const t = setTimeout(() => {
        setIndex(0);
        setOpen(true);
      }, 800);
      return () => clearTimeout(t);
    }
    if (tutorialVersion === 1) {
      // Existing user — show feature discovery banner first
      const t = setTimeout(() => setShowDiscoveryBanner(true), 1200);
      return () => clearTimeout(t);
    }
  }, [loading, pathname, session, tutorialVersion]);

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

  // Render discovery banner for v1 users before they accept the mini-tour
  if (!open && showDiscoveryBanner && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[9999] rounded-2xl border-2 border-neon/60 bg-card shadow-[0_0_30px_-8px_rgba(57,255,20,0.5)] p-4 animate-in fade-in-0 slide-in-from-bottom-4" dir="rtl">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0">🚀</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-foreground leading-snug">
              הוספנו כלים חדשים למערכת!
            </h3>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
              בואו לסיור קצר על הפיצ'רים החדשים — שמירה אוטומטית, צ'ק-ליסט משמרות וסטטוס בצקים.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  setShowDiscoveryBanner(false);
                  setIndex(0);
                  setOpen(true);
                }}
                className="rounded-md bg-neon px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition"
              >
                התחל סיור ←
              </button>
              <button
                onClick={() => {
                  void setTutorialVersion(CURRENT_TUTORIAL_VERSION);
                  setShowDiscoveryBanner(false);
                }}
                className="text-xs text-foreground/60 hover:text-foreground transition px-2"
              >
                לא תודה
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!open || typeof document === "undefined") return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  const finish = () => {
    void setTutorialVersion(CURRENT_TUTORIAL_VERSION);
    setOpen(false);
    setShowDiscoveryBanner(false);
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
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-30 inline-flex items-center gap-1 rounded-full border border-neon/40 bg-card/90 backdrop-blur-md text-neon shadow-lg shadow-neon/10 hover:border-neon hover:bg-card hover:shadow-neon/30 transition-colors pl-1 pr-2.5 h-10"
      role="group"
    >
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("pizzax:start-tour"))}
        className="inline-flex items-center gap-2 h-full pr-1"
        aria-label="הפעל סיור מודרך מחדש"
        title="הפעל סיור מודרך מחדש"
      >
        <HelpCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
        <span className="whitespace-nowrap text-xs font-semibold leading-none">
          איך זה עובד?
        </span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-neon/70 hover:text-neon hover:bg-neon/10 transition-colors"
        aria-label="הסתר"
        title="הסתר"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
