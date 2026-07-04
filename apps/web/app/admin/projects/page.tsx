"use client";

import { Loader2 } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { useAdminProjects } from "@/lib/queries";

export default function AdminProjectsPage() {
  const { data: projects, isPending, isError } = useAdminProjects();

  if (isError) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-red-400">Access denied.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold text-text-primary">
          All Projects
        </h1>

        {isPending ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-bg-card">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Repo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects?.map((project) => (
                  <tr key={project.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-text-primary">
                      {project.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {project.user_email}
                    </td>
                    <td className="px-4 py-3">
                      {project.repo_status ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            project.repo_status === "ready"
                              ? "bg-green-400/10 text-green-400"
                              : project.repo_status === "failed"
                                ? "bg-red-400/10 text-red-400"
                                : "bg-blue-400/10 text-blue-400"
                          }`}
                        >
                          {project.repo_status}
                        </span>
                      ) : (
                        <span className="text-text-muted">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}