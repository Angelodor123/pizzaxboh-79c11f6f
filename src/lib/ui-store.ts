import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecipeCategory } from "./cookbook";

interface UIState {
  category: RecipeCategory | "all";
  drawerOpen: boolean;
  isServiceMode: boolean;
  lastRecipeId: string | null;
  lastRecipeName: string | null;
  setCategory: (c: RecipeCategory | "all") => void;
  setDrawerOpen: (o: boolean) => void;
  toggleServiceMode: () => void;
  setServiceMode: (v: boolean) => void;
  setLastRecipe: (id: string, name: string) => void;
  clearLastRecipe: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      category: "all",
      drawerOpen: false,
      isServiceMode: false,
      lastRecipeId: null,
      lastRecipeName: null,
      setCategory: (category) => set({ category, drawerOpen: false }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      toggleServiceMode: () =>
        set((s) => ({ isServiceMode: !s.isServiceMode })),
      setServiceMode: (isServiceMode) => set({ isServiceMode }),
      setLastRecipe: (id, name) => set({ lastRecipeId: id, lastRecipeName: name }),
      clearLastRecipe: () => set({ lastRecipeId: null, lastRecipeName: null }),
    }),
    {
      name: "pizzax-ui-v1",
      partialize: (s) => ({
        isServiceMode: s.isServiceMode,
        lastRecipeId: s.lastRecipeId,
        lastRecipeName: s.lastRecipeName,
      }),
    },
  ),
);
