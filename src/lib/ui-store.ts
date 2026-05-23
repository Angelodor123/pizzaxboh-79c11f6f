import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecipeCategory } from "./cookbook";
import type { MenuCategory } from "./menu-categories";

interface UIState {
  category: RecipeCategory | "all";
  menuCategory: MenuCategory | "all";
  drawerOpen: boolean;
  isServiceMode: boolean;
  lastRecipeId: string | null;
  lastRecipeName: string | null;
  setCategory: (c: RecipeCategory | "all") => void;
  setMenuCategory: (c: MenuCategory | "all") => void;
  openDishes: (c?: MenuCategory | "all") => void;
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
      menuCategory: "all",
      drawerOpen: false,
      isServiceMode: false,
      lastRecipeId: null,
      lastRecipeName: null,
      setCategory: (category) => set({ category, drawerOpen: false }),
      setMenuCategory: (menuCategory) => set({ menuCategory, drawerOpen: false }),
      openDishes: (menuCategory = "all") =>
        set({ category: "dishes", menuCategory, drawerOpen: false }),
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

