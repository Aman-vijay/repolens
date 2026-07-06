"use client";

import { Brain, Loader2, CornerDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChatDiagnosticsProps {
  isLoading: boolean;
  thinkingStage: string;
  latestTrace: string | null;
  recentTraces: string[];
}

export function ChatDiagnostics({
  isLoading,
  thinkingStage,
  latestTrace,
  recentTraces,
}: ChatDiagnosticsProps) {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-4 backdrop-blur-sm shadow-[0_4px_15px_-3px_rgba(0,0,0,0.2)] animate-in fade-in duration-300">
      {/* Header Info Panel */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">
                {isLoading ? "Agent is working" : "Last run diagnostics"}
              </p>
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary"
              >
                {isLoading ? thinkingStage : "Needs stronger grounding"}
              </Badge>
            </div>
            <p className="max-w-[60ch] text-[11px] leading-5 text-muted-foreground">
              {isLoading
                ? "The assistant is inspecting repository evidence before writing its answer. Current progress is shown below so the thread never feels stalled."
                : "The assistant returned a low-confidence answer. These traces show what repository evidence was gathered so we can distinguish a weak backend result from a rendering problem."}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-background/40 px-3 py-1 text-[10px] text-muted-foreground sm:flex">
          <CornerDownLeft className="h-3 w-3 text-primary/75" />
          <span>Press <kbd className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded border border-border/80 text-[9px]">Shift + Enter</kbd> for new line</span>
        </div>
      </div>

      {/* Details status trails */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(260px,1.05fr)]">
        {/* Live status panel */}
        <div className="rounded-lg border border-border/80 bg-background/45 p-3 hover:bg-background/60 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Live status</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-foreground">
            {isLoading ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
            )}
            <span className="truncate">{latestTrace || "Preparing the next answer..."}</span>
          </div>
        </div>

        {/* Reasoning Trail panel */}
        <div className="rounded-lg border border-border/80 bg-background/45 p-3 hover:bg-background/60 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Reasoning trail</p>
          <div className="mt-3 space-y-1.5">
            {recentTraces.length > 0 ? (
              recentTraces.map((trace, index) => (
                <div
                  key={`${trace}-${index}`}
                  className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground animate-in slide-in-from-left-1 duration-150"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span className="truncate">{trace}</span>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <div className="h-2.5 w-3/4 animate-pulse rounded bg-muted/60" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/40" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
