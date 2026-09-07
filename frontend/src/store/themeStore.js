import { create } from "zustand";
import { persist } from "zustand/middleware";

const useThemeStore = create(
  persist(
    (set) => ({
      theme: "dark",
      sidebarCollapsed: false,

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "ui-preferences" }
  )
);

export const useTheme = () => useThemeStore((state) => state.theme);
export const useToggleTheme = () => useThemeStore((state) => state.toggleTheme);
export const useSidebarCollapsed = () => useThemeStore((state) => state.sidebarCollapsed);
export const useToggleSidebar = () => useThemeStore((state) => state.toggleSidebar);

export default useThemeStore;
