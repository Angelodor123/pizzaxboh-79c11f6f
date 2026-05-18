import { useEffect, useState, useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

export type NotebookListKey = "tasks" | "shopping" | "orders" | "warehouse";

export interface NotebookItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

interface DbRow {
  id: string;
  list_key: NotebookListKey;
  text: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

// =========================================
// Shared notebook (Supabase + realtime)
// =========================================
//
// Replaces the previous localStorage zustand store. Same hook name so callers
// don't change. Returns the same shape: { lists, addItem, toggleItem, ... }
// =========================================

const EMPTY_LISTS: Record<NotebookListKey, NotebookItem[]> = {
  tasks: [],
  shopping: [],
  orders: [],
  warehouse: [],
};

function rowToItem(r: DbRow): NotebookItem {
  return {
    id: r.id,
    text: r.text,
    done: r.done,
    createdAt: r.created_at,
  };
}

function groupRows(rows: DbRow[]): Record<NotebookListKey, NotebookItem[]> {
  const out: Record<NotebookListKey, NotebookItem[]> = {
    tasks: [],
    shopping: [],
    orders: [],
    warehouse: [],
  };
  for (const r of rows) {
    if (out[r.list_key]) out[r.list_key].push(rowToItem(r));
  }
  // newest first within each list
  for (const k of Object.keys(out) as NotebookListKey[]) {
    out[k].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return out;
}

interface NotebookApi {
  lists: Record<NotebookListKey, NotebookItem[]>;
  loading: boolean;
  addItem: (list: NotebookListKey, text: string) => Promise<void>;
  toggleItem: (list: NotebookListKey, id: string) => Promise<void>;
  removeItem: (list: NotebookListKey, id: string) => Promise<void>;
  clearDone: (list: NotebookListKey) => Promise<void>;
}

export function useNotebookStore<T = NotebookApi>(selector?: (s: NotebookApi) => T): T {
  const [lists, setLists] = useState<Record<NotebookListKey, NotebookItem[]>>(EMPTY_LISTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("notebook_items")
      .select("id,list_key,text,done,sort_order,created_at")
      .order("created_at", { ascending: false });
    setLists(groupRows((data ?? []) as DbRow[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("notebook-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notebook_items" },
        () => {
          // Cheap and correct: re-fetch on any change.
          void refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const addItem = useCallback(async (list: NotebookListKey, text: string) => {
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Optimistic
    const optimistic: NotebookItem = {
      id: `tmp-${crypto.randomUUID()}`,
      text: clean,
      done: false,
      createdAt: new Date().toISOString(),
    };
    setLists((s) => ({ ...s, [list]: [optimistic, ...s[list]] }));
    await supabase.from("notebook_items").insert({
      list_key: list,
      text: clean,
      created_by: user.id,
    });
  }, []);

  const toggleItem = useCallback(async (list: NotebookListKey, id: string) => {
    let nextDone = false;
    setLists((s) => ({
      ...s,
      [list]: s[list].map((it) => {
        if (it.id !== id) return it;
        nextDone = !it.done;
        return { ...it, done: nextDone };
      }),
    }));
    if (id.startsWith("tmp-")) return;
    await supabase.from("notebook_items").update({ done: nextDone }).eq("id", id);
  }, []);

  const removeItem = useCallback(async (list: NotebookListKey, id: string) => {
    setLists((s) => ({ ...s, [list]: s[list].filter((it) => it.id !== id) }));
    if (id.startsWith("tmp-")) return;
    await supabase.from("notebook_items").delete().eq("id", id);
  }, []);

  const clearDone = useCallback(async (list: NotebookListKey) => {
    const toDelete = lists[list].filter((it) => it.done && !it.id.startsWith("tmp-"));
    setLists((s) => ({ ...s, [list]: s[list].filter((it) => !it.done) }));
    if (toDelete.length === 0) return;
    await supabase
      .from("notebook_items")
      .delete()
      .in("id", toDelete.map((it) => it.id));
  }, [lists]);

  const api: NotebookApi = { lists, loading, addItem, toggleItem, removeItem, clearDone };
  return (selector ? selector(api) : api) as T;
}

// =========================================
// Per-recipe ingredient progress (still local — per-chef workspace)
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
