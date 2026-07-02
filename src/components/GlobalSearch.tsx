import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, BookOpen, ListChecks, Loader2, Truck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveBranch } from "@/components/BranchGate";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type RecipeHit = { kind: "recipe"; id: string; title: string; subtitle?: string };
type TaskHit = { kind: "task"; id: string; title: string; subtitle?: string };
type SupplierHit = { kind: "supplier"; id: string; title: string; subtitle?: string };
type NotebookHit = { kind: "notebook"; id: string; title: string; subtitle?: string };
type Hit = RecipeHit | TaskHit | SupplierHit | NotebookHit;

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
      const suppliersQ = supabase
        .from("suppliers")
        .select("id,name,category,branch_id,active")
        .ilike("name", like)
        .eq("active", true)
        .limit(4);
      const notebookQ = supabase
        .from("notebook_items")
        .select("id,text,branch_id,done,archived_at")
        .ilike("text", like)
        .eq("done", false)
        .is("archived_at", null)
        .limit(4);
      if (branchId) {
        recipesQ.eq("branch_id", branchId);
        tasksQ.eq("branch_id", branchId);
        suppliersQ.eq("branch_id", branchId);
        notebookQ.eq("branch_id", branchId);
      }
      const [r, t, s, n] = await Promise.all([recipesQ, tasksQ, suppliersQ, notebookQ]);
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
      const suppliers: Hit[] = (s.data ?? []).map((row: any) => ({
        kind: "supplier",
        id: row.id,
        title: row.name,
        subtitle: row.category,
      }));
      const notebook: Hit[] = (n.data ?? []).map((row: any) => ({
        kind: "notebook",
        id: row.id,
        title: row.text,
        subtitle: "חוסר פעיל",
      }));
      setHits([...recipes, ...tasks, ...suppliers, ...notebook]);
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
      navigate({ to: "/recipes", search: { openRecipeId: h.id } as any });
    } else if (h.kind === "task") {
      navigate({ to: "/tasks", search: { edit: h.id } as any });
    } else if (h.kind === "supplier") {
      navigate({ to: "/suppliers" });
    } else {
      navigate({ to: "/notebook" });
    }
  };

  const recipeHits = useMemo(() => hits.filter((h) => h.kind === "recipe"), [hits]);
  const taskHits = useMemo(() => hits.filter((h) => h.kind === "task"), [hits]);
  const supplierHits = useMemo(() => hits.filter((h) => h.kind === "supplier"), [hits]);
  const notebookHits = useMemo(() => hits.filter((h) => h.kind === "notebook"), [hits]);

  return (
    <div
      ref={wrapRef}
      className="relative h-9 min-w-9 flex-1 max-w-xs overflow-visible data-[open=true]:min-w-[150px] md:data-[open=true]:min-w-[200px]"
      data-open={open}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition shrink-0"
          aria-label="חיפוש מהיר"
          title="חיפוש מהיר"
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <div className="absolute right-0 top-0 z-[100] flex h-9 w-full min-w-[150px] max-w-xs shrink-0 items-center gap-1 rounded-md border border-neon/60 bg-card/95 px-2 shadow-[0_0_8px_rgba(57,255,20,0.25)] md:min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חפש מתכון, משימה, ספק, חוסר"
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
          className="absolute top-full right-0 z-[100] mt-2 max-h-[60vh] w-[min(82vw,320px)] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl sm:w-[380px]"
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
          {supplierHits.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                ספקים
              </div>
              {supplierHits.map((h) => (
                <button
                  key={`s-${h.id}`}
                  type="button"
                  onClick={() => onPick(h)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-accent/50 transition"
                >
                  <Truck className="h-4 w-4 text-primary shrink-0" />
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
          {notebookHits.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                חוסרים
              </div>
              {notebookHits.map((h) => (
                <button
                  key={`n-${h.id}`}
                  type="button"
                  onClick={() => onPick(h)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-accent/50 transition"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
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
        </div>
      )}
    </div>
  );
}
