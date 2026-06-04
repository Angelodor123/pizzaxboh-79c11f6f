import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Wrench } from "lucide-react";

export const Route = createFileRoute("/aids/operations")({
  head: () => ({ meta: [{ title: "תפעול ומכשור — עזרים" }] }),
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
        <div className="rounded-2xl border-2 border-dashed border-violet-500/40 bg-violet-500/5 p-8 text-center">
          <Wrench className="h-10 w-10 mx-auto text-violet-300 mb-3" />
          <h1 className="text-xl font-extrabold">תפעול ומכשור</h1>
          <p className="text-sm text-muted-foreground mt-2">
            הספרייה נמצאת בבנייה. בקרוב — מדריכי הפעלת מכשירים ונהלי תפעול.
          </p>
        </div>
      </div>
    </div>
  );
}
