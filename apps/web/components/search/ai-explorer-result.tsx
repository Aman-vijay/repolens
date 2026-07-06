"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ChunkExplanation } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function roleBadgeColor(role: string): string {
  switch (role) {
    case "entry_point":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "main_implementation":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "supporting_utility":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    case "configuration":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "tests":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function roleBadgeLabel(role: string): string {
  switch (role) {
    case "entry_point":
      return "Entry Point";
    case "main_implementation":
      return "Main Implementation";
    case "supporting_utility":
      return "Utility";
    case "configuration":
      return "Config";
    case "tests":
      return "Tests";
    default:
      return role.replace("_", " ");
  }
}

interface AIExplorerResultProps {
  explanation: ChunkExplanation;
  index: number;
}

export function AIExplorerResult({ explanation, index }: AIExplorerResultProps) {
  const [expanded, setExpanded] = useState(index === 0);

  const pathParts = explanation.file_path.split("/");
  const shortPath =
    pathParts.length > 3
      ? "\u2026/" + pathParts.slice(-3).join("/")
      : explanation.file_path;

  const lines = explanation.content.split("\n");

  return (
    <article className="rounded-md border border-border bg-card/40 overflow-hidden space-y-2 hover:border-border-hover transition-all duration-200">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        <span className="shrink-0 text-muted-foreground/50">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>

        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="font-mono text-xs text-foreground/90 font-medium truncate" title={explanation.file_path}>
            {shortPath}
          </span>
          {explanation.symbol_name && (
            <Badge variant="outline" className="font-mono text-[9px] tracking-wide text-muted-foreground/80 border-border/60 self-start px-1.5 h-4.5">
              {explanation.symbol_name}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[9px] uppercase font-bold border h-5 px-1.5", roleBadgeColor(explanation.role))}
          >
            {roleBadgeLabel(explanation.role)}
          </Badge>
          <span className="text-[11px] tabular-nums text-muted-foreground/75">
            L{explanation.start_line}&ndash;{explanation.end_line}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/5 space-y-3 animate-in slide-in-from-top-1 duration-200">
          {/* Explanation Header */}
          <div className="px-4 pt-3 space-y-1.5 select-text">
            <p className="text-xs font-semibold text-foreground/90 leading-5">
              {explanation.relevance_reason}
            </p>
            <p className="text-[12px] text-muted-foreground leading-6">
              {explanation.explanation}
            </p>
          </div>

          {/* Snippet Header */}
          <div className="flex items-center justify-between border-t border-b border-border/40 bg-muted/20 px-4 py-1.5">
            <span
              className="truncate font-mono text-[9px] text-muted-foreground/60 select-all"
              title={explanation.file_path}
            >
              {explanation.file_path}
            </span>
            <CopyButton text={explanation.content} />
          </div>

          {/* Code Render */}
          <div className="overflow-auto border-b border-border/40 scrollbar-thin" style={{ maxHeight: "20rem" }}>
            <pre className="font-mono text-xs leading-5 text-foreground/80 whitespace-pre py-2 bg-card/10 select-text">
              <code>
                {lines.map((line, idx) => {
                  const currentLine = explanation.start_line + idx;
                  const isHighlighted =
                    currentLine >= explanation.highlight_start_line &&
                    currentLine <= explanation.highlight_end_line;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex px-4 py-0.5 transition-colors duration-150",
                        isHighlighted
                          ? "bg-primary/10 border-l-2 border-primary -mx-4 px-4 font-semibold text-foreground"
                          : ""
                      )}
                    >
                      <span className="w-10 shrink-0 select-none text-muted-foreground/30 text-right pr-4 text-[10px]">
                        {currentLine}
                      </span>
                      <span className={cn(isHighlighted ? "text-foreground" : "text-muted-foreground/75")}>
                        {line}
                      </span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}
