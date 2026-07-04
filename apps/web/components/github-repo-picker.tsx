"use client";

import { useState } from "react";
import { GitBranch, Loader2, Star } from "lucide-react";

import { useAttachRepository, useGitHubRepos } from "@/lib/queries";

export function GitHubRepoPicker({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { data: repos, isPending, isError, error } = useGitHubRepos();
  const attachMutation = useAttachRepository();
  const [search, setSearch] = useState("");

  const filtered = repos?.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4 rounded-lg border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Import from GitHub
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        placeholder="Search repos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      />

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-red-400">
          {error instanceof Error
            ? error.message
            : "Failed to load repos. Make sure GitHub scope is configured."}
        </p>
      ) : filtered?.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          No public repos found.
        </p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-auto">
          {filtered?.map((repo) => {
            const attaching = attachMutation.isPending;
            return (
              <div
                key={repo.full_name}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {repo.full_name}
                  </p>
                  {repo.description && (
                    <p className="truncate text-xs text-text-secondary">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <span>{repo.language ?? "—"}</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {repo.stargazers_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.default_branch ?? "main"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => attachMutation.mutate(
                    { projectId, url: repo.html_url },
                    { onSuccess: onClose },
                  )}
                  disabled={attaching}
                  className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {attaching ? "..." : "Attach"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
