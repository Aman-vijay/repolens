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
  progress: number;
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

export type SearchHit = {
  id: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  content: string;
  chunk_index: number;
  score: number;
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
  if (res.status === 204) {
    return null as unknown as T;
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

export async function deleteProject(
  getToken: GetToken,
  projectId: string,
): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}`, getToken, {
    method: "DELETE",
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

export async function searchProjectCode(
  getToken: GetToken,
  projectId: string,
  input: { query: string; limit?: number },
): Promise<SearchHit[]> {
  return apiFetch<SearchHit[]>(`/api/projects/${projectId}/search`, getToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type RepositoryAnalysis = {
  id: string;
  repository_id: string;
  analysis_version: number;
  analysis_status: "pending" | "running" | "success" | "failed";
  snapshot_hash: string;
  model: string;
  prompt_version: string;
  executive_summary: string | null;
  architecture_summary: string | null;
  architecture_style: string | null;
  architecture_layers: string[] | null;
  tech_stack: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  } | null;
  repo_facts: {
    primary_language: string | null;
    repository_type: string;
    primary_framework: string;
    package_manager: string;
    containerized: boolean;
    ci_detected: boolean;
    license: string;
    documentation_quality: string;
    has_tests: boolean;
    has_readme: boolean;
    fact_sources?: Record<string, string>;
  } | null;
  repo_insights: {
    strengths: string[];
    risks: string[];
    notable_decisions: string[];
    patterns_detected: string[];
  } | null;
  source_context: {
    readme_present: boolean;
    readme_truncated: boolean;
    readme_chars: number;
    manifest_files_found: string[];
    top_chunks_used: number;
    total_context_chars: number;
  } | null;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  generation_latency_ms: number | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
};

export type RegenerateResponse = {
  status: "queued" | "unchanged" | "running";
  skipped: boolean;
};

export async function fetchAnalysis(
  getToken: GetToken,
  projectId: string,
): Promise<RepositoryAnalysis> {
  return apiFetch<RepositoryAnalysis>(`/api/projects/${projectId}/analysis`, getToken);
}

export async function regenerateAnalysis(
  getToken: GetToken,
  projectId: string,
): Promise<RegenerateResponse> {
  return apiFetch<RegenerateResponse>(`/api/projects/${projectId}/analysis/regenerate`, getToken, {
    method: "POST",
  });
}
