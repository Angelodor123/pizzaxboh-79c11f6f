import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, BookOpen, ListChecks, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type RecipeHit = { kind: "recipe"; id: string; title: string; subtitle?: string };
type TaskHit = { kind: "task"; id: string; title: string; subtitle?: string };
type Hit = RecipeHit | TaskHit;

export function GlobalSearch() {
  const branchId = useActiveBranch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(q, 250);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Outside click to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Run debounced search
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let abort = false;
    setLoading(true);
    (async () => {
      const like = `%${term}%`;
      const recipesQ = supabase
        .from("recipes")
        .select("id,name_hebrew,category,branch_id,deleted")
        .ilike("name_hebrew", like)
        .eq("deleted", false)
        .limit(6);
      const tasksQ = supabase
        .from("tasks")
        .select("id,name,branch_id,active")
        .ilike("name", like)
        .eq("active", true)
        .limit(6);
      if (branchId) {
        recipesQ.eq("branch_id", branchId);
        tasksQ.eq("branch_id", branchId);
      }
      const [r, t] = await Promise.all([recipesQ, tasksQ]);
      if (abort) return;
      const recipes: Hit[] = (r.data ?? []).map((row: any) => ({
        kind: "recipe",
        id: row.id,
        title: row.name_hebrew,
        subtitle: row.category,
      }));
      const tasks: Hit[] = (t.data ?? []).map((row: any) => ({
        kind: "task",
        id: row.id,
        title: row.name,
      }));
      setHits([...recipes, ...tasks]);
      setLoading(false);
    })();
    return () => {
      abort = true;
    };
  }, [debounced, branchId]);

  const onPick = (h: Hit) => {
    setOpen(false);
    setQ("");
    setHits([]);
    if (h.kind === "recipe") {
      navigate({ to: "/recipes", hash: `recipe-${h.id}` });
    } else {
      navigate({ to: "/tasks", search: { edit: h.id } as any });
    }
  };

  const recipeHits = useMemo(() => hits.filter((h) => h.kind === "recipe"), [hits]);
  const taskHits = useMemo(() => hits.filter((h) => h.kind === "task"), [hits]);

  return (
    <div ref={wrapRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
          aria-label="חיפוש מהיר"
          title="חיפוש מהיר"
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1 bg-card/80 border border-neon/60 rounded-md px-2 h-9 w-[220px] sm:w-[280px] shadow-[0_0_8px_rgba(57,255,20,0.25)]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חפש מתכון או משימה…"
            dir="rtl"
            maxLength={120}
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none text-right placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQ("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQ("");
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="סגור חיפוש"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {open && q.trim().length >= 2 && (
        <div
          dir="rtl"
          className="absolute top-full mt-2 right-0 w-[300px] sm:w-[380px] max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl z-50"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> מחפש…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              לא נמצאו תוצאות
            </div>
          )}
          {recipeHits.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                מתכונים
              </div>
              {recipeHits.map((h) => (
                <button
                  key={`r-${h.id}`}
                  type="button"
                  onClick={() => onPick(h)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-accent/50 transition"
                >
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{h.title}</div>
                    {h.subtitle && (
                      <div className="text-[10px] text-muted-foreground truncate">{h.subtitle}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {taskHits.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                משימות
              </div>
              {taskHits.map((h) => (
                <button
                  key={`t-${h.id}`}
                  type="button"
                  onClick={() => onPick(h)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-accent/50 transition"
                >
                  <ListChecks className="h-4 w-4 text-neon shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{h.title}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
