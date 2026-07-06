"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SearchHit } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function scoreColor(score: number): string {
  if (score >= 0.55) return "text-emerald-400";
  if (score >= 0.40) return "text-yellow-400";
  return "text-muted-foreground";
}

export function scoreLabel(score: number): string {
  if (score >= 0.55) return "Strong";
  if (score >= 0.40) return "Moderate";
  return "Weak";
}

interface SearchResultProps {
  hit: SearchHit;
  index: number;
}

export function SearchResult({ hit, index }: SearchResultProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const pathParts = hit.file_path.split("/");
  const shortPath =
    pathParts.length > 3
      ? "\u2026/" + pathParts.slice(-3).join("/")
      : hit.file_path;
  const lineCount = hit.end_line - hit.start_line + 1;

  return (
    <article className="rounded-md border border-border bg-card/50 transition-all duration-200 hover:border-border-hover">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        <span className="shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:scale-105">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/90 font-medium"
          title={hit.file_path}
        >
          {shortPath}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] h-5">
            {hit.language}
          </Badge>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            L{hit.start_line}&ndash;{hit.end_line}
            <span className="ml-1 text-muted-foreground/50">({lineCount} lines)</span>
          </span>
          <span className={cn("text-[11px] font-semibold tabular-nums", scoreColor(hit.score))}>
            {scoreLabel(hit.score)} ({hit.score.toFixed(2)})
          </span>
        </span>
      </button>
      
      {expanded && (
        <div className="border-t border-border animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-1.5">
            <span
              className="truncate font-mono text-[10px] text-muted-foreground/70 select-all"
              title={hit.file_path}
            >
              {hit.file_path}
            </span>
            <CopyButton text={hit.content} />
          </div>
          <div className="overflow-auto scrollbar-thin" style={{ maxHeight: "16rem" }}>
            <pre className="p-4 font-mono text-xs leading-5 text-foreground/85 whitespace-pre bg-card/10 select-text">
              <code>{hit.content}</code>
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}
