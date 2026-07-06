"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Folder, MoreVertical, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useProjects, useUpdateProject, useDeleteProject } from "@/lib/queries";
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

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description ?? "");

  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const projectsList = useAppStore((state) => state.projectsList);
  const isNameDuplicate = (projectsList || []).some(
    (p) => p.id !== project.id && p.name.toLowerCase() === editName.trim().toLowerCase()
  );

  const handleUpdateSubmit = () => {
    const trimmedName = editName.trim();
    if (!trimmedName || isNameDuplicate) return;

    updateMutation.mutate(
      {
        projectId: project.id,
        input: {
          name: trimmedName,
          description: editDescription.trim() || null,
        },
      },
      {
        onSuccess: (updated) => {
          toast.success("Project updated successfully.");
          setIsEditing(false);
          
          // Instantly update Zustand projectsList cache
          const currentProjects = useAppStore.getState().projectsList || [];
          const updatedProjects = currentProjects.map((p) =>
            p.id === project.id ? updated : p
          );
          useAppStore.getState().setProjectsList(updatedProjects);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update project.");
        },
      }
    );
  };

  const handleDeleteSubmit = () => {
    deleteMutation.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted successfully.");
        setIsDeleting(false);

        // Filter out deleted project from Zustand projectsList cache
        const currentProjects = useAppStore.getState().projectsList || [];
        const updatedProjects = currentProjects.filter((p) => p.id !== project.id);
        useAppStore.getState().setProjectsList(updatedProjects);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete project.");
      },
    });
  };

  return (
    <div className="relative group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Link
        href={`/dashboard/${project.id}`}
        onClick={() => {
          clearActiveState();
          setActiveProject(project);
        }}
        className="absolute inset-0 z-0 rounded-lg"
      />
      
      <Folder className="relative z-10 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="relative z-10 min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{project.name}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {project.description ?? "No description"}
        </p>
      </div>
      
      {/* 3-dots action menu button */}
      <div className="relative z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowMenu(!showMenu);
          }}
          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {showMenu && (
          <>
            {/* Click-outside backdrop wrapper for the menu */}
            <div 
              className="fixed inset-0 z-20 cursor-default" 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowMenu(false);
              }}
            />
            <div 
              className="absolute right-0 top-7 z-30 w-32 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-medium hover:bg-muted transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setIsDeleting(true);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Project
              </button>
            </div>
          </>
        )}
      </div>
      
      <ChevronRight className="relative z-10 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      {/* Edit Details Custom Modal */}
      {isEditing && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsEditing(false);
          }}
        >
          <div 
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <h2 className="text-base font-semibold">Edit Project Details</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full rounded-md border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                    isNameDuplicate ? "border-destructive focus-visible:ring-destructive" : "border-input"
                  }`}
                  maxLength={255}
                />
                {isNameDuplicate && (
                  <p className="text-[11px] font-semibold text-destructive animate-in fade-in duration-200">
                    ⚠️ A project with this name already exists. Name must be unique.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending || !editName.trim() || isNameDuplicate}
                onClick={handleUpdateSubmit}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Custom Modal */}
      {isDeleting && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDeleting(false);
          }}
        >
          <div 
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <h2 className="text-base font-semibold text-destructive">Delete Project</h2>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{project.name}</strong>? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDeleteSubmit}
                className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-xs font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}