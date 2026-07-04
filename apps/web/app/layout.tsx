import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Toaster } from "sonner";

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
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <QueryProvider>
        <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
          <head>
            <meta name="theme-color" content="#0a0a0a" />
          </head>
          <body className="min-h-screen bg-background text-foreground antialiased">
            {children}
            <Toaster
              theme="dark"
              position="bottom-right"
              richColors
              closeButton
            />
          </body>
        </html>
      </QueryProvider>
    </ClerkProvider>
  );
}