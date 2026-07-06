"use client";

import { FormEvent, useState } from "react";
import { 
  Loader2, 
  Search, 
  Sparkles, 
  BrainCircuit, 
  Layers, 
  FileText, 
  Terminal, 
  BadgeAlert
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchCode, useExplainSearch } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Sub-components
import { SearchResult } from "./search/search-result";
import { AIExplorerResult } from "./search/ai-explorer-result";

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
          className="flex-1 bg-background/55 border-border/80 focus-visible:ring-primary/20 focus-visible:border-primary/45"
        />
        <Button type="submit" disabled={!query.trim() || isLoading} className="shadow-sm">
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
        <p className="text-xs text-destructive font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
          <BadgeAlert className="h-4 w-4 text-destructive" />
          {activeMode === "search"
            ? (searchMutation.error instanceof Error ? searchMutation.error.message : "Search failed.")
            : (explainMutation.error instanceof Error ? explainMutation.error.message : "AI Explorer failed.")}
        </p>
      )}

      {/* Loading States */}
      {isLoading && (
        <Card className="border-border/40 bg-card/25 animate-pulse">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h4 className="text-sm font-semibold text-foreground/90">
              {activeMode === "ai" ? "Retrieving Code & Structuring Context..." : "Searching Database Chunks..."}
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm leading-5">
              {activeMode === "ai" 
                ? "Calling LLM engine to map architectures, highlight lines, and generate execution flow diagrams."
                : "Calculating cosine distance embeddings over pgvector columns."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Simple Search Mode Results */}
      {!isLoading && activeMode === "search" && hasSimpleSearched && searchHits.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground bg-card/5 rounded-md border border-dashed border-border/60 animate-in fade-in duration-200">
          No matching chunks found. Try a different query.
        </p>
      )}

      {!isLoading && activeMode === "search" && searchHits.length > 0 && (
        <div className="space-y-2 animate-in fade-in duration-250">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold px-1">
            {searchHits.length} results &mdash; click to expand code snippet
          </p>
          <div className="space-y-2 max-h-[48rem] overflow-y-auto pr-0.5 scrollbar-thin">
            {searchHits.map((hit, i) => (
              <SearchResult key={hit.id} hit={hit} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* AI Explorer Mode Results */}
      {!isLoading && activeMode === "ai" && hasAISearched && !aiResult && (
        <p className="py-6 text-center text-xs text-muted-foreground bg-card/5 rounded-md border border-dashed border-border/60 animate-in fade-in duration-200">
          No explanation results found. Try an open-ended architectural question.
        </p>
      )}

      {!isLoading && activeMode === "ai" && aiResult && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Quick Understanding Card */}
          <Card className="bg-card/25 border-border/50 shadow-sm hover:border-primary/10 transition-colors duration-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Quick Understanding
                </div>
                {aiResult.architectural_context && (
                  <Badge variant="outline" className="text-[9px] uppercase font-mono bg-primary/5 text-primary border-primary/20 px-2 py-0.5">
                    Context: {aiResult.architectural_context}
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-6 text-foreground/90 select-text">
                {aiResult.quick_understanding}
              </p>
            </CardContent>
          </Card>

          {/* Execution Flow Diagram */}
          {aiResult.execution_flow && (
            <Card className="bg-card/20 border-border/40 hover:border-primary/10 transition-colors duration-200">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-1.5">
                  <Terminal className="h-3.5 w-3.5 text-primary" />
                  Request / Execution Flow
                </div>
                <div className="overflow-x-auto bg-black/45 rounded border border-border/45 p-3.5 scrollbar-thin">
                  <pre className="font-mono text-xs text-emerald-400/90 leading-5 whitespace-pre select-text">
                    <code>{aiResult.execution_flow}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ranked Explanations */}
          {aiResult.explanations && aiResult.explanations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 px-1">
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
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 border-b border-border/30 pb-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Related Files to Inspect
                </h4>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {aiResult.related_files.map((file) => (
                    <div key={file} className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-0.5 select-all">
                      <span className="text-emerald-400 font-semibold">✓</span>
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
