"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  GitBranch,
  Star,
} from "lucide-react";

import { FileTree } from "@/components/file-tree";
import { GitHubRepoPicker } from "@/components/github-repo-picker";
import { LanguageBreakdown } from "@/components/language-breakdown";
import { Navbar } from "@/components/navbar";
import { useAttachRepository, useGitHubRepos, useProject, useRepository } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3 w-3" aria-hidden="true" />,
    cloning: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    ready: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
    failed: <XCircle className="h-3 w-3" aria-hidden="true" />,
  };
  const variants: Record<string, "warning" | "info" | "success" | "destructive"> = {
    pending: "warning",
    cloning: "info",
    ready: "success",
    failed: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {icons[status]}
      {status}
    </Badge>
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
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-20 w-full" />
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-muted-foreground">Project not found.</p>
          <Button asChild variant="link" className="mt-4">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        )}

        <div className="mt-8 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Repository
          </h2>

          {!repo && !showPicker && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="repo-url">Git URL</Label>
                  <div className="flex gap-3">
                    <Input
                      id="repo-url"
                      type="url"
                      placeholder="https://github.com/user/repo"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      autoComplete="off"
                    />
                    <Button
                      onClick={() => {
                        attachMutation.mutate(
                          { projectId, url: manualUrl },
                          {
                            onSuccess: () => {
                              setManualUrl("");
                              toast.success("Repository attached. Cloning\u2026");
                            },
                            onError: () => toast.error("Failed to attach repository."),
                          },
                        );
                      }}
                      disabled={!manualUrl.trim() || attachMutation.isPending}
                    >
                      {attachMutation.isPending ? "Attaching\u2026" : "Clone"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>or</span>
                  <Button variant="link" size="sm" className="px-1" onClick={() => setShowPicker(true)}>
                    Import from GitHub
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showPicker && !repo && (
            <GitHubRepoPicker projectId={projectId} onClose={() => setShowPicker(false)} />
          )}

          {repo && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{repo.url}</p>
                    {repo.default_branch && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        branch: {repo.default_branch}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={repo.status} />
                </div>

                {repo.status === "failed" && repo.error_message && (
                  <p className="text-sm text-destructive">{repo.error_message}</p>
                )}

                {(repo.status === "pending" || repo.status === "cloning") && (
                  <div className="space-y-2">
                    <Progress value={repo.status === "cloning" ? 30 : 0} />
                    <p className="text-center text-xs text-muted-foreground">
                      {repo.status === "cloning" ? "Cloning repository\u2026" : "Queued\u2026"}
                    </p>
                  </div>
                )}

                {repo.status === "ready" && (
                  <>
                    <div className="flex gap-6 text-sm tabular-nums text-muted-foreground">
                      <span>{repo.file_count} files</span>
                      <span>{formatBytes(repo.total_size_bytes)}</span>
                    </div>

                    {repo.languages && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Languages
                        </h3>
                        <LanguageBreakdown languages={repo.languages} />
                      </div>
                    )}

                    {repo.file_tree && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          File Tree
                        </h3>
                        <FileTree tree={repo.file_tree} />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}