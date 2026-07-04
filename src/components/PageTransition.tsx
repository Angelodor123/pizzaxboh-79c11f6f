import { useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Wraps page outlets with a snappy fade+slide transition keyed by the active route path.
 * Duration is intentionally short (~0.2s) for native-feel snappiness.
 * Uses pure CSS keyframes to avoid pulling framer-motion into the main bundle.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [renderKey, setRenderKey] = useState(pathname);

  useEffect(() => {
    setRenderKey(pathname);
  }, [pathname]);

  return (
    <div key={renderKey} className="page-transition" style={{ minHeight: "100%" }}>
      {children}
    </div>
  );
}
