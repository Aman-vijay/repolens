"use client";

import { Loader2 } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { useAdminUsers } from "@/lib/queries";

export default function AdminUsersPage() {
  const { data: users, isPending, isError } = useAdminUsers();

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
        <h1 className="text-2xl font-bold text-text-primary">All Users</h1>

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
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Superuser
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Projects
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users?.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-text-primary">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_superuser ? (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                          Yes
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {user.project_count}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
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