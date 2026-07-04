"use client";

import Link from "next/link";
import { Users, FolderGit2, Database, Activity } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { useAdminStats } from "@/lib/queries";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-white/5 p-2 text-accent">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-sm text-text-secondary">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: stats, isPending, isError } = useAdminStats();

  if (isError) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-2xl font-bold text-text-primary">Admin</h1>
          <p className="mt-4 text-red-400">
            Access denied. You are not a superuser.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="mt-1 text-text-secondary">System overview</p>

        {isPending ? (
          <div className="mt-8 text-text-muted">Loading stats...</div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Users"
                value={stats?.total_users ?? 0}
              />
              <StatCard
                icon={<FolderGit2 className="h-5 w-5" />}
                label="Projects"
                value={stats?.total_projects ?? 0}
              />
              <StatCard
                icon={<Database className="h-5 w-5" />}
                label="Repositories"
                value={stats?.total_repos ?? 0}
              />
            </div>

            {stats?.repos_by_status &&
              Object.keys(stats.repos_by_status).length > 0 && (
                <div className="mt-6 rounded-lg border border-border bg-bg-card p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                    <Activity className="h-4 w-4" />
                    Repository status
                  </h2>
                  <div className="space-y-2">
                    {Object.entries(stats.repos_by_status).map(
                      ([status, count]) => (
                        <div
                          key={status}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-text-secondary">{status}</span>
                          <span className="font-medium text-text-primary">
                            {count}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            <div className="mt-6 flex gap-4">
              <Link
                href="/admin/users"
                className="rounded-md border border-border bg-bg-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/5"
              >
                View all users
              </Link>
              <Link
                href="/admin/projects"
                className="rounded-md border border-border bg-bg-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/5"
              >
                View all projects
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}