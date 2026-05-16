import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecipeCategory } from "./cookbook";

interface UIState {
  category: RecipeCategory | "all";
  drawerOpen: boolean;
  isServiceMode: boolean;
  setCategory: (c: RecipeCategory | "all") => void;
  setDrawerOpen: (o: boolean) => void;
  toggleServiceMode: () => void;
  setServiceMode: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      category: "all",
      drawerOpen: false,
      isServiceMode: false,
      setCategory: (category) => set({ category, drawerOpen: false }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      toggleServiceMode: () =>
        set((s) => ({ isServiceMode: !s.isServiceMode })),
      setServiceMode: (isServiceMode) => set({ isServiceMode }),
    }),
    {
      name: "pizzax-ui-v1",
      partialize: (s) => ({ isServiceMode: s.isServiceMode }),
    },
  ),
);
