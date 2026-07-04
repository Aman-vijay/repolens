"use client";

import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";

import { useProjects } from "@/lib/queries";
import type { Project } from "@/lib/api";

export function ProjectList() {
  const { data: projects, isPending, isError } = useProjects();

  if (isPending) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border bg-bg-card"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-6 text-center text-text-secondary">
        Failed to load projects. Please refresh the page.
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-6 text-center text-text-secondary">
        No projects yet. Create your first one above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="flex items-center gap-4 rounded-lg border border-border bg-bg-card p-4 transition-colors hover:bg-white/5"
    >
      <Folder className="h-5 w-5 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-text-primary">
          {project.name}
        </h3>
        <p className="truncate text-sm text-text-secondary">
          {project.description ?? "No description"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
    </Link>
  );
}
