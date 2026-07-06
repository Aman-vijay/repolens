import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Repository, RepositoryAnalysis } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant" | "data" | "tool";
  content: string;
}

// --- Project Slice ---
export interface ProjectSlice {
  activeProject: Project | null;
  activeRepository: Repository | null;
  activeAnalysis: RepositoryAnalysis | null;
  projectsList: Project[];
  setActiveProject: (project: Project | null) => void;
  setActiveRepository: (repo: Repository | null) => void;
  setActiveAnalysis: (analysis: RepositoryAnalysis | null) => void;
  setProjectsList: (projects: Project[]) => void;
  clearActiveState: () => void;
}

const createProjectSlice: StateCreator<ProjectSlice & UISlice & ChatSlice, [], [], ProjectSlice> = (set) => ({
  activeProject: null,
  activeRepository: null,
  activeAnalysis: null,
  projectsList: [],
  setActiveProject: (project) => set({ activeProject: project }),
  setActiveRepository: (repo) => set({ activeRepository: repo }),
  setActiveAnalysis: (analysis) => set({ activeAnalysis: analysis }),
  setProjectsList: (projects) => set({ projectsList: projects }),
  clearActiveState: () => set({ activeProject: null, activeRepository: null, activeAnalysis: null }),
});

// --- UI Slice ---
export interface UISlice {
  isRepoPickerOpen: boolean;
  globalSearchQuery: string;
  isChatSidebarOpen: boolean;
  setRepoPickerOpen: (isOpen: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
  setChatSidebarOpen: (isOpen: boolean) => void;
}

const createUISlice: StateCreator<ProjectSlice & UISlice & ChatSlice, [], [], UISlice> = (set) => ({
  isRepoPickerOpen: false,
  globalSearchQuery: "",
  isChatSidebarOpen: true, // Default to open
  setRepoPickerOpen: (isOpen) => set({ isRepoPickerOpen: isOpen }),
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  setChatSidebarOpen: (isOpen) => set({ isChatSidebarOpen: isOpen }),
});

// --- Chat Slice ---
export interface ChatSlice {
  chatThreads: Record<string, ChatMessage[]>;
  activeChatSessionId: string | null;
  cachedSessions: Record<string, any[]>;
  setChatMessages: (projectId: string, messages: ChatMessage[]) => void;
  clearChatThread: (projectId: string) => void;
  setActiveChatSessionId: (sessionId: string | null) => void;
  setCachedSessions: (projectId: string, sessions: any[]) => void;
}

const createChatSlice: StateCreator<ProjectSlice & UISlice & ChatSlice, [], [], ChatSlice> = (set) => ({
  chatThreads: {},
  activeChatSessionId: null,
  cachedSessions: {},
  setChatMessages: (projectId, messages) =>
    set((state) => ({
      chatThreads: { ...state.chatThreads, [projectId]: messages }
    })),
  clearChatThread: (projectId) =>
    set((state) => {
      const copy = { ...state.chatThreads };
      delete copy[projectId];
      return { chatThreads: copy };
    }),
  setActiveChatSessionId: (sessionId) => set({ activeChatSessionId: sessionId }),
  setCachedSessions: (projectId, sessions) =>
    set((state) => ({
      cachedSessions: { ...state.cachedSessions, [projectId]: sessions }
    })),
});

// --- Root Store ---
export type AppState = ProjectSlice & UISlice & ChatSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createProjectSlice(...a),
      ...createUISlice(...a),
      ...createChatSlice(...a),
    }),
    {
      name: "repolens-storage",
      partialize: (state) => ({
        activeProject: state.activeProject,
        activeRepository: state.activeRepository,
        activeAnalysis: state.activeAnalysis,
        isChatSidebarOpen: state.isChatSidebarOpen,
        cachedSessions: state.cachedSessions,
        projectsList: state.projectsList,
      }),
    }
  )
);
