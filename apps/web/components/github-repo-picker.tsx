"use client";

import { useState } from "react";
import { GitBranch, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { useAttachRepository, useGitHubRepos } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export function GitHubRepoPicker({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { data: repos, isPending, isError } = useGitHubRepos();
  const attachMutation = useAttachRepository();
  const [search, setSearch] = useState("");

  const filtered = repos?.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Import from GitHub</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="search"
          placeholder="Search repositories\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />

        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Failed to load repos. Make sure GitHub scope is configured.
          </p>
        ) : filtered?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No public repos found.
          </p>
        ) : (
          <ScrollArea className="h-80 rounded-md border border-border">
            <div className="divide-y divide-border">
              {filtered?.map((repo) => (
                <div
                  key={repo.full_name}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{repo.full_name}</p>
                    {repo.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {repo.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                      <span>{repo.language ?? "\u2014"}</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" aria-hidden="true" />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" aria-hidden="true" />
                        {repo.default_branch ?? "main"}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={attachMutation.isPending}
                    onClick={() => {
                      attachMutation.mutate(
                        { projectId, url: repo.html_url },
                        {
                          onSuccess: () => {
                            toast.success("Repository attached. Cloning\u2026");
                            onClose();
                          },
                          onError: () => toast.error("Failed to attach repository."),
                        },
                      );
                    }}
                  >
                    Attach
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}