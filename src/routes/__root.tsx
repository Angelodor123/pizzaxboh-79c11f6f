import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ArrowRight, Home } from "lucide-react";

import appCss from "../styles.css?url";
import { CategoryDrawer } from "@/components/CategoryDrawer";
import { QuickBackBubble } from "@/components/QuickBackBubble";
import { AccessGate } from "@/components/AccessGate";
import { PageOnboarding, pageKeyFromPath } from "@/components/PageOnboarding";
import { GuidedTour, ReplayTourButton } from "@/components/GuidedTour";
import { NdaGate } from "@/components/NdaGate";
import { ServiceModeToggle } from "@/components/ServiceModeToggle";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { useRecipesSync } from "@/lib/store";
import { useNotebookRealtime } from "@/lib/notebook-store";
import { useSiteTextsSync, useSiteText } from "@/lib/site-texts";
import { useUIStore } from "@/lib/ui-store";
import {
  ensureServiceWorker,
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import pizzaXLogo from "@/assets/pizza-x-logo.png";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-neon text-glow-neon">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">הדף לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          הדף שחיפשת לא קיים או הוסר.
        </p>
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          תקלה בטעינת הדף
        </h1>
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
      { name: "description", content: "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House." },
      { property: "og:title", content: "Pizza X — מטבח" },
      { name: "twitter:title", content: "Pizza X — מטבח" },
      { property: "og:description", content: "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House." },
      { name: "twitter:description", content: "מערכת ניהול המטבח הרשמית של Pizza X. ריכוז מתכונים, מחשבוני כמויות ודיוק תפעולי לצוות ה-Back of House." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gna0ipaNRGTI5yjH5wtF1u61HNB3/social-images/social-1778951248400-1000188452.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gna0ipaNRGTI5yjH5wtF1u61HNB3/social-images/social-1778951248400-1000188452.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#ff1493" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pizza X" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/pizza-x-logo.png" },
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
        <AccessGate>
          <NdaGate>
            <AuthedShell />
          </NdaGate>
        </AccessGate>
      </AuthProvider>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}

function AuthedShell() {
  useRecipesSync();
  useNotebookRealtime();
  useSiteTextsSync();
  const footerCredit = useSiteText("general.footer_credit", "© 2026 נבנה על ידי דור ברקת");
  const isServiceMode = useUIStore((s) => s.isServiceMode);
  const clearLastRecipe = useUIStore((s) => s.clearLastRecipe);
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const showServiceToggle = pathname === "/recipes";
  const showQuickBack = pathname !== "/recipes";

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
      <header
        className={`sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b-2 transition-colors ${
          isServiceMode
            ? "border-orange-500 shadow-[0_4px_24px_-4px_rgba(255,140,0,0.6)]"
            : "border-border"
        }`}
      >
        <div className="relative max-w-7xl mx-auto px-4 h-24 flex items-center justify-center">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <CategoryDrawer />
            {showServiceToggle && <ServiceModeToggle />}
          </div>
          {pathname !== "/" && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
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
              <Link
                to="/"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
                aria-label="דף הבית"
                title="דף הבית"
              >
                <Home className="h-4 w-4" />
              </Link>
            </div>
          )}
          <Link
            to="/"
            className="flex flex-col items-center gap-1"
            aria-label="Pizza X — בית"
          >
            <img
              src={pizzaXLogo}
              alt="Pizza X"
              className="h-[60px] sm:h-[72px] w-auto object-contain"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,20,147,0.35))" }}
            />
            <span className="text-[12px] font-bold tracking-[0.3em] uppercase text-neon">
              {isServiceMode ? "Service Mode" : "Back of House"}
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <PageOnboarding pageKey={pageKeyFromPath(pathname)} />
        <Outlet />
      </main>
      {showQuickBack && <QuickBackBubble />}
      <footer className="border-t border-border py-4 px-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground/70">
          Pizza X • Urban Jungle Kitchen OS
        </p>
        <p className="text-[11px] text-foreground/40 tracking-wide" dir="rtl">
          {footerCredit}
        </p>
      </footer>
    </div>
  );
}
