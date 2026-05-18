import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotebookListKey = "tasks" | "shopping" | "orders" | "warehouse";

export interface NotebookItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

interface NotebookState {
  lists: Record<NotebookListKey, NotebookItem[]>;
  addItem: (list: NotebookListKey, text: string) => void;
  toggleItem: (list: NotebookListKey, id: string) => void;
  removeItem: (list: NotebookListKey, id: string) => void;
  clearDone: (list: NotebookListKey) => void;
}

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set) => ({
      lists: { tasks: [], shopping: [], orders: [], warehouse: [] },
      addItem: (list, text) => {
        const clean = text.trim().slice(0, 200);
        if (!clean) return;
        set((s) => ({
          lists: {
            ...s.lists,
            [list]: [
              {
                id: crypto.randomUUID(),
                text: clean,
                done: false,
                createdAt: new Date().toISOString(),
              },
              ...s.lists[list],
            ],
          },
        }));
      },
      toggleItem: (list, id) =>
        set((s) => ({
          lists: {
            ...s.lists,
            [list]: s.lists[list].map((it) =>
              it.id === id ? { ...it, done: !it.done } : it,
            ),
          },
        })),
      removeItem: (list, id) =>
        set((s) => ({
          lists: {
            ...s.lists,
            [list]: s.lists[list].filter((it) => it.id !== id),
          },
        })),
      clearDone: (list) =>
        set((s) => ({
          lists: {
            ...s.lists,
            [list]: s.lists[list].filter((it) => !it.done),
          },
        })),
    }),
    { name: "pizzax-notebook-v1" },
  ),
);

// =========================================
// Per-recipe ingredient progress (chef's place-holder)
// =========================================

interface RecipeProgressState {
  // recipeId -> set of ingredient indices that are checked off
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
