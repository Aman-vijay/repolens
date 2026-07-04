export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Repository = {
  id: string;
  project_id: string;
  url: string;
  status: string;
  default_branch: string | null;
  file_count: number;
  total_size_bytes: number;
  languages: Record<string, { files: number; bytes: number }> | null;
  file_tree: TreeNode | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDetail = Project & {
  repository: Repository | null;
};

export type TreeNode = {
  name: string;
  type: "file" | "dir";
  size?: number;
  truncated?: boolean;
  children?: TreeNode[];
};

export type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string | null;
};

export type AdminStats = {
  total_users: number;
  total_projects: number;
  total_repos: number;
  repos_by_status: Record<string, number>;
};

export type AdminUser = {
  id: string;
  clerk_user_id: string;
  email: string;
  is_superuser: boolean;
  created_at: string;
  project_count: number;
};

export type AdminProject = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  user_email: string;
  repo_status: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type GetToken = () => Promise<string | null>;

export async function apiFetch<T>(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error("No auth token available");
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const payload = (await res.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep the default message when the response body is not JSON.
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(getToken: GetToken): Promise<Project[]> {
  return apiFetch<Project[]>("/api/projects", getToken);
}

export async function createProject(
  getToken: GetToken,
  input: { name: string; description?: string },
): Promise<Project> {
  return apiFetch<Project>("/api/projects", getToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProject(
  getToken: GetToken,
  projectId: string,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/projects/${projectId}`, getToken);
}

export async function attachRepository(
  getToken: GetToken,
  projectId: string,
  url: string,
): Promise<Repository> {
  return apiFetch<Repository>(`/api/projects/${projectId}/repository`, getToken, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function fetchRepository(
  getToken: GetToken,
  projectId: string,
): Promise<Repository> {
  return apiFetch<Repository>(`/api/projects/${projectId}/repository`, getToken);
}

export async function fetchGitHubRepos(
  getToken: GetToken,
): Promise<GitHubRepo[]> {
  return apiFetch<GitHubRepo[]>("/api/github/repos", getToken);
}

export async function fetchAdminStats(
  getToken: GetToken,
): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/admin/stats", getToken);
}

export async function fetchAdminUsers(
  getToken: GetToken,
): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>("/api/admin/users", getToken);
}

export async function fetchAdminProjects(
  getToken: GetToken,
): Promise<AdminProject[]> {
  return apiFetch<AdminProject[]>("/api/admin/projects", getToken);
}
