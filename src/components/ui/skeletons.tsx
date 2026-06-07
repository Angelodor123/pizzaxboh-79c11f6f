import { Skeleton } from "@/components/ui/skeleton";

/** Stack of list-row skeletons (tasks, notifications, generic lists). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 py-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3"
        >
          <Skeleton className="h-9 w-9 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Grid of card skeletons (suppliers, orders, catalog grid). */
export function GridSkeleton({
  items = 8,
  className = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card/40 overflow-hidden"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact rows for catalog items inside a dialog. */
export function CatalogRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1.5" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border border-border rounded-lg p-2 bg-background/30"
        >
          <Skeleton className="h-14 w-14 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
