"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { useCreateProject } from "@/lib/queries";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useCreateProject();

  const projectsList = useAppStore((state) => state.projectsList);
  const setProjectsList = useAppStore((state) => state.setProjectsList);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const clearActiveState = useAppStore((state) => state.clearActiveState);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { name, description },
      {
        onSuccess: (newProject) => {
          setName("");
          setDescription("");
          toast.success("Project created successfully.");
          
          // Update cache locally for instant UI update
          setProjectsList([newProject, ...(projectsList || [])]);
          clearActiveState();
          setActiveProject(newProject);

          // Redirect to the newly created project details page
          router.push(`/dashboard/${newProject.id}`);
        },
        onError: () => {
          toast.error("Failed to create project. Please try again.");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              placeholder="My awesome project\u2026"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project about\u2026"
            />
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending || name.trim().length === 0}
            className="w-full"
          >
            {mutation.isPending ? "Creating\u2026" : "Create Project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}