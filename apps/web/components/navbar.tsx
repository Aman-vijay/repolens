"use client";

import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Navbar() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href={isSignedIn ? "/dashboard" : "/"}
          className="text-sm font-semibold tracking-tight"
        >
          RepoLens
        </Link>

        {isSignedIn ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}