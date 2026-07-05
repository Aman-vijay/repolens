"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  BookOpen, 
  BrainCircuit, 
  CheckCircle2, 
  Clock, 
  Code, 
  Cpu, 
  FileText, 
  GitBranch, 
  HelpCircle, 
  Info, 
  Layers, 
  Loader2, 
  RefreshCw, 
  ShieldAlert, 
  Sparkles 
} from "lucide-react";

import { useAnalysis, useRegenerateAnalysis } from "@/lib/queries";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export function RepositoryIntelligence({ projectId }: { projectId: string }) {
  const { data: queryAnalysis, isPending: queryLoading, isError, error } = useAnalysis(projectId);
  const regenerateMutation = useRegenerateAnalysis();
  
  const { activeAnalysis, setActiveAnalysis } = useAppStore();

  // Sync to Zustand store
  useEffect(() => {
    if (queryAnalysis) {
      setActiveAnalysis(queryAnalysis);
    }
  }, [queryAnalysis, setActiveAnalysis]);

  // Use cached store data if it matches the project's repository ID
  // React Query will refresh it in the background
  const analysis = queryAnalysis || activeAnalysis;
  const isLoading = queryLoading && !analysis;

  const handleRegenerate = () => {
    regenerateMutation.mutate(projectId, {
      onSuccess: (data) => {
        if (data.status === "unchanged") {
          toast.info("Repository content has not changed. Skipping regeneration.");
        } else {
          toast.success("Intelligence analysis queued.");
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to queue analysis.");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-6 w-1/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle case where API returns 404 because no analysis was generated yet
  const notFound = isError && error instanceof Error && error.message.includes("404");
  const showGenerateButton = notFound || (!analysis && !isLoading);

  if (showGenerateButton) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Card className="border-border/40 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <BrainCircuit className="h-10 w-10 text-muted-foreground/60 mb-3" />
            <h3 className="font-semibold text-sm">No analysis available</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              Generate structured repository intelligence, architecture mappings, and design patterns.
            </p>
            <Button 
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Intelligence
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError && !notFound) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-destructive">Failed to load repository intelligence.</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {error instanceof Error ? error.message : "An unexpected error occurred."}
            </p>
            <Button size="sm" variant="outline" onClick={handleRegenerate}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis) return null;

  const isRunning = analysis.analysis_status === "pending" || analysis.analysis_status === "running";
  const isFailed = analysis.analysis_status === "failed";

  if (isRunning) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <h3 className="font-semibold text-sm">Analyzing Repository...</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Extracting design patterns, verifying framework configuration, and generating structural summaries.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-destructive">Analysis Pipeline Failed</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {analysis.error_message || "An unhandled exception occurred in the worker."}
            </p>
            <Button size="sm" variant="outline" onClick={handleRegenerate}>
              Force Restart Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    executive_summary,
    architecture_summary,
    architecture_style,
    architecture_layers,
    tech_stack,
    repo_facts,
    repo_insights,
    model,
    prompt_version,
    token_usage,
    generation_latency_ms,
    generated_at
  } = analysis;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Repository Intelligence
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRegenerate}
          disabled={regenerateMutation.isPending}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
          {regenerateMutation.isPending ? "Queuing..." : "Regenerate"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Left column: Executive Summary & Facts */}
        <div className="md:col-span-2 space-y-4">
          {/* Executive Summary */}
          <Card className="bg-card/30">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Info className="h-4 w-4 text-primary" />
                Executive Summary
              </div>
              <p className="text-sm leading-6 text-foreground/90">
                {executive_summary}
              </p>
            </CardContent>
          </Card>

          {/* Architecture Summary */}
          <Card className="bg-card/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Layers className="h-4 w-4 text-primary" />
                  Architecture & Structure
                </div>
                {architecture_style && (
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {architecture_style}
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-6 text-foreground/90 whitespace-pre-wrap">
                {architecture_summary}
              </p>

              {architecture_layers && architecture_layers.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Detected Layers
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {architecture_layers.map((layer) => (
                      <Badge key={layer} variant="secondary" className="font-mono text-xs uppercase tracking-wide">
                        {layer}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights (Strengths, Risks, Decisions, Patterns) */}
          {repo_insights && (
            <Card className="bg-card/30">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Repository Insights
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Strengths */}
                  {repo_insights.strengths && repo_insights.strengths.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-emerald-400">Strengths</h4>
                      <ul className="list-disc list-inside text-xs leading-5 text-muted-foreground space-y-1 pl-1">
                        {repo_insights.strengths.map((str, i) => (
                          <li key={i}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Risks */}
                  {repo_insights.risks && repo_insights.risks.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-destructive">Risks & Tech Debt</h4>
                      <ul className="list-disc list-inside text-xs leading-5 text-muted-foreground space-y-1 pl-1">
                        {repo_insights.risks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Decisions */}
                  {repo_insights.notable_decisions && repo_insights.notable_decisions.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-sky-400">Notable Design Decisions</h4>
                      <ul className="list-disc list-inside text-xs leading-5 text-muted-foreground space-y-1 pl-1">
                        {repo_insights.notable_decisions.map((dec, i) => (
                          <li key={i}>{dec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Patterns */}
                  {repo_insights.patterns_detected && repo_insights.patterns_detected.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-purple-400">Design Patterns</h4>
                      <ul className="list-disc list-inside text-xs leading-5 text-muted-foreground space-y-1 pl-1">
                        {repo_insights.patterns_detected.map((pat, i) => (
                          <li key={i}>{pat}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Tech Stack & Facts */}
        <div className="space-y-4">
          {/* Tech Stack */}
          {tech_stack && (
            <Card className="bg-card/30">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Cpu className="h-4 w-4 text-primary" />
                  Tech Stack
                </div>
                {/* Languages */}
                {tech_stack.languages && tech_stack.languages.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Languages</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tech_stack.languages.map((l) => (
                        <Badge key={l} variant="secondary" className="font-mono text-xs">{l}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Frameworks */}
                {tech_stack.frameworks && tech_stack.frameworks.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Frameworks</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tech_stack.frameworks.map((f) => (
                        <Badge key={f} variant="outline" className="font-mono text-xs border-primary/20 text-primary-foreground">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Tools */}
                {tech_stack.tools && tech_stack.tools.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tools & Utilities</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tech_stack.tools.map((t) => (
                        <Badge key={t} variant="outline" className="font-mono text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Repo Facts */}
          {repo_facts && (
            <Card className="bg-card/30">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FileText className="h-4 w-4 text-primary" />
                  Repository Facts
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium text-foreground capitalize">{repo_facts.repository_type}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Framework</span>
                    <span className="font-medium text-foreground">{repo_facts.primary_framework}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Package Manager</span>
                    <span className="font-mono text-foreground">{repo_facts.package_manager}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">License</span>
                    <span className="font-medium text-foreground">{repo_facts.license}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Docs Quality</span>
                    <span className={`font-medium capitalize ${
                      repo_facts.documentation_quality === "excellent" ? "text-emerald-400" :
                      repo_facts.documentation_quality === "average" ? "text-yellow-400" : "text-destructive"
                    }`}>{repo_facts.documentation_quality}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Containerized</span>
                    <span className="font-medium text-foreground">{repo_facts.containerized ? "Yes (Docker)" : "No"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">CI Configured</span>
                    <span className="font-medium text-foreground">{repo_facts.ci_detected ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Has Tests</span>
                    <span className="font-medium text-foreground">{repo_facts.has_tests ? "Yes" : "No"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Provenance Footer */}
      <div className="flex flex-col gap-1 text-[10px] text-muted-foreground/60 font-mono tracking-wide sm:flex-row sm:justify-between">
        <div>
          <span>LLM: {model}</span>
          <span className="mx-1.5">·</span>
          <span>Prompt: {prompt_version}</span>
          {token_usage && (
            <>
              <span className="mx-1.5">·</span>
              <span>Tokens: {token_usage.total_tokens.toLocaleString()}</span>
            </>
          )}
          {generation_latency_ms && (
            <>
              <span className="mx-1.5">·</span>
              <span>Latency: {(generation_latency_ms / 1000).toFixed(2)}s</span>
            </>
          )}
        </div>
        <div>
          <span>Generated {formatRelativeTime(generated_at)}</span>
        </div>
      </div>
    </div>
  );
}
