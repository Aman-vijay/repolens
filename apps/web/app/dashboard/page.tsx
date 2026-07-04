import { CreateProjectForm } from "@/components/create-project-form";
import { Navbar } from "@/components/navbar";
import { ProjectList } from "@/components/project-list";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your repository analysis projects
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New Project
            </h2>
            <CreateProjectForm />
          </div>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Projects
            </h2>
            <ProjectList />
          </div>
        </div>
      </main>
    </>
  );
}