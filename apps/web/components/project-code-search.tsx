"use client";

import { FormEvent, useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Loader2, 
  Search, 
  Sparkles, 
  BrainCircuit, 
  Layers, 
  GitBranch, 
  FileText, 
  Terminal, 
  Info,
  BadgeAlert
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchCode, useExplainSearch } from "@/lib/queries";
import type { SearchHit, ChunkExplanation, SearchExplanation } from "@/lib/api";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 0.55) return "text-emerald-400";
  if (score >= 0.40) return "text-yellow-400";
  return "text-muted-foreground";
}

function scoreLabel(score: number): string {
  if (score >= 0.55) return "Strong";
  if (score >= 0.40) return "Moderate";
  return "Weak";
}

function roleBadgeColor(role: string): string {
  switch (role) {
    case "entry_point": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "main_implementation": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "supporting_utility": return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    case "configuration": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "tests": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default: return "bg-muted text-muted-foreground";
  }
}

function roleBadgeLabel(role: string): string {
  switch (role) {
    case "entry_point": return "Entry Point";
    case "main_implementation": return "Main Implementation";
    case "supporting_utility": return "Utility";
    case "configuration": return "Config";
    case "tests": return "Tests";
    default: return role.replace("_", " ");
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy snippet"
    >
      {copied ? (
        <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
      ) : (
        <><Copy className="h-3 w-3" /> Copy</>
      )}
    </button>
  );
}

function SearchResult({ hit, index }: { hit: SearchHit; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  const pathParts = hit.file_path.split("/");
  const shortPath = pathParts.length > 3
    ? "\u2026/" + pathParts.slice(-3).join("/")
    : hit.file_path;
  const lineCount = hit.end_line - hit.start_line + 1;

  return (
    <article className="rounded-md border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="shrink-0 text-muted-foreground/60">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={hit.file_path}>
          {shortPath}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">{hit.language}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            L{hit.start_line}&ndash;{hit.end_line}
            <span className="ml-1 text-muted-foreground/50">({lineCount} lines)</span>
          </span>
          <span className={cn("text-xs font-medium tabular-nums", scoreColor(hit.score))}>
            {scoreLabel(hit.score)} ({hit.score.toFixed(2)})
          </span>
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-1.5">
            <span className="truncate font-mono text-xs text-muted-foreground/70" title={hit.file_path}>
              {hit.file_path}
            </span>
            <CopyButton text={hit.content} />
          </div>
          <div className="overflow-auto" style={{ maxHeight: "16rem" }}>
            <pre className="p-4 font-mono text-xs leading-5 text-foreground/85 whitespace-pre">
              <code>{hit.content}</code>
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}

function AIExplorerResult({ explanation, index }: { explanation: ChunkExplanation; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  const pathParts = explanation.file_path.split("/");
  const shortPath = pathParts.length > 3
    ? "\u2026/" + pathParts.slice(-3).join("/")
    : explanation.file_path;
  
  const lines = explanation.content.split("\n");

  return (
    <article className="rounded-md border border-border bg-card/40 overflow-hidden space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="shrink-0 text-muted-foreground/50">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </span>
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="font-mono text-xs text-foreground truncate" title={explanation.file_path}>
            {shortPath}
          </span>
          {explanation.symbol_name && (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border/60 self-start">
              {explanation.symbol_name}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px] uppercase font-semibold border", roleBadgeColor(explanation.role))}>
            {roleBadgeLabel(explanation.role)}
          </Badge>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            L{explanation.start_line}&ndash;{explanation.end_line}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/5 space-y-3">
          {/* Explanation Header */}
          <div className="px-4 pt-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground/90">
              {explanation.relevance_reason}
            </p>
            <p className="text-xs text-muted-foreground leading-5">
              {explanation.explanation}
            </p>
          </div>

          {/* Snippet Header */}
          <div className="flex items-center justify-between border-t border-b border-border/40 bg-muted/20 px-4 py-1.5">
            <span className="truncate font-mono text-[10px] text-muted-foreground/60" title={explanation.file_path}>
              {explanation.file_path}
            </span>
            <CopyButton text={explanation.content} />
          </div>

          {/* Code Render */}
          <div className="overflow-auto border-b border-border/40" style={{ maxHeight: "20rem" }}>
            <pre className="font-mono text-xs leading-5 text-foreground/80 whitespace-pre py-2 bg-card/10">
              <code>
                {lines.map((line, idx) => {
                  const currentLine = explanation.start_line + idx;
                  const isHighlighted = currentLine >= explanation.highlight_start_line && currentLine <= explanation.highlight_end_line;
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex px-4 py-0.5", 
                        isHighlighted ? "bg-primary/10 border-l-2 border-primary -mx-4 px-4" : ""
                      )}
                    >
                      <span className="w-10 shrink-0 select-none text-muted-foreground/30 text-right pr-4">
                        {currentLine}
                      </span>
                      <span className={cn(isHighlighted ? "text-foreground font-semibold" : "text-muted-foreground/80")}>
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

export function ProjectCodeSearch({ projectId }: { projectId: string }) {
  const [activeMode, setActiveMode] = useState<"search" | "ai">("ai");
  const [query, setQuery] = useState("");

  const searchMutation = useSearchCode();
  const explainMutation = useExplainSearch();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    
    if (activeMode === "search") {
      searchMutation.mutate({ projectId, query: trimmedQuery, limit: 8 });
    } else {
      explainMutation.mutate({ projectId, query: trimmedQuery, limit: 5 });
    }
  }

  const searchHits = searchMutation.data ?? [];
  const hasSimpleSearched = searchMutation.isSuccess || searchMutation.isError;

  const aiResult = explainMutation.data;
  const hasAISearched = explainMutation.isSuccess || explainMutation.isError;

  const isLoading = searchMutation.isPending || explainMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header and Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Code Search & Exploration
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Semantic query across codebase chunks with structural AI synthesis.
          </p>
        </div>
        
        <div className="flex rounded-md bg-muted p-1 self-start">
          <button
            type="button"
            onClick={() => setActiveMode("ai")}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-all",
              activeMode === "ai" 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("search")}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-all",
              activeMode === "search" 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Simple Search
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            activeMode === "ai"
              ? "e.g. how does repository cloning and progress tracking work?"
              : "e.g. clone_repository function"
          }
          autoComplete="off"
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" disabled={!query.trim() || isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : activeMode === "ai" ? (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="ml-2">
            {isLoading ? "Analyzing\u2026" : activeMode === "ai" ? "Explore" : "Search"}
          </span>
        </Button>
      </form>

      {/* Errors */}
      {(searchMutation.isError || explainMutation.isError) && (
        <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
          <BadgeAlert className="h-4 w-4" />
          {activeMode === "search"
            ? (searchMutation.error instanceof Error ? searchMutation.error.message : "Search failed.")
            : (explainMutation.error instanceof Error ? explainMutation.error.message : "AI Explorer failed.")}
        </p>
      )}

      {/* Loading States */}
      {isLoading && (
        <Card className="border-border/40 bg-card/25">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h4 className="text-sm font-semibold text-foreground/90">
              {activeMode === "ai" ? "Retrieving Code & Structuring Context..." : "Searching Database Chunks..."}
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              {activeMode === "ai" 
                ? "Calling LLM engine to map architectures, highlight lines, and generate execution flow diagrams."
                : "Calculating cosine distance embeddings over pgvector columns."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Simple Search Mode Results */}
      {!isLoading && activeMode === "search" && hasSimpleSearched && searchHits.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No matching chunks found. Try a different query.
        </p>
      )}

      {!isLoading && activeMode === "search" && searchHits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {searchHits.length} results &mdash; click to expand code snippet
          </p>
          <div className="space-y-2 max-h-[48rem] overflow-y-auto pr-0.5">
            {searchHits.map((hit, i) => (
              <SearchResult key={hit.id} hit={hit} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* AI Explorer Mode Results */}
      {!isLoading && activeMode === "ai" && hasAISearched && !aiResult && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No explanation results found. Try an open-ended architectural question.
        </p>
      )}

      {!isLoading && activeMode === "ai" && aiResult && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Quick Understanding Card */}
          <Card className="bg-card/25 border-border/50">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Quick Understanding
                </div>
                {aiResult.architectural_context && (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono bg-primary/5 text-primary border-primary/20">
                    Context: {aiResult.architectural_context}
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-6 text-foreground/90">
                {aiResult.quick_understanding}
              </p>
            </CardContent>
          </Card>

          {/* Execution Flow Diagram (if returned) */}
          {aiResult.execution_flow && (
            <Card className="bg-card/20 border-border/40">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-1.5">
                  <Terminal className="h-3.5 w-3.5 text-primary" />
                  Request / Execution Flow
                </div>
                <div className="overflow-x-auto bg-black/40 rounded p-3.5">
                  <pre className="font-mono text-xs text-emerald-400/90 leading-5 whitespace-pre">
                    <code>{aiResult.execution_flow}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ranked Explanations */}
          {aiResult.explanations && aiResult.explanations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Relevant Code & Explanations (Ranked)
              </h4>
              <div className="space-y-3">
                {aiResult.explanations.map((exp, idx) => (
                  <AIExplorerResult key={exp.id} explanation={exp} index={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Related Files list */}
          {aiResult.related_files && aiResult.related_files.length > 0 && (
            <Card className="bg-card/15 border-border/30">
              <CardContent className="p-4 space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Related Files to Inspect
                </h4>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {aiResult.related_files.map((file) => (
                    <div key={file} className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                      <span className="text-emerald-400">✓</span>
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
