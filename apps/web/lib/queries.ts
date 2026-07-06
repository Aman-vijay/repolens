"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  attachRepository,
  createProject,
  deleteProject,
  updateProject,
  deleteChatSession,
  fetchAdminProjects,
  fetchAdminStats,
  fetchAdminUsers,
  fetchAnalysis,
  fetchChatSession,
  fetchChatSessions,
  fetchGitHubRepos,
  fetchProject,
  fetchProjects,
  fetchRepository,
  regenerateAnalysis,
  searchProjectCode,
  explainSearch,
  createPlanSession,
  fetchPlanSessions,
  fetchPlanSession,
  refinePlan,
  deletePlanSession,
} from "@/lib/api";

export function useProjects() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(getToken),
  });
}

export function useCreateProject() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      createProject(getToken, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(getToken, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: { name?: string; description?: string | null };
    }) => updateProject(getToken, projectId, input),
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", updatedProject.id] });
    },
  });
}

export function useProject(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(getToken, projectId!),
    enabled: !!projectId,
    staleTime: 30 * 1000, // Serve instantly from cache if less than 30s old
  });
}

export function useAttachRepository() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, url }: { projectId: string; url: string }) =>
      attachRepository(getToken, projectId, url),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["repository", projectId] });
    },
  });
}

export function useRepository(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["repository", projectId],
    queryFn: () => fetchRepository(getToken, projectId!),
    enabled: !!projectId,
    staleTime: 15 * 1000, // Serve instantly from cache if less than 15s old
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "cloning") return 3000;
      return false;
    },
  });
}

export function useGitHubRepos() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["github-repos"],
    queryFn: () => fetchGitHubRepos(getToken),
  });
}

export function useAdminStats() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchAdminStats(getToken),
  });
}

export function useAdminUsers() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchAdminUsers(getToken),
  });
}

export function useAdminProjects() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["admin-projects"],
    queryFn: () => fetchAdminProjects(getToken),
  });
}

export function useSearchCode() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: ({
      projectId,
      query,
      limit,
    }: {
      projectId: string;
      query: string;
      limit?: number;
    }) => searchProjectCode(getToken, projectId, { query, limit }),
  });
}

export function useExplainSearch() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: ({
      projectId,
      query,
      limit,
    }: {
      projectId: string;
      query: string;
      limit?: number;
    }) => explainSearch(getToken, projectId, { query, limit }),
  });
}

export function useAnalysis(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["analysis", projectId],
    queryFn: () => fetchAnalysis(getToken, projectId!),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.analysis_status;
      if (status === "pending" || status === "running") return 3000;
      return false;
    },
  });
}

export function useRegenerateAnalysis() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => regenerateAnalysis(getToken, projectId),
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["analysis", projectId] });
    },
  });
}

export function useChatSessions(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["chat-sessions", projectId],
    queryFn: () => fetchChatSessions(getToken, projectId!),
    enabled: !!projectId,
  });
}

export function useChatSession(projectId: string | undefined, sessionId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["chat-session", projectId, sessionId],
    queryFn: () => fetchChatSession(getToken, projectId!, sessionId!),
    enabled: !!projectId && !!sessionId,
  });
}

export function useDeleteChatSession() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, sessionId }: { projectId: string; sessionId: string }) =>
      deleteChatSession(getToken, projectId, sessionId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", projectId] });
    },
  });
}

export function usePlanSessions(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["plan-sessions", projectId],
    queryFn: () => fetchPlanSessions(getToken, projectId!),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function usePlanSession(projectId: string | undefined, sessionId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["plan-session", projectId, sessionId],
    queryFn: () => fetchPlanSession(getToken, projectId!, sessionId!),
    enabled: !!projectId && !!sessionId,
    refetchInterval: (query) => {
      const versions = query.state.data?.versions || [];
      const hasGenerating = versions.some((v) => v.status === "pending" || v.status === "generating");
      return hasGenerating ? 3000 : false;
    },
  });
}

export function useCreatePlan() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, featureRequest }: { projectId: string; featureRequest: string }) =>
      createPlanSession(getToken, projectId, featureRequest),
    onSuccess: (newSession, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["plan-sessions", projectId] });
    },
  });
}

export function useRefinePlan() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      sessionId,
      refinementPrompt,
    }: {
      projectId: string;
      sessionId: string;
      refinementPrompt: string;
    }) => refinePlan(getToken, projectId, sessionId, refinementPrompt),
    onSuccess: (newVersion, { projectId, sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ["plan-session", projectId, sessionId] });
    },
  });
}

export function useDeletePlanSession() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, sessionId }: { projectId: string; sessionId: string }) =>
      deletePlanSession(getToken, projectId, sessionId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["plan-sessions", projectId] });
    },
  });
}
