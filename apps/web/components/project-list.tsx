"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";

import { useProjects } from "@/lib/queries";
import { useAppStore } from "@/lib/store";
import type { Project } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectList() {
  const projectsList = useAppStore((state) => state.projectsList);
  const setProjectsList = useAppStore((state) => state.setProjectsList);
  const { data: queryProjects, isPending: queryPending, isError } = useProjects();

  useEffect(() => {
    if (queryProjects) {
      setProjectsList(queryProjects);
    }
  }, [queryProjects, setProjectsList]);

  const projects = queryProjects || projectsList || [];
  const isPending = queryPending && (!projectsList || projectsList.length === 0);

  if (isPending) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Failed to load projects. Please refresh the page.
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No projects yet. Create your first one on the left.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const clearActiveState = useAppStore((state) => state.clearActiveState);

  return (
    <Link
      href={`/dashboard/${project.id}`}
      onClick={() => {
        clearActiveState(); // Clear previous repo state
        setActiveProject(project); // Pre-fill new project
      }}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Folder className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{project.name}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {project.description ?? "No description"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}