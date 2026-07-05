"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  attachRepository,
  createProject,
  deleteProject,
  fetchAdminProjects,
  fetchAdminStats,
  fetchAdminUsers,
  fetchGitHubRepos,
  fetchProject,
  fetchProjects,
  fetchRepository,
  searchProjectCode,
  fetchAnalysis,
  regenerateAnalysis,
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

export function useProject(projectId: string | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(getToken, projectId!),
    enabled: !!projectId,
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
