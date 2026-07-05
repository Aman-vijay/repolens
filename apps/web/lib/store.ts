import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Repository } from "@/lib/api";

type AppState = {
  // We can cache the active project and repository here for instant loads
  // while React Query fetches fresh data in the background
  activeProject: Project | null;
  activeRepository: Repository | null;
  
  // UI States
  isRepoPickerOpen: boolean;
  globalSearchQuery: string;

  // Actions
  setActiveProject: (project: Project | null) => void;
  setActiveRepository: (repo: Repository | null) => void;
  setRepoPickerOpen: (isOpen: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
  
  // Reset
  clearActiveState: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProject: null,
      activeRepository: null,
      isRepoPickerOpen: false,
      globalSearchQuery: "",

      setActiveProject: (project) => set({ activeProject: project }),
      setActiveRepository: (repo) => set({ activeRepository: repo }),
      setRepoPickerOpen: (isOpen) => set({ isRepoPickerOpen: isOpen }),
      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
      
      clearActiveState: () => set({ activeProject: null, activeRepository: null }),
    }),
    {
      name: "repolens-storage",
      // Only persist certain fields to localStorage so they load instantly on refresh
      partialize: (state) => ({ 
        activeProject: state.activeProject,
        activeRepository: state.activeRepository,
      }),
    }
  )
);
