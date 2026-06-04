import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/aids/cleaning")({
  head: () => ({ meta: [{ title: "נהלי ניקיון — עזרים" }] }),
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-500/5 p-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-sky-300 mb-3" />
          <h1 className="text-xl font-extrabold">נהלי ניקיון</h1>
          <p className="text-sm text-muted-foreground mt-2">
            הספרייה נמצאת בבנייה. בקרוב — צ׳קליסטים, תדירויות וסרטוני הדרכה.
          </p>
        </div>
      </div>
    </div>
  );
}
