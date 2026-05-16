import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

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
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
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
      { name: "description", content: "ניהול מטבח ועלויות מזון ל-Pizza X" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
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

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-card transition"
      activeProps={{ className: "px-3 py-2 rounded-md text-sm font-bold bg-card text-neon glow-neon" }}
    >
      {label}
    </Link>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2" aria-label="Pizza X — בית">
              <span className="inline-block w-9 h-9 rounded-md bg-neon glow-neon grid place-items-center font-black text-primary-foreground">
                X
              </span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <NavLink to="/" label="מטבח" />
              <NavLink to="/invoice" label="חשבונית AI" />
              <NavLink to="/admin" label="ניהול" />
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Pizza X • Urban Jungle Kitchen OS
        </footer>
      </div>
    </QueryClientProvider>
  );
}
