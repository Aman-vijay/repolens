"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Trash2,
} from "lucide-react";

import dynamic from "next/dynamic";

const CodebaseChat = dynamic(
  () => import("@/components/codebase-chat").then((mod) => mod.CodebaseChat),
  {
    loading: () => <Skeleton className="h-[680px] w-full" />,
    ssr: false,
  }
);

const RepositoryIntelligence = dynamic(
  () => import("@/components/repository-intelligence").then((mod) => mod.RepositoryIntelligence),
  {
    loading: () => <Skeleton className="h-48 w-full" />,
  }
);

const ProjectCodeSearch = dynamic(
  () => import("@/components/project-code-search").then((mod) => mod.ProjectCodeSearch),
  {
    loading: () => <Skeleton className="h-28 w-full" />,
  }
);

const FileTree = dynamic(
  () => import("@/components/file-tree").then((mod) => mod.FileTree),
  {
    loading: () => <Skeleton className="h-56 w-full" />,
  }
);

const ImplementationPlanner = dynamic(
  () => import("@/components/implementation-planner").then((mod) => mod.ImplementationPlanner),
  {
    loading: () => <Skeleton className="h-[720px] w-full" />,
    ssr: false,
  }
);
import { GitHubRepoPicker } from "@/components/github-repo-picker";
import { LanguageBreakdown } from "@/components/language-breakdown";
import { Navbar } from "@/components/navbar";
import {
  useAttachRepository,
  useProject,
  useRepository,
  useDeleteProject,
} from "@/lib/queries";
import { useAppStore } from "@/lib/store";
import { cn, formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";


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
  const { data: queryProject, isPending: projectLoading } = useProject(projectId);
  const { data: queryRepo, isPending: repoLoading } = useRepository(projectId);
  const attachMutation = useAttachRepository();
  const deleteMutation = useDeleteProject();
  const router = useRouter();
  
  const { 
    activeProject, setActiveProject, 
    activeRepository, setActiveRepository,
    isRepoPickerOpen, setRepoPickerOpen 
  } = useAppStore();

  const [manualUrl, setManualUrl] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"explorer" | "chat" | "planner">("explorer");

  // Listen for file link clicks in Chat to automatically switch to the Explorer view
  useEffect(() => {
    const handleOpenFile = () => {
      setActiveTab("explorer");
    };
    window.addEventListener("repolens:open-file", handleOpenFile);
    return () => window.removeEventListener("repolens:open-file", handleOpenFile);
  }, []);

  // Sync fresh React Query data into Zustand
  useEffect(() => {
    if (queryProject) setActiveProject(queryProject);
  }, [queryProject, setActiveProject]);

  useEffect(() => {
    if (queryRepo) setActiveRepository(queryRepo);
  }, [queryRepo, setActiveRepository]);

  // Use cached Zustand data for instant loads if the ID matches
  const project = (activeProject?.id === projectId) ? activeProject : queryProject;
  const repo = (activeRepository?.project_id === projectId) ? activeRepository : queryRepo;
  const isLoading = projectLoading && !project;
  const isRepoLoading = repoLoading && !repo;

  const handleDelete = () => {
    deleteMutation.mutate(projectId, {
      onSuccess: () => {
        toast.success("Project deleted successfully.");
        
        // Filter out the deleted project from local Zustand cache
        const currentProjects = useAppStore.getState().projectsList || [];
        const updatedProjects = currentProjects.filter((p) => p.id !== projectId);
        useAppStore.getState().setProjectsList(updatedProjects);

        useAppStore.getState().clearActiveState(); // clear cache
        router.push("/dashboard");
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete project."
        );
        setIsDeleteDialogOpen(false);
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-8">
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
        <main className="mx-auto max-w-6xl px-6 py-8">
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="sm:shrink-0 self-start"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Project
          </Button>
        </div>

        <div className="mt-8 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Repository
          </h2>

          {isRepoLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !repo && !isRepoPickerOpen ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="repo-url">Git URL</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="repo-url"
                      type="url"
                      placeholder="https://github.com/user/repo"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      autoComplete="off"
                      className="flex-1"
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
                  <Button variant="link" size="sm" className="px-1" onClick={() => setRepoPickerOpen(true)}>
                    Import from GitHub
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isRepoPickerOpen && !repo && (
            <GitHubRepoPicker projectId={projectId} onClose={() => setRepoPickerOpen(false)} />
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
                    <Progress value={repo.progress} />
                    <p className="text-center text-xs text-muted-foreground">
                      {repo.status === "cloning" ? "Cloning repository\u2026" : "Queued\u2026"}
                    </p>
                  </div>
                )}

                {repo.status === "ready" && (
                  <div className="space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-border/60 pb-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("explorer")}
                          className={cn(
                            "px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-all",
                            activeTab === "explorer"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Project Explorer
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("chat")}
                          className={cn(
                            "px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-all",
                            activeTab === "chat"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Codebase Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("planner")}
                          className={cn(
                            "px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-all",
                            activeTab === "planner"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Implementation Planner
                        </button>
                      </div>

                      {activeTab === "explorer" ? (
                        <div className="space-y-6 animate-in fade-in duration-250">
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

                          <RepositoryIntelligence projectId={projectId} />

                          {repo.file_tree && (
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                File Tree
                              </h3>
                              <FileTree tree={repo.file_tree} />
                            </div>
                          )}

                          <ProjectCodeSearch projectId={projectId} />
                        </div>
                      ) : activeTab === "chat" ? (
                        <div className="animate-in fade-in duration-250">
                          <CodebaseChat projectId={projectId} />
                        </div>
                      ) : (
                        <div className="animate-in fade-in duration-250">
                          <ImplementationPlanner projectId={projectId} />
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md shadow-lg border-destructive/20">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">Are you absolutely sure?</h2>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete your project, including the repository metadata and all code search embeddings.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Project"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
