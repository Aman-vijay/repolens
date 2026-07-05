import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Repository } from "@/lib/api";

// --- Project Slice ---
export interface ProjectSlice {
  activeProject: Project | null;
  activeRepository: Repository | null;
  setActiveProject: (project: Project | null) => void;
  setActiveRepository: (repo: Repository | null) => void;
  clearActiveState: () => void;
}

const createProjectSlice: StateCreator<ProjectSlice & UISlice, [], [], ProjectSlice> = (set) => ({
  activeProject: null,
  activeRepository: null,
  setActiveProject: (project) => set({ activeProject: project }),
  setActiveRepository: (repo) => set({ activeRepository: repo }),
  clearActiveState: () => set({ activeProject: null, activeRepository: null }),
});

// --- UI Slice ---
export interface UISlice {
  isRepoPickerOpen: boolean;
  globalSearchQuery: string;
  setRepoPickerOpen: (isOpen: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
}

const createUISlice: StateCreator<ProjectSlice & UISlice, [], [], UISlice> = (set) => ({
  isRepoPickerOpen: false,
  globalSearchQuery: "",
  setRepoPickerOpen: (isOpen) => set({ isRepoPickerOpen: isOpen }),
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
});

// --- Root Store ---
export type AppState = ProjectSlice & UISlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createProjectSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: "repolens-storage",
      partialize: (state) => ({ 
        activeProject: state.activeProject,
        activeRepository: state.activeRepository,
      }),
    }
  )
);
