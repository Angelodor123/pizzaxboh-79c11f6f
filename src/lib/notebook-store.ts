import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId, getActiveBranchIdSync } from "@/lib/current-branch";

export type NotebookListKey = "tasks" | "shopping" | "recurring" | "orders" | "warehouse" | "shortages";

export type NotebookPriority = "normal" | "urgent";

export interface NotebookItem {
  id: string;
  text: string;
  done: boolean;
  priority: NotebookPriority;
  createdAt: string;
  sortOrder: number;
  catalogProductId?: string | null;
  currentStock?: number | null;
  unit?: string | null;
}

interface DbRow {
  id: string;
  list_key: NotebookListKey;
  text: string;
  done: boolean;
  priority: NotebookPriority | null;
  created_at: string;
  sort_order: number | null;
  catalog_product_id: string | null;
  current_stock: number | null;
  unit: string | null;
}

export interface AddItemOptions {
  priority?: NotebookPriority;
  catalogProductId?: string | null;
  currentStock?: number | null;
  unit?: string | null;
}

interface NotebookState {
  lists: Record<NotebookListKey, NotebookItem[]>;
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
  addItem: (list: NotebookListKey, text: string, options?: AddItemOptions) => Promise<void>;
  toggleItem: (list: NotebookListKey, id: string) => Promise<void>;
  editItem: (list: NotebookListKey, id: string, text: string) => Promise<void>;
  removeItem: (list: NotebookListKey, id: string) => Promise<void>;
  clearDone: (list: NotebookListKey) => Promise<void>;
}

const EMPTY: Record<NotebookListKey, NotebookItem[]> = {
  tasks: [],
  shopping: [],
  recurring: [],
  orders: [],
  warehouse: [],
  shortages: [],
};

function groupRows(rows: DbRow[]): Record<NotebookListKey, NotebookItem[]> {
  const out: Record<NotebookListKey, NotebookItem[]> = {
    tasks: [],
    shopping: [],
    recurring: [],
    orders: [],
    warehouse: [],
    shortages: [],
  };
  for (const r of rows) {
    if (!out[r.list_key]) continue;
    out[r.list_key].push({
      id: r.id,
      text: r.text,
      done: r.done,
      priority: (r.priority as NotebookPriority) ?? "normal",
      createdAt: r.created_at,
      catalogProductId: r.catalog_product_id,
      currentStock: r.current_stock,
      unit: r.unit,
    });
  }
  for (const k of Object.keys(out) as NotebookListKey[]) {
    out[k].sort((a, b) => {
      // urgent first, then alphabetical (Hebrew A-Z)
      if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
      return a.text.localeCompare(b.text, "he");
    });
  }
  return out;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  lists: EMPTY,
  loading: true,
  initialized: false,

  refresh: async () => {
    const branchId = getActiveBranchIdSync();
    let q = supabase
      .from("notebook_items")
      .select("id,list_key,text,done,priority,created_at,catalog_product_id,current_stock,unit")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    set({ lists: groupRows((data ?? []) as DbRow[]), loading: false, initialized: true });
  },

  addItem: async (list, text, options = {}) => {
    const { priority = "normal", catalogProductId = null, currentStock = null, unit = null } = options;
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const optimistic: NotebookItem = {
      id: `tmp-${crypto.randomUUID()}`,
      text: clean,
      done: false,
      priority,
      createdAt: new Date().toISOString(),
      catalogProductId,
      currentStock,
      unit,
    };
    set((s) => ({ lists: { ...s.lists, [list]: [optimistic, ...s.lists[list]] } }));
    const branchId = await requireCurrentBranchId();
    await supabase.from("notebook_items").insert({
      list_key: list,
      text: clean,
      priority,
      created_by: user.id,
      branch_id: branchId,
      catalog_product_id: catalogProductId,
      current_stock: currentStock,
      unit,
    });
  },

  toggleItem: async (list, id) => {
    let nextDone = false;
    set((s) => ({
      lists: {
        ...s.lists,
        [list]: s.lists[list].map((it) => {
          if (it.id !== id) return it;
          nextDone = !it.done;
          return { ...it, done: nextDone };
        }),
      },
    }));
    if (id.startsWith("tmp-")) return;
    await supabase.from("notebook_items").update({ done: nextDone }).eq("id", id);
  },

  editItem: async (list, id, text) => {
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    set((s) => ({
      lists: {
        ...s.lists,
        [list]: s.lists[list].map((it) => (it.id === id ? { ...it, text: clean } : it)),
      },
    }));
    if (id.startsWith("tmp-")) return;
    await supabase.from("notebook_items").update({ text: clean }).eq("id", id);
  },

  removeItem: async (list, id) => {
    set((s) => ({
      lists: { ...s.lists, [list]: s.lists[list].filter((it) => it.id !== id) },
    }));
    if (id.startsWith("tmp-")) return;
    await supabase.from("notebook_items").delete().eq("id", id);
  },

  clearDone: async (list) => {
    const toDelete = get().lists[list].filter((it) => it.done && !it.id.startsWith("tmp-"));
    set((s) => ({
      lists: { ...s.lists, [list]: s.lists[list].filter((it) => !it.done) },
    }));
    if (toDelete.length === 0) return;
    await supabase
      .from("notebook_items")
      .delete()
      .in("id", toDelete.map((it) => it.id));
  },
}));

/**
 * Mount once at the root of the app to load notebook items and keep them
 * synced via Supabase realtime.
 */
export function useNotebookRealtime() {
  const refresh = useNotebookStore((s) => s.refresh);
  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel("notebook-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notebook_items" },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);
}

// =========================================
// Per-recipe ingredient progress (local — per-chef workspace)
// =========================================

interface RecipeProgressState {
  checked: Record<string, number[]>;
  toggleIngredient: (recipeId: string, index: number) => void;
  resetRecipe: (recipeId: string) => void;
}

export const useRecipeProgressStore = create<RecipeProgressState>()(
  persist(
    (set) => ({
      checked: {},
      toggleIngredient: (recipeId, index) =>
        set((s) => {
          const current = s.checked[recipeId] ?? [];
          const exists = current.includes(index);
          const next = exists
            ? current.filter((i) => i !== index)
            : [...current, index];
          return { checked: { ...s.checked, [recipeId]: next } };
        }),
      resetRecipe: (recipeId) =>
        set((s) => {
          const next = { ...s.checked };
          delete next[recipeId];
          return { checked: next };
        }),
    }),
    { name: "pizzax-recipe-progress-v1" },
  ),
);
