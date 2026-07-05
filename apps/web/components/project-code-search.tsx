"use client";

import { FormEvent, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchCode } from "@/lib/queries";
import type { SearchHit } from "@/lib/api";
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

export function ProjectCodeSearch({ projectId }: { projectId: string }) {
  const searchMutation = useSearchCode();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    searchMutation.mutate({ projectId, query: trimmedQuery, limit: 8 });
  }

  const hits = searchMutation.data ?? [];
  const hasSearched = searchMutation.isSuccess || searchMutation.isError;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Semantic Code Search
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Natural language search across all indexed chunks in this repository.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. how does authentication work?"
          autoComplete="off"
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" disabled={!query.trim() || searchMutation.isPending}>
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="ml-2">{searchMutation.isPending ? "Searching\u2026" : "Search"}</span>
        </Button>
      </form>

      {searchMutation.isError && (
        <p className="text-sm text-destructive">
          {searchMutation.error instanceof Error
            ? searchMutation.error.message
            : "Search failed. Please try again."}
        </p>
      )}

      {hasSearched && !searchMutation.isError && hits.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No matching chunks found. Try a more specific or different query.
        </p>
      )}

      {hits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {hits.length} result{hits.length !== 1 ? "s" : ""}
            {" "}&mdash; click a result to expand the code
          </p>
          <div className="max-h-[52rem] space-y-2 overflow-y-auto pr-0.5">
            {hits.map((hit, i) => (
              <SearchResult key={hit.id} hit={hit} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
