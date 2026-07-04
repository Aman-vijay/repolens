"use client";

import { useEffect, useState } from "react";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Github, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, router]);

  if (authLoaded && isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-muted-foreground">Redirecting\u2026</p>
      </main>
    );
  }

  const handleGithubSignIn = async () => {
    if (!signInLoaded || !signIn) return;
    setIsLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error("GitHub sign-in failed:", err);
      toast.error("Failed to start GitHub sign-in. Check the console for details.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to RepoLens</CardTitle>
          <CardDescription>
            Sign in to analyze and understand repositories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGithubSignIn}
            disabled={!signInLoaded || isLoading}
            className="w-full bg-[#24292e] text-white hover:bg-[#2f363d]"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Github className="h-5 w-5" aria-hidden="true" />
            )}
            {isLoading ? "Redirecting\u2026" : "Continue with GitHub"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We only support GitHub authentication.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}