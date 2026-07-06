"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { DefaultChatTransport } from "ai";
import { 
  ArrowUp,
  Bot,
  Brain,
  ChevronRight,
  CornerDownLeft,
  FileSearch,
  FileText,
  GitBranch,
  HelpCircle,
  Loader2, 
  RotateCcw,
  Sparkles, 
  User,
} from "lucide-react";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Format file links: [auth.py:12-34](file:///apps/api/app/routes/auth.py#L12-L34)
function renderMessageContent(content: string, onFileClick: (filePath: string, lineRange?: string) => void) {
  // Regex to match markdown links with file:/// scheme
  const linkRegex = /\[([^\]]+)\]\(file:\/\/\/([^#\)]+)(?:#L?(\d+)(?:-L?(\d+))?)?\)/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    
    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(content.substring(lastIndex, matchIndex));
    }

    const label = match[1];
    const filePath = match[2];
    const startLine = match[3];
    const endLine = match[4];
    const lineRange = startLine ? (endLine ? `${startLine}-${endLine}` : startLine) : undefined;

    parts.push(
      <button
        key={matchIndex}
        type="button"
        onClick={() => onFileClick(filePath, lineRange)}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 font-mono text-[11px] text-primary hover:bg-primary/20 transition-all focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <FileText className="h-3 w-3" />
        {label}
      </button>
    );

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  // Fallback to plain text if no links found, otherwise render parsed elements
  return parts.length > 0 ? <span className="whitespace-pre-wrap">{parts}</span> : <span className="whitespace-pre-wrap">{content}</span>;
}

function getMessageText(message: any): string {
  if (message.content) return message.content;
  if (message.parts) {
    return message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }
  return "";
}

function getTraceStage(trace: string | null) {
  if (!trace) return "Preparing";

  const lowered = trace.toLowerCase();
  if (lowered.includes("gathering") || lowered.includes("loaded") || lowered.includes("preloaded")) {
    return "Gathering context";
  }
  if (lowered.includes("semantic") || lowered.includes("search") || lowered.includes("tool")) {
    return "Inspecting repository";
  }
  if (lowered.includes("formulating")) {
    return "Composing answer";
  }
  return "Working";
}

export function CodebaseChat({ projectId }: { projectId: string }) {
  const { getToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { chatThreads, setChatMessages, clearChatThread, activeAnalysis } = useAppStore();
  const persistedMessages = chatThreads[projectId] || [];

  // 1. Declare state for input and chatData (traces)
  const [input, setInput] = useState("");
  const [chatData, setChatData] = useState<any[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const { 
    messages, 
    sendMessage, 
    status, 
    setMessages,
    stop 
  } = useChat({
    messages: persistedMessages as any,
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/chat`,
      fetch: async (url, init) => {
        const token = await getToken();
        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${token}`,
          }
        });
      }
    }),
    onFinish: ({ messages: newMessages }) => {
      // Save updated messages thread to local Zustand store
      setChatMessages(projectId, newMessages as any);
    },
    onData: (dataPart: any) => {
      if (dataPart && dataPart.type === "trace") {
        setChatData(prev => [...prev, dataPart]);
      } else if (dataPart && dataPart.data && dataPart.data.type === "trace") {
        setChatData(prev => [...prev, dataPart.data]);
      } else {
        setChatData(prev => [...prev, dataPart]);
      }
    }
  });

  const isLoading = status === "submitted" || status === "streaming";
  const failurePrefix = "I could not gather enough grounded repository evidence";

  useEffect(() => {
    setMessages(persistedMessages as any);
    setChatData([]);
    setInput("");
  }, [persistedMessages, projectId, setMessages]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Clear previous traces
    setChatData([]);
    
    // Send the user message
    sendMessage({ text: input });
    setInput("");
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, chatData]);

  // Handle file citation clicking (can trigger navigation or highlight in tree)
  const handleFileClick = (filePath: string, lineRange?: string) => {
    // Dispatch a custom event to notify parent layout/components (e.g. to open file code)
    const event = new CustomEvent("repolens:open-file", {
      detail: { filePath, lineRange }
    });
    window.dispatchEvent(event);
  };

  // Generate dynamic suggested questions based on repository framework & primary language
  const getSuggestedQuestions = (): string[] => {
    if (!activeAnalysis || !activeAnalysis.repo_facts) {
      return [
        "Explain the overall architecture of this project.",
        "What is the main entry point of this codebase?",
        "Where is authentication handled in this code?"
      ];
    }

    const facts = activeAnalysis.repo_facts;
    const framework = facts.primary_framework?.toLowerCase() || "";
    const suggestions = [];

    if (framework.includes("fastapi")) {
      suggestions.push("How are FastAPI dependencies and routing set up?");
      suggestions.push("Show me where the API routes are defined.");
    } else if (framework.includes("next")) {
      suggestions.push("Explain page routing and App Router layouts.");
      suggestions.push("Where are frontend state and components located?");
    } else if (facts.containerized) {
      suggestions.push("How is the Docker container configuration structured?");
    }

    // Generic defaults to round up to 3 questions
    if (suggestions.length < 3) {
      suggestions.push("What design patterns are used in this codebase?");
    }
    if (suggestions.length < 3) {
      suggestions.push("List the main dependencies and libraries configured.");
    }
    if (suggestions.length < 3) {
      suggestions.push("Where is the database database models or repository layer?");
    }

    return suggestions.slice(0, 3);
  };

  const handleClearHistory = () => {
    clearChatThread(projectId);
    setMessages([]);
    setChatData([]);
  };

  // Extract streamed data logs (retrieval traces)
  const traces = chatData
    .map(d => {
      if (d && d.type === "trace") return d.message;
      if (d && d.type === "data-trace" && d.data) return d.data.message;
      if (d && d.data && d.data.type === "trace") return d.data.message;
      return null;
    })
    .filter(Boolean) as string[];
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : null;
  const thinkingStage = getTraceStage(latestTrace);
  const recentTraces = traces.slice(-4);
  const agentMessageCount = messages.filter((message) => message.role === "assistant").length;
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const latestAssistantText = latestAssistantMessage ? getMessageText(latestAssistantMessage) : "";
  const shouldShowRunDiagnostics =
    isLoading || (latestAssistantText.startsWith(failurePrefix) && recentTraces.length > 0);
  const framework = activeAnalysis?.repo_facts?.primary_framework || activeAnalysis?.architecture_style || "Repository aware";
  const evidenceHint = activeAnalysis?.source_context
    ? "Analysis indexed"
    : activeAnalysis
      ? "Analysis loaded"
      : "Awaiting context";
  const capabilityChips = [
    { label: "Architecture", icon: GitBranch },
    { label: "File paths", icon: FileSearch },
    { label: "Execution flow", icon: Brain },
  ];

  return (
    <div className="flex flex-col h-[680px] overflow-hidden rounded-xl border border-border bg-card/20 shadow-[0_0_0_1px_hsl(var(--background))_inset]">
      {/* Header */}
      <div className="border-b border-border bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-foreground">Codebase Chat</span>
                  <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-2 text-[10px] font-medium text-primary">
                    {framework}
                  </Badge>
                </div>
                <p className="max-w-[58ch] text-xs text-muted-foreground">
                  Ask grounded questions about structure, files, and execution flow. The agent surfaces what it is inspecting while it works.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/80 bg-background/50 px-2.5 py-1 text-[10px] text-muted-foreground">
                {agentMessageCount} answers in thread
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/80 bg-background/50 px-2.5 py-1 text-[10px] text-muted-foreground">
                {evidenceHint}
              </Badge>
              {capabilityChips.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground"
                >
                  <Icon className="h-3 w-3 text-primary/75" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLoading && (
              <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] text-primary sm:flex">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{thinkingStage}</span>
              </div>
            )}
            {messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearHistory}
                className="h-8 rounded-md px-2.5 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Clear Thread
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 bg-background/30">
        <div className="space-y-5 px-5 py-5">
          {messages.length === 0 && (
            <div className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="space-y-5 rounded-xl border border-border bg-card/40 p-5">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] text-primary">
                    <Brain className="h-3.5 w-3.5" />
                    Developer-first repository agent
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-semibold tracking-tight text-foreground">Ask about this codebase</h4>
                    <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
                      Use natural language. The agent retrieves architectural context, inspects likely files, and explains how the repository is actually wired.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/80 bg-background/45 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Signal</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Repository-aware answers</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/45 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Thinking</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Visible retrieval progress</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/45 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Output</p>
                    <p className="mt-2 text-sm font-medium text-foreground">File-grounded guidance</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card/25 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-foreground">Suggested starting points</h5>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seed the composer with a focused question and refine from there.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {getSuggestedQuestions().map((question, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        handleInputChange({ target: { value: question } } as any);
                      }}
                      className="group flex items-start gap-3 rounded-lg border border-border/80 bg-background/40 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/75" />
                      <span className="flex-1 text-sm leading-5 text-foreground/90">{question}</span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Conversation
                <span className="h-px flex-1 bg-border" />
              </div>

              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                      "flex gap-3",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-xl border px-4 py-3 sm:max-w-[82%]",
                        isUser
                          ? "border-primary/25 bg-primary/10"
                          : "border-border bg-card/35"
                      )}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md border",
                            isUser
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          )}
                        >
                          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {isUser ? "You" : "Agent"}
                          </p>
                          {!isUser && (
                            <p className="text-[11px] text-muted-foreground">Grounded by repository analysis and live retrieval</p>
                          )}
                        </div>
                      </div>

                      <div className="text-[13px] leading-6 text-foreground/92">
                        {renderMessageContent(getMessageText(message), handleFileClick)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {shouldShowRunDiagnostics && (
            <div className="rounded-xl border border-border bg-card/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {isLoading ? "Agent is working" : "Last run diagnostics"}
                      </p>
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2 text-[10px] text-primary">
                        {isLoading ? thinkingStage : "Needs stronger grounding"}
                      </Badge>
                    </div>
                    <p className="max-w-[60ch] text-xs leading-5 text-muted-foreground">
                      {isLoading
                        ? "The assistant is inspecting repository evidence before writing its answer. Current progress is shown below so the thread never feels stalled."
                        : "The assistant returned a low-confidence answer. These traces show what repository evidence was gathered so we can distinguish a weak backend result from a rendering problem."}
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-background/40 px-3 py-1 text-[11px] text-muted-foreground sm:flex">
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  Press <span className="font-mono text-foreground">Shift + Enter</span> for a new line
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(260px,1.05fr)]">
                <div className="rounded-lg border border-border/80 bg-background/45 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Live status</p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                    {latestTrace || "Preparing the next answer..."}
                  </div>
                </div>

                <div className="rounded-lg border border-border/80 bg-background/45 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Reasoning trail</p>
                  <div className="mt-3 space-y-2">
                    {recentTraces.length > 0 ? recentTraces.map((trace, index) => (
                      <div key={`${trace}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <span>{trace}</span>
                      </div>
                    )) : (
                      <div className="space-y-2">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card/35 p-4">
        <div className="rounded-xl border border-border bg-background/55 p-3">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={isLoading ? "The agent is generating an answer..." : "Ask about architecture, data flow, files, dependencies, or execution paths..."}
            disabled={isLoading}
            maxLength={1000}
            rows={1}
            className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none placeholder:text-muted-foreground/85 focus-visible:ring-0"
          />

          <div className="mt-3 flex flex-col gap-3 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/50 px-2.5 py-1">
                <Brain className="h-3.5 w-3.5 text-primary/70" />
                Agent shows retrieval progress
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/50 px-2.5 py-1">
                <CornerDownLeft className="h-3.5 w-3.5 text-primary/70" />
                Enter to send, Shift + Enter for newline
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {input.length}/1000
              </span>
              {isLoading ? (
                <Button type="button" variant="destructive" size="sm" onClick={stop} className="h-9 rounded-md px-4">
                  Stop
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} className="h-9 w-9 rounded-md">
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
