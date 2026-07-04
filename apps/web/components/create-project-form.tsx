"use client";

import { useState } from "react";

import { useCreateProject } from "@/lib/queries";

export function CreateProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useCreateProject();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(
          { name, description },
          {
            onSuccess: () => {
              setName("");
              setDescription("");
            },
          },
        );
      }}
      className="space-y-4 rounded-lg border border-border bg-bg-card p-6"
    >
      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-text-secondary"
        >
          Project name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={255}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text-primary outline-none focus:border-accent"
        />
      </div>
      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-text-secondary"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text-primary outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending || name.trim().length === 0}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {mutation.isPending ? "Creating..." : "Create project"}
      </button>
      {mutation.isError ? (
        <p className="text-sm text-red-400">
          Failed to create project. Please try again.
        </p>
      ) : null}
    </form>
  );
}
