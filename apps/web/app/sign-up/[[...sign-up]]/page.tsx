"use client";

import { useEffect, useState } from "react";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Github } from "lucide-react";

type ClerkError = {
  errors?: Array<{ longMessage?: string; message?: string }>;
};

export default function SignUpPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
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

  const handleGithubSignUp = async () => {
    if (!signUpLoaded || !signUp) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error("GitHub sign-up failed:", err);
      const clerkError = err as ClerkError;
      setErrorMsg(
        clerkError.errors?.[0]?.longMessage ??
          clerkError.errors?.[0]?.message ??
          "GitHub sign-up could not start. Check your Clerk GitHub connection, redirect URLs, and application domain settings.",
      );
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">
            Create your RepoLens account
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Sign up with GitHub to get started
          </p>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-400">{errorMsg}</p>
        )}

        <div
          id="clerk-captcha"
          className="flex min-h-10 items-center justify-center"
        />

        <button
          onClick={handleGithubSignUp}
          disabled={!signUpLoaded || isLoading}
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
