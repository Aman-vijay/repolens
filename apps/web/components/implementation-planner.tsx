"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Activity,
  CornerDownRight,
  Info,
  Layers,
  HelpCircle,
  BookOpen
} from "lucide-react";

import { useAppStore } from "@/lib/store";
import {
  usePlanSessions,
  usePlanSession,
  useCreatePlan,
  useRefinePlan,
  useDeletePlanSession
} from "@/lib/queries";
import type { PlanSession, PlanVersion, PlanStep, PlanFile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ImplementationPlannerProps {
  projectId: string;
}

export function ImplementationPlanner({ projectId }: { projectId: string }) {
  const { getToken } = useAuth();
  
  const {
    activePlanSessionId,
    setActivePlanSessionId
  } = useAppStore();

  const { data: querySessions, isPending: sessionsLoading } = usePlanSessions(projectId);
  const { data: planDetail, isPending: planLoading } = usePlanSession(projectId, activePlanSessionId);

  const createPlanMutation = useCreatePlan();
  const refinePlanMutation = useRefinePlan();
  const deletePlanMutation = useDeletePlanSession();

  // Local state
  const [featureRequest, setFeatureRequest] = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({});
  const [collapsedPatterns, setCollapsedPatterns] = useState<Record<number, boolean>>({});
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  const sessions = querySessions || [];
  const versions = planDetail?.versions || [];

  // Reset selected version when plan detail changes
  useEffect(() => {
    if (versions.length > 0) {
      setSelectedVersionNum(versions[versions.length - 1].version);
    } else {
      setSelectedVersionNum(null);
    }
  }, [versions]);

  // Loading screen text cycle effect
  useEffect(() => {
    const activeVersion = versions.find(v => v.version === selectedVersionNum);
    const isGenerating = activeVersion?.status === "pending" || activeVersion?.status === "generating";
    
    if (!isGenerating) return;

    const loadingTexts = [
      "Analyzing codebase architecture...",
      "Detecting established implementation patterns...",
      "Identifying affected files & calculating confidence levels...",
      "Formatting implementation plan steps..."
    ];

    const interval = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [versions, selectedVersionNum]);

  // Get active version details
  const activeVersion = versions.find(v => v.version === selectedVersionNum) || (versions.length > 0 ? versions[versions.length - 1] : null);
  const isGenerating = activeVersion?.status === "pending" || activeVersion?.status === "generating";

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!featureRequest.trim() || createPlanMutation.isPending) return;

    createPlanMutation.mutate(
      { projectId, featureRequest },
      {
        onSuccess: (newSession) => {
          setActivePlanSessionId(newSession.id);
          setFeatureRequest("");
          toast.success("AI is generating your implementation plan...");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create plan.");
        }
      }
    );
  };

  const handleRefineSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!refinementPrompt.trim() || !activePlanSessionId || refinePlanMutation.isPending) return;

    refinePlanMutation.mutate(
      { projectId, sessionId: activePlanSessionId, refinementPrompt },
      {
        onSuccess: (newVersion) => {
          setSelectedVersionNum(newVersion.version);
          setRefinementPrompt("");
          toast.success("AI is refining your implementation plan...");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to refine plan.");
        }
      }
    );
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this plan session?")) return;

    deletePlanMutation.mutate(
      { projectId, sessionId },
      {
        onSuccess: () => {
          if (activePlanSessionId === sessionId) {
            setActivePlanSessionId(null);
          }
          toast.success("Plan session deleted.");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to delete plan session.");
        }
      }
    );
  };

  const handleFileClick = (filePath: string) => {
    // Dispatch custom event to notify project explorer file-tree to load this file path
    const event = new CustomEvent("repolens:open-file", {
      detail: { filePath }
    });
    window.dispatchEvent(event);
  };

  const toggleChecklist = (item: string) => {
    setCheckedChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const togglePatternCollapse = (index: number) => {
    setCollapsedPatterns(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Copy plan as markdown
  const handleCopyMarkdown = () => {
    if (!planDetail || !activeVersion) return;
    const md = convertPlanToMarkdown(planDetail.title, activeVersion);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      toast.success("Plan copied to clipboard as markdown!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const planContent = activeVersion?.plan_content;

  const loadingTexts = [
    "Analyzing codebase architecture...",
    "Detecting established implementation patterns...",
    "Identifying affected files & calculating confidence levels...",
    "Formatting implementation plan steps..."
  ];

  return (
    <div className="flex h-[720px] rounded-lg border border-border bg-card overflow-hidden">
      {/* Left Sidebar - Plan Sessions */}
      <div className="w-64 border-r border-border bg-background/50 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plans</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActivePlanSessionId(null)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No plans generated yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-center justify-between rounded-md p-2 text-left text-xs font-medium cursor-pointer transition-colors",
                  activePlanSessionId === session.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
                onClick={() => setActivePlanSessionId(session.id)}
              >
                <div className="flex items-center gap-2 truncate pr-6">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background/20">
        {!activePlanSessionId ? (
          /* Empty/Initial Request Form */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-6">
            <div className="rounded-full bg-primary/10 p-4 border border-primary/20">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">AI Implementation Planner</h2>
              <p className="text-sm text-muted-foreground">
                Describe a feature or bugfix you want to introduce. The Staff Engineer planner will review repository patterns and output a structured timeline plan with checklists and references.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} className="w-full space-y-4">
              <div className="space-y-1.5 text-left">
                <Label htmlFor="plan-request-input" className="text-xs font-semibold text-muted-foreground">Feature Description</Label>
                <Textarea
                  id="plan-request-input"
                  placeholder="Example: Add an avatar image upload to the user profile settings, validating the uploaded image type and saving it to storage..."
                  value={featureRequest}
                  onChange={(e) => setFeatureRequest(e.target.value)}
                  rows={4}
                  className="bg-background/50 border-input"
                />
              </div>
              <Button
                type="submit"
                disabled={!featureRequest.trim() || createPlanMutation.isPending}
                className="w-full flex items-center justify-center gap-2"
              >
                {createPlanMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Codebase...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Plan
                  </>
                )}
              </Button>
            </form>
          </div>
        ) : planLoading && !planDetail ? (
          /* Initial Load Shimmer */
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : isGenerating ? (
          /* Processing/Generating State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold animate-pulse">{loadingTexts[loadingTextIndex]}</p>
              <p className="text-xs text-muted-foreground">This can take up to 20 seconds. Please keep this tab active.</p>
            </div>
          </div>
        ) : activeVersion?.status === "failed" ? (
          /* Error State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
            <ShieldAlert className="h-12 w-12 text-destructive" />
            <h3 className="text-base font-bold">Plan Generation Failed</h3>
            <p className="text-xs text-muted-foreground border border-destructive/20 bg-destructive/5 rounded-md p-3 font-mono">
              {activeVersion.error_message || "An unexpected error occurred during model invocation."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePlanSessionId(null)}
            >
              Start New Plan
            </Button>
          </div>
        ) : planContent ? (
          /* Plan Rendering Panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Toolbar / Tabs */}
            <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between">
              {/* Version Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Version:</span>
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersionNum(v.version)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md border transition-all",
                      selectedVersionNum === v.version
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    v{v.version}
                  </button>
                ))}
              </div>

              {/* Copy Plan Action */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMarkdown}
                className="h-8 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Plan
              </Button>
            </div>

            {/* Structured Report Scrollarea */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight">{planDetail?.title}</h2>
                  <Badge variant={
                    planContent.estimated_complexity === "low"
                      ? "success"
                      : planContent.estimated_complexity === "medium"
                      ? "warning"
                      : "destructive"
                  }>
                    {planContent.estimated_complexity} complexity
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{planContent.summary}</p>
              </div>

              {/* Planning confidence alert */}
              <div className="rounded-lg border border-border bg-card p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Planning Confidence:</span>
                    <Badge variant={planContent.confidence === "high" ? "success" : planContent.confidence === "medium" ? "warning" : "destructive"}>
                      {planContent.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{planContent.confidence_reason}</p>
                </div>
              </div>

              {/* Architecture Impact */}
              {planContent.architecture_impact && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Architecture Impact
                  </h3>
                  <div className="flex flex-wrap gap-2 items-center">
                    {planContent.architecture_impact.layers?.map((layer, idx) => (
                      <Badge key={idx} variant="secondary" className="px-2.5 py-0.5 text-xs font-medium">
                        {layer} Layer
                      </Badge>
                    ))}
                    {planContent.architecture_impact.breaking_change && (
                      <Badge variant="destructive" className="px-2.5 py-0.5 text-xs font-medium">
                        ⚠️ Breaking Change
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Existing Patterns */}
              {planContent.existing_patterns && planContent.existing_patterns.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Mimic Existing Patterns
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {planContent.existing_patterns.map((pat, idx) => (
                      <Card key={idx} className="border-border/50 bg-background/30 shadow-none">
                        <CardContent className="p-3 space-y-2">
                          <p className="text-xs font-semibold text-foreground leading-relaxed">{pat.description}</p>
                          {pat.files && pat.files.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] font-bold text-muted-foreground mr-1">Mimic code:</span>
                              {pat.files.map((f, fIdx) => (
                                <button
                                  key={fIdx}
                                  onClick={() => handleFileClick(f)}
                                  className="px-2 py-0.5 rounded border border-border bg-background text-[10px] font-mono hover:bg-muted transition-colors text-primary hover:text-foreground"
                                >
                                  {f.split("/").pop()}
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-implementation checklist */}
              {planContent.planning_checklist && planContent.planning_checklist.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Pre-Implementation Checklist
                  </h3>
                  <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
                    {planContent.planning_checklist.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleChecklist(item)}
                        className="flex items-start gap-3 p-3 text-xs cursor-pointer select-none hover:bg-muted/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedChecklist[item]}
                          readOnly
                          className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary shrink-0 mt-0.5 pointer-events-none"
                        />
                        <span className={cn(
                          "leading-relaxed transition-all",
                          checkedChecklist[item] ? "line-through text-muted-foreground font-medium" : "text-foreground"
                        )}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites Alert */}
              {planContent.prerequisites && planContent.prerequisites.length > 0 && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Prerequisites</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {planContent.prerequisites.map((prereq, idx) => (
                      <li key={idx} className="leading-relaxed">{prereq}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Implementation Steps Timeline */}
              {planContent.steps && planContent.steps.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Implementation Steps
                  </h3>
                  
                  <div className="relative pl-6 border-l border-border/80 space-y-6">
                    {planContent.steps.map((step, idx) => (
                      <div key={idx} className="relative space-y-3">
                        {/* Timeline Circle Node */}
                        <div className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary">{step.order}</span>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="text-sm font-bold text-foreground">Step {step.order}: {step.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>

                        {/* Step details metadata */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {step.why_this_order && (
                            <div className="rounded bg-muted/40 p-2.5 border border-border/40">
                              <span className="font-bold text-muted-foreground block mb-0.5 text-[10px] uppercase">Why this order:</span>
                              <span className="text-foreground leading-relaxed">{step.why_this_order}</span>
                            </div>
                          )}
                          {step.migration_impact && (
                            <div className="rounded bg-muted/40 p-2.5 border border-border/40">
                              <span className="font-bold text-muted-foreground block mb-0.5 text-[10px] uppercase">Migration Impact:</span>
                              <span className="text-foreground leading-relaxed">{step.migration_impact}</span>
                            </div>
                          )}
                          {step.rollback_concern && (
                            <div className="rounded bg-muted/40 p-2.5 border border-border/40">
                              <span className="font-bold text-muted-foreground block mb-0.5 text-[10px] uppercase">Rollback/Safety:</span>
                              <span className="text-foreground leading-relaxed">{step.rollback_concern}</span>
                            </div>
                          )}
                        </div>

                        {/* Affected Files List */}
                        {step.files && step.files.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Affected Files</span>
                            <div className="border border-border/60 rounded overflow-hidden divide-y divide-border/60">
                              {step.files.map((f, fIdx) => (
                                <div key={fIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-background/40 hover:bg-muted/10 transition-colors">
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <Badge variant={f.action === "new" ? "success" : f.action === "modify" ? "info" : "destructive"} className="text-[9px] font-bold uppercase shrink-0 mt-0.5">
                                      {f.action}
                                    </Badge>
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => handleFileClick(f.path)}
                                        className="font-mono text-xs text-primary hover:text-foreground truncate text-left focus:outline-none"
                                      >
                                        {f.path}
                                      </button>
                                      <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{f.reason}</p>
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-[10px] shrink-0 self-start sm:self-center font-medium">
                                    Confidence: {f.confidence}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pattern References */}
                        {step.references && step.references.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mimic References</span>
                            <div className="border border-border/60 rounded overflow-hidden divide-y divide-border/60 bg-background/20">
                              {step.references.map((ref, rIdx) => (
                                <div key={rIdx} className="p-2.5 flex items-start gap-2.5">
                                  <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => handleFileClick(ref.path)}
                                      className="font-mono text-xs text-primary hover:text-foreground truncate text-left focus:outline-none"
                                    >
                                      {ref.path}
                                    </button>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{ref.reason}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order reasoning summary */}
              {planContent.why_this_order && planContent.why_this_order.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order & Sequence Logic</h3>
                  <div className="rounded-lg border border-border bg-card/40 p-4">
                    <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1.5">
                      {planContent.why_this_order.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">{item}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* Unknowns Callout */}
              {planContent.unknowns && planContent.unknowns.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-500">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Plan Unknowns & Hypotheses</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {planContent.unknowns.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks and Considerations */}
              {planContent.risks_and_considerations && planContent.risks_and_considerations.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Risks & Safety Considerations</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {planContent.risks_and_considerations.map((risk, idx) => (
                      <li key={idx} className="leading-relaxed">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Testing Suggestions */}
              {planContent.testing_suggestions && planContent.testing_suggestions.length > 0 && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckSquare className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Verification & testing checklist</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {planContent.testing_suggestions.map((suggestion, idx) => (
                      <li key={idx} className="leading-relaxed">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Refinement input box */}
            <div className="p-4 border-t border-border bg-card/60">
              <form onSubmit={handleRefineSubmit} className="flex gap-2">
                <Input
                  placeholder="Need updates? Tell the planner to change steps or files (e.g. 'Use a custom webhook instead of direct DB writes')..."
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  disabled={refinePlanMutation.isPending}
                  className="flex-1 bg-background text-xs h-9 border-input"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!refinementPrompt.trim() || refinePlanMutation.isPending}
                  className="h-9 px-4 flex items-center gap-1 text-xs"
                >
                  {refinePlanMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Refine Plan
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Select or create a plan session</div>
        )}
      </div>
    </div>
  );
}

// Convert plan JSON payload into formatted markdown export
function convertPlanToMarkdown(title: string, version: PlanVersion): string {
  const content = version.plan_content;
  if (!content) return "";

  let md = `# Implementation Plan: ${title} (v${version.version})\n\n`;
  md += `## Summary\n${content.summary || "No summary provided."}\n\n`;
  md += `- **Estimated Complexity:** ${content.estimated_complexity || "N/A"}\n`;
  md += `- **Planning Confidence:** ${content.confidence || "N/A"} (${content.confidence_reason || ""})\n`;
  md += `- **Model:** ${version.model}\n\n`;

  if (content.architecture_impact) {
    const layers = content.architecture_impact.layers?.join(", ") || "None";
    const breaking = content.architecture_impact.breaking_change ? "Yes" : "No";
    md += `## Architecture Impact\n`;
    md += `- **Affected Layers:** ${layers}\n`;
    md += `- **Breaking Change:** ${breaking}\n\n`;
  }

  if (content.planning_checklist && content.planning_checklist.length > 0) {
    md += `## Pre-Implementation Checklist\n`;
    content.planning_checklist.forEach((item: string) => {
      md += `- [ ] ${item}\n`;
    });
    md += `\n`;
  }

  if (content.existing_patterns && content.existing_patterns.length > 0) {
    md += `## Existing Patterns to Follow\n`;
    content.existing_patterns.forEach((pat: any) => {
      md += `### ${pat.description}\n`;
      if (pat.files && pat.files.length > 0) {
        md += `Files:\n`;
        pat.files.forEach((f: string) => {
          md += `- \`${f}\`\n`;
        });
      }
      md += `\n`;
    });
  }

  if (content.steps && content.steps.length > 0) {
    md += `## Implementation Steps\n\n`;
    content.steps.forEach((step: PlanStep) => {
      md += `### Step ${step.order}: ${step.title}\n`;
      md += `${step.description || ""}\n\n`;
      if (step.why_this_order) md += `- **Why this order:** ${step.why_this_order}\n`;
      if (step.migration_impact) md += `- **Migration Impact:** ${step.migration_impact}\n`;
      if (step.rollback_concern) md += `- **Rollback/Reversal:** ${step.rollback_concern}\n`;
      md += `\n`;

      if (step.files && step.files.length > 0) {
        md += `#### Files to modify:\n`;
        step.files.forEach((f: PlanFile) => {
          md += `- **[\`${f.action.toUpperCase()}\`]** \`${f.path}\` (Confidence: ${f.confidence}) - *${f.reason}*\n`;
        });
        md += `\n`;
      }

      if (step.references && step.references.length > 0) {
        md += `#### Reference patterns:\n`;
        step.references.forEach((ref: any) => {
          md += `- \`${ref.path}\` - *${ref.reason}*\n`;
        });
        md += `\n`;
      }
    });
  }

  if (content.unknowns && content.unknowns.length > 0) {
    md += `## Unknowns & Open Questions\n`;
    content.unknowns.forEach((item: string) => {
      md += `- ⚠️ ${item}\n`;
    });
    md += `\n`;
  }

  if (content.risks_and_considerations && content.risks_and_considerations.length > 0) {
    md += `## Risks & Considerations\n`;
    content.risks_and_considerations.forEach((item: string) => {
      md += `- 🚨 ${item}\n`;
    });
    md += `\n`;
  }

  if (content.testing_suggestions && content.testing_suggestions.length > 0) {
    md += `## Verification & Testing\n`;
    content.testing_suggestions.forEach((item: string) => {
      md += `- ✅ ${item}\n`;
    });
    md += `\n`;
  }

  return md;
}
