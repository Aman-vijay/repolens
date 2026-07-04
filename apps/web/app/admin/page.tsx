"use client";

import Link from "next/link";
import { Activity, Database, FolderGit2, Users } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { useAdminStats } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="rounded-md bg-muted p-2 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { data: stats, isPending, isError } = useAdminStats();

  if (isError) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="mt-4 text-sm text-destructive">
            Access denied. You need superadmin privileges.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">System overview</p>

        {isPending ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={<Users className="h-5 w-5" aria-hidden="true" />}
                label="Users"
                value={stats?.total_users ?? 0}
              />
              <StatCard
                icon={<FolderGit2 className="h-5 w-5" aria-hidden="true" />}
                label="Projects"
                value={stats?.total_projects ?? 0}
              />
              <StatCard
                icon={<Database className="h-5 w-5" aria-hidden="true" />}
                label="Repositories"
                value={stats?.total_repos ?? 0}
              />
            </div>

            {stats?.repos_by_status &&
              Object.keys(stats.repos_by_status).length > 0 && (
                <Card className="mt-6">
                  <CardContent className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Activity className="h-4 w-4" aria-hidden="true" />
                      Repository Status
                    </h2>
                    <div className="space-y-2">
                      {Object.entries(stats.repos_by_status).map(
                        ([status, count]) => (
                          <div
                            key={status}
                            className="flex items-center justify-between text-sm"
                          >
                            <Badge
                              variant={
                                status === "ready"
                                  ? "success"
                                  : status === "failed"
                                    ? "destructive"
                                    : "info"
                              }
                            >
                              {status}
                            </Badge>
                            <span className="font-medium tabular-nums">{count}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            <div className="mt-6 flex gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/users">View All Users</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/projects">View All Projects</Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </>
  );
}