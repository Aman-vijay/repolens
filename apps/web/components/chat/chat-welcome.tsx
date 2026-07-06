"use client";

import { Brain, ChevronRight, FileSearch, HelpCircle, GitBranch, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChatWelcomeProps {
  framework: string;
  evidenceHint: string;
  agentMessageCount: number;
  suggestedQuestions: string[];
  onSelectQuestion: (question: string) => void;
}

export function ChatWelcome({
  framework,
  evidenceHint,
  agentMessageCount,
  suggestedQuestions,
  onSelectQuestion,
}: ChatWelcomeProps) {
  const capabilityChips = [
    { label: "Architecture", icon: GitBranch },
    { label: "File paths", icon: FileSearch },
    { label: "Execution flow", icon: Brain },
  ];

  return (
    <div className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      {/* Left Column: Greeting and Signal Status Cards */}
      <div className="space-y-5 rounded-xl border border-border bg-card/40 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-all duration-300 hover:border-primary/20">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] text-primary font-medium animate-pulse">
            <Brain className="h-3.5 w-3.5" />
            Developer-first repository agent
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-semibold tracking-tight text-foreground">
              Ask about this codebase
            </h4>
            <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
              Use natural language. The agent retrieves architectural context, inspects likely files, and explains how the repository is actually wired.
            </p>
          </div>
        </div>

        {/* Quick Signal Cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-background/45 p-3 transition-colors hover:bg-background/60">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Signal</p>
            <p className="mt-2 text-xs font-medium text-foreground">Repository-aware answers</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/45 p-3 transition-colors hover:bg-background/60">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Thinking</p>
            <p className="mt-2 text-xs font-medium text-foreground">Visible retrieval progress</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/45 p-3 transition-colors hover:bg-background/60">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Output</p>
            <p className="mt-2 text-xs font-medium text-foreground">File-grounded guidance</p>
          </div>
        </div>
      </div>

      {/* Right Column: Suggested starting points */}
      <div className="space-y-3 rounded-xl border border-border bg-card/25 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/10">
        <div>
          <h5 className="text-sm font-semibold text-foreground">Suggested starting points</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Seed the composer with a focused question and refine from there.
          </p>
        </div>
        <div className="grid gap-2">
          {suggestedQuestions.map((question, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectQuestion(question)}
              className="group flex items-start gap-3 rounded-lg border border-border/80 bg-background/40 px-3 py-3 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/75 transition-colors group-hover:text-primary" />
              <span className="flex-1 text-xs leading-5 text-foreground/90 transition-colors group-hover:text-foreground">
                {question}
              </span>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
