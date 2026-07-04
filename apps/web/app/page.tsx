import Link from "next/link";
import { ArrowRight, GitBranch, Search, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" aria-hidden="true" />
          Understand any codebase in minutes
        </span>

        <h1
          className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl"
          style={{ textWrap: "balance" }}
        >
          RepoLens
        </h1>

        <p
          className="mt-4 text-lg text-muted-foreground"
          style={{ textWrap: "pretty" }}
        >
          Import a repository, get an instant file tree, language breakdown,
          and AI-powered summaries. No more spelunking through unfamiliar code.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-up">Create Account</Link>
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-sm">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Search className="h-5 w-5" aria-hidden="true" />
            <span>Explore file trees</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <GitBranch className="h-5 w-5" aria-hidden="true" />
            <span>Language breakdown</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Zap className="h-5 w-5" aria-hidden="true" />
            <span>AI summaries</span>
          </div>
        </div>
      </div>
    </main>
  );
}