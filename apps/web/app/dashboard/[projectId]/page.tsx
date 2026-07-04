"use client";

import { use } from "react";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import { FileTree } from "@/components/file-tree";
import { GitHubRepoPicker } from "@/components/github-repo-picker";
import { LanguageBreakdown } from "@/components/language-breakdown";
import { Navbar } from "@/components/navbar";
import { useAttachRepository, useProject, useRepository } from "@/lib/queries";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3.5 w-3.5" />,
    cloning: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    ready: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
  };
  const colors: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-400/10",
    cloning: "text-blue-400 bg-blue-400/10",
    ready: "text-green-400 bg-green-400/10",
    failed: "text-red-400 bg-red-400/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: project, isPending: projectLoading } = useProject(projectId);
  const { data: repo } = useRepository(projectId);
  const attachMutation = useAttachRepository();
  const [showPicker, setShowPicker] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  if (projectLoading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-text-secondary">Project not found.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Back to dashboard
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-text-secondary">{project.description}</p>
        )}

        {/* Repository section */}
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Repository
          </h2>

          {!repo && !showPicker && (
            <div className="space-y-4 rounded-lg border border-border bg-bg-card p-6">
              <div className="flex gap-3">
                <input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
                <button
                  onClick={() =>
                    attachMutation.mutate({ projectId, url: manualUrl })
                  }
                  disabled={!manualUrl.trim() || attachMutation.isPending}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {attachMutation.isPending ? "Attaching..." : "Clone"}
                </button>
              </div>
              {attachMutation.isError && (
                <p className="text-sm text-red-400">
                  Failed to attach repository.
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>or</span>
                <button
                  onClick={() => setShowPicker(true)}
                  className="text-accent hover:underline"
                >
                  Import from GitHub
                </button>
              </div>
            </div>
          )}

          {showPicker && !repo && (
            <GitHubRepoPicker
              projectId={projectId}
              onClose={() => setShowPicker(false)}
            />
          )}

          {repo && (
            <div className="space-y-6 rounded-lg border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-text-primary">
                    {repo.url}
                  </p>
                  {repo.default_branch && (
                    <p className="mt-0.5 text-xs text-text-muted">
                      branch: {repo.default_branch}
                    </p>
                  )}
                </div>
                <StatusBadge status={repo.status} />
              </div>

              {repo.status === "failed" && repo.error_message && (
                <p className="text-sm text-red-400">{repo.error_message}</p>
              )}

              {repo.status === "ready" && (
                <>
                  <div className="flex gap-6 text-sm text-text-secondary">
                    <span>{repo.file_count} files</span>
                    <span>{formatBytes(repo.total_size_bytes)}</span>
                  </div>

                  {repo.languages && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Languages
                      </h3>
                      <LanguageBreakdown languages={repo.languages} />
                    </div>
                  )}

                  {repo.file_tree && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        File tree
                      </h3>
                      <FileTree tree={repo.file_tree} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}