import { create } from "zustand";
import type { RecipeCategory } from "./cookbook";

interface UIState {
  category: RecipeCategory | "all";
  drawerOpen: boolean;
  setCategory: (c: RecipeCategory | "all") => void;
  setDrawerOpen: (o: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  category: "all",
  drawerOpen: false,
  setCategory: (category) => set({ category, drawerOpen: false }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
}));
