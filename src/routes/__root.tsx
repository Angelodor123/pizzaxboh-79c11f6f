import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ArrowRight, User } from "lucide-react";

import appCss from "../styles.css?url";
import { CategoryDrawer } from "@/components/CategoryDrawer";
import { QuickBackBubble } from "@/components/QuickBackBubble";
import { AccessGate } from "@/components/AccessGate";
import { PageOnboarding, pageKeyFromPath } from "@/components/PageOnboarding";
import { PageHeader } from "@/components/PageHeader";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageTransition } from "@/components/PageTransition";

import { lazy, Suspense, useEffect } from "react";

const GuidedTour = lazy(() =>
  import("@/components/GuidedTour").then((m) => ({ default: m.GuidedTour })),
);
const CopilotFab = lazy(() =>
  import("@/components/CopilotFab").then((m) => ({ default: m.CopilotFab })),
);
import { NdaGate } from "@/components/NdaGate";
import { BranchGate, useActiveBranchData } from "@/components/BranchGate";
import { BranchSwitcher } from "@/components/BranchSwitcher";

import { UnifiedBell } from "@/components/UnifiedBell";
import { CriticalMaintenanceInterceptor } from "@/components/CriticalMaintenanceInterceptor";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useInactivityLogout } from "@/lib/use-inactivity-logout";
import { ConfirmHost } from "@/lib/confirm";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRecipesSync } from "@/lib/store";
import { useNotebookRealtime } from "@/lib/notebook-store";
import { useSiteTextsSync, useSiteText } from "@/lib/site-texts";
import { useUIStore } from "@/lib/ui-store";
import { MENU_ITEM_CATEGORIES } from "@/lib/menu-categories";
import {
  ensureServiceWorker,
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import pizzaXLogo from "@/assets/pizza-x-logo.png";

function ActiveBranchBadge() {
  const branch = useActiveBranchData();
  if (!branch?.name) return null;
  return (
    <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground whitespace-nowrap">
      {branch.name}
    </span>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-neon text-glow-neon">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">הדף לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">הדף שחיפשת לא קיים או הוסר.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            חזרה למטבח
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">תקלה בטעינת הדף</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          אירעה שגיאה. אנא נסה שוב או חזור למטבח.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            נסה שוב
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pizza X — מטבח" },
      {
        name: "description",
        content:
          "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House.",
      },
      { property: "og:title", content: "Pizza X — מטבח" },
      { name: "twitter:title", content: "Pizza X — מטבח" },
      {
        property: "og:description",
        content:
          "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House.",
      },
      {
        name: "twitter:description",
        content:
          "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/gna0ipaNRGTI5yjH5wtF1u61HNB3/social-images/social-1778951248400-1000188452.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/gna0ipaNRGTI5yjH5wtF1u61HNB3/social-images/social-1778951248400-1000188452.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pizza X" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/android-chrome-512x512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preload", as: "image", href: pizzaXLogo, fetchPriority: "high" },
      // Apple splash screens (per-resolution)
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-2048-2732.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1668-2388.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1536-2048.png",
        media:
          "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1290-2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1179-2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1170-2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-1125-2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-828-1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/apple-splash-750-1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <AccessGate>
            <NdaGate>
              <BranchGate>
                <OfflineBanner />
                <AuthedShell />
              </BranchGate>
            </NdaGate>
          </AccessGate>
        </ErrorBoundary>
      </AuthProvider>
      <Toaster position="top-center" richColors closeButton />
      <ConfirmHost />
    </QueryClientProvider>
  );
}

// Routes restricted by effective role. "super_admin" → super admin only;
// "manager" → admin role required (manager or super admin).
const RESTRICTED_ROUTES: Record<string, "manager" | "super_admin"> = {
  "/admin": "super_admin",
  "/admin/alerts": "manager",
  "/service-calls": "manager",
  "/admin/settings/equipment": "manager",
  "/suppliers": "super_admin",
  "/orders": "manager",
  "/invoices": "manager",
  // "/calendar" is accessible to all authenticated roles (employees see read-only view; edits gated inside the component).
  "/restock": "manager",
};

function AuthedShell() {
  useRecipesSync();
  useNotebookRealtime();
  useSiteTextsSync();
  const footerCredit = useSiteText("general.footer_credit", "© 2026 נבנה על ידי דור ברקת");

  const clearLastRecipe = useUIStore((s) => s.clearLastRecipe);
  const category = useUIStore((s) => s.category);
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const { role: effRole, isSuperAdmin: effSuper, loading: authLoading, session } = useAuth();
  useInactivityLogout(!!session);

  // Strict route guard — runs whenever pathname or effective role changes.
  // This is what makes "View As → Employee" immediately kick a super admin
  // off /suppliers, /admin, etc.
  useEffect(() => {
    if (authLoading) return;
    const need = RESTRICTED_ROUTES[pathname];
    if (!need) return;
    const isAdminRole = effRole === "admin";
    const allowed = need === "super_admin" ? effSuper : isAdminRole;
    if (!allowed) {
      router.navigate({ to: "/" });
    }
  }, [pathname, effRole, effSuper, authLoading, router]);
  const isRecipesPage = pathname === "/recipes";
  const isDishesView =
    isRecipesPage &&
    (category === "dishes" ||
      (category !== "all" && category !== "desserts" && MENU_ITEM_CATEGORIES.includes(category)));
  const showQuickBack = !isRecipesPage;

  // Register service worker once
  useEffect(() => {
    void ensureServiceWorker();
  }, []);

  // Gentle one-time prompt for notification permission
  useEffect(() => {
    const KEY = "pizzax-notif-prompt-v1";
    if (typeof window === "undefined") return;
    if (notificationPermission() !== "default") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => {
      localStorage.setItem(KEY, "1");
      void requestNotificationPermission();
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // When the user is back on the recipes page, the "return to recipe" hint
  // is no longer useful — clear it.
  useEffect(() => {
    if (pathname === "/recipes") clearLastRecipe();
  }, [pathname, clearLastRecipe]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 overflow-visible backdrop-blur-md bg-background/80 border-b-2 border-border transition-colors">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-20 sm:h-24 flex items-center justify-between gap-2 sm:gap-4 overflow-visible">
          <div className="flex items-center gap-2 shrink-0">
            <CategoryDrawer />
          </div>

          <Link
            to="/"
            className="flex flex-col items-center gap-0.5 min-w-0 flex-1 max-w-[128px] sm:max-w-none shrink-0"
            aria-label="Pizza X — בית"
          >
            <img
              src={pizzaXLogo}
              alt="Pizza X"
              width={216}
              height={72}
              fetchPriority="high"
              decoding="async"
              className="h-9 sm:h-[72px] w-auto max-w-full object-contain"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,20,147,0.35))" }}
            />
            <span className="text-[9px] sm:text-[12px] font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-neon whitespace-nowrap">
              Back of House
            </span>
            <ActiveBranchBadge />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-visible sm:gap-3">
            <GlobalSearch />
            <div className="shrink-0">
              <UnifiedBell />
            </div>
            <div className="shrink-0">
              <BranchSwitcher />
            </div>
            <Link
              to="/my-profile"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
              aria-label="האזור האישי שלי"
              title="האזור האישי שלי"
            >
              <User className="h-4 w-4" />
            </Link>
            {pathname !== "/" && (
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    window.history.back();
                  } else {
                    router.navigate({ to: "/" });
                  }
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
                aria-label="חזרה"
                title="חזרה"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main
        className="flex-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <PageHeader isDishesView={isDishesView} />
        <PageOnboarding pageKey={isDishesView ? "dishes" : pageKeyFromPath(pathname)} />
        <PageTransition>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </PageTransition>
      </main>

      <Suspense fallback={null}>
        <GuidedTour />
        <CopilotFab />
      </Suspense>
      <CriticalMaintenanceInterceptor />
      {showQuickBack && <QuickBackBubble />}
      <footer className="border-t border-border py-4 px-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground/70">Pizza X • Urban Jungle Kitchen OS</p>
        <p className="text-[11px] text-foreground/40 tracking-wide" dir="rtl">
          {footerCredit}
        </p>
      </footer>
    </div>
  );
}
