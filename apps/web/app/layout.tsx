import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

import { QueryProvider } from "@/components/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "RepoLens",
  description: "Understand and plan changes in unfamiliar codebases",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: dark }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <QueryProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
      </QueryProvider>
    </ClerkProvider>
  );
}
