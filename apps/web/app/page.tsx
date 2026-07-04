import Link from "next/link";
import { GitBranch, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <GitBranch className="mx-auto mb-6 h-12 w-12 text-accent" />
        <h1 className="text-4xl font-bold tracking-tight">RepoLens</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Understand and plan changes in unfamiliar codebases.
          Import a repo, get AI-generated architecture summaries, chat with
          your code, and generate implementation plans.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 rounded-md bg-accent px-6 py-3 font-medium text-white hover:bg-accent-hover"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-border px-6 py-3 font-medium text-text-primary hover:bg-bg-card"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
