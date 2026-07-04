import { SignOutButton, UserButton } from "@clerk/nextjs";
import { GitBranch } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-border bg-bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-accent" />
          <span className="font-semibold">RepoLens</span>
        </Link>
        <div className="flex items-center gap-4">
          <SignOutButton>
            <button className="text-sm text-text-secondary hover:text-text-primary">
              Sign out
            </button>
          </SignOutButton>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
