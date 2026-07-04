"use client";

import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Github, AlertCircle } from "lucide-react";

type ClerkError = {
  errors?: Array<{ longMessage?: string; message?: string }>;
};

export default function SignInPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, router]);

  if (authLoaded && isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-text-secondary">Redirecting…</p>
      </main>
    );
  }

  const availableFactors =
    signInLoaded && signIn ? signIn.supportedFirstFactors ?? [] : [];
  const githubAvailable = availableFactors.some(
    (f: { strategy: string }) => f.strategy === "oauth_github",
  );

  const handleGithubSignIn = async () => {
    if (!signInLoaded || !signIn) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error("GitHub sign-in failed:", err);
      console.error(
        "Available strategies:",
        signIn?.supportedFirstFactors ?? "unavailable",
      );
      const clerkError = err as ClerkError;
      setErrorMsg(
        clerkError.errors?.[0]?.longMessage ??
          clerkError.errors?.[0]?.message ??
          "GitHub sign-in could not start. Check your Clerk GitHub connection, redirect URLs, and application domain settings.",
      );
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">
            Welcome to RepoLens
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Sign in to analyze and understand repositories
          </p>
        </div>

        {signInLoaded && availableFactors.length > 0 && !githubAvailable && (
          <div className="space-y-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">GitHub not enabled</span>
            </div>
            <p className="text-yellow-200/80">
              GitHub social connection is turned off in your Clerk instance.
              Enable it in Clerk Dashboard → User &amp; Authentication →
              Social Connections → GitHub (toggle ON).
            </p>
          </div>
        )}

        {errorMsg && (
          <p className="text-sm text-red-400">{errorMsg}</p>
        )}

        <button
          onClick={handleGithubSignIn}
          disabled={!signInLoaded || isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-md bg-[#24292e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2f363d] disabled:opacity-50"
        >
          <Github className="h-5 w-5" />
          {isLoading ? "Redirecting..." : "Continue with GitHub"}
        </button>
        <p className="text-center text-xs text-text-secondary">
          We only support GitHub authentication.
        </p>
      </div>
    </main>
  );
}
