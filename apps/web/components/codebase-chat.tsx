"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { Sparkles, Loader2, Plus, MessageSquare, Menu, BadgeAlert, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { useChatSessions, useDeleteChatSession } from "@/lib/queries";
import type { ChatMessageOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Sub-components
import { ChatWelcome } from "./chat/chat-welcome";
import { ChatHistorySidebar } from "./chat/chat-history-sidebar";
import { ChatMessages, getMessageText } from "./chat/chat-messages";
import { ChatDiagnostics } from "./chat/chat-diagnostics";
import { ChatInput } from "./chat/chat-input";

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
  const queryClient = useQueryClient();

  const {
    activeChatSessionId,
    setActiveChatSessionId,
    activeAnalysis,
    isChatSidebarOpen,
    setChatSidebarOpen,
  } = useAppStore();
  const { data: sessions, isPending: sessionsLoading } = useChatSessions(projectId);
  const deleteSessionMutation = useDeleteChatSession();

  // Local state
  const [input, setInput] = useState("");
  const [chatData, setChatData] = useState<any[]>([]);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
  } = useChat({
    messages: [] as any,
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/chat`,
      fetch: async (url, init) => {
        const token = await getToken();
        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      },
    }),
    onFinish: () => {
      // Invalidate sessions query to refresh list in sidebar
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", projectId] });
    },
    onData: (dataPart: any) => {
      if (dataPart && dataPart.type === "trace") {
        setChatData(prev => [...prev, dataPart]);
      } else if (dataPart && dataPart.data && dataPart.data.type === "trace") {
        setChatData(prev => [...prev, dataPart.data]);
      } else {
        setChatData(prev => [...prev, dataPart]);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";
  const failurePrefix = "I could not gather enough grounded repository evidence";

  // Reset chat state on project change
  useEffect(() => {
    setMessages([]);
    setChatData([]);
    setInput("");
  }, [projectId, setMessages]);

  // Load a session's messages when activeChatSessionId changes
  useEffect(() => {
    if (!activeChatSessionId) {
      setMessages([]);
      setChatData([]);
      return;
    }
    (async () => {
      setIsMessagesLoading(true);
      const token = await getToken();
      if (!token) {
        setIsMessagesLoading(false);
        return;
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const res = await fetch(
          `${API_URL}/api/projects/${projectId}/chat/sessions/${activeChatSessionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          setIsMessagesLoading(false);
          return;
        }
        const detail = await res.json();
        const sessionMessages: any[] = (detail.messages || []).map((m: ChatMessageOut) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          parts: [{ type: "text", text: m.content }],
        }));
        setMessages(sessionMessages);
      } catch {
        // ignore
      } finally {
        setIsMessagesLoading(false);
      }
    })();
  }, [activeChatSessionId, projectId, getToken, setMessages]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Clear previous traces
    setChatData([]);

    // Send user message
    sendMessage({ text: input });
    setInput("");
  };

  const handleFileClick = (filePath: string, lineRange?: string) => {
    // Custom event to notify code explorer to open file
    const event = new CustomEvent("repolens:open-file", {
      detail: { filePath, lineRange }
    });
    window.dispatchEvent(event);
  };

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

  const handleNewChat = () => {
    setActiveChatSessionId(null);
    setMessages([]);
    setChatData([]);
    setInput("");
  };

  const handleDeleteSession = (sessionId: string) => {
    setDeletingSessionId(sessionId);
    deleteSessionMutation.mutate(
      { projectId, sessionId },
      {
        onSuccess: () => {
          if (activeChatSessionId === sessionId) {
            setActiveChatSessionId(null);
            setMessages([]);
            setChatData([]);
          }
          toast.success("Chat session deleted.");
        },
        onError: () => {
          toast.error("Failed to delete session.");
        },
        onSettled: () => {
          setDeletingSessionId(null);
        }
      }
    );
  };

  // Extract reasoning trail traces
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

  const agentMessageCount = messages.filter((m) => m.role === "assistant").length;
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const latestAssistantText = latestAssistantMessage ? getMessageText(latestAssistantMessage) : "";
  const shouldShowRunDiagnostics =
    isLoading || (latestAssistantText.startsWith(failurePrefix) && recentTraces.length > 0);

  const framework = activeAnalysis?.repo_facts?.primary_framework || activeAnalysis?.architecture_style || "Repository aware";
  const evidenceHint = activeAnalysis?.source_context
    ? "Analysis indexed"
    : activeAnalysis
      ? "Analysis loaded"
      : "Awaiting context";

  return (
    <div className="flex h-[680px] overflow-hidden rounded-xl border border-border bg-card/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      
      {/* Desktop History Sidebar */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
          isChatSidebarOpen ? "w-60" : "w-0 border-r-0"
        )}
      >
        <div className="w-60 h-full">
          <ChatHistorySidebar
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeChatSessionId={activeChatSessionId}
            onSelectSession={setActiveChatSessionId}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
            deletingSessionId={deletingSessionId}
            onCollapseDesktop={() => setChatSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {showSidebarMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-64 max-w-[80vw] h-full border-r border-border bg-background shadow-xl">
            <ChatHistorySidebar
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              activeChatSessionId={activeChatSessionId}
              onSelectSession={setActiveChatSessionId}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              deletingSessionId={deletingSessionId}
              onCloseMobile={() => setShowSidebarMobile(false)}
            />
          </div>
          <div className="flex-1" onClick={() => setShowSidebarMobile(false)} />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background/10">
        
        {/* Header */}
        <div className="border-b border-border bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Toggle History Sidebar Buttons */}
            {!isChatSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatSidebarOpen(true)}
                className="hidden md:flex h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                title="Expand history sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebarMobile(true)}
              className="flex md:hidden h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              title="Open history"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-foreground">Codebase Chat</span>
                <Badge variant="outline" className="h-4.5 rounded-full border-primary/20 bg-primary/10 px-2 text-[9px] font-medium text-primary">
                  {framework}
                </Badge>
              </div>
              <p className="hidden sm:block text-[10px] text-muted-foreground">
                Ask structure, logic, and data flow questions. Grounded by repository evidence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline font-medium">{thinkingStage}</span>
              </div>
            )}
            <Badge variant="outline" className="hidden sm:inline-flex rounded-full border-border/80 bg-background/50 px-2 py-0.5 text-[9px] text-muted-foreground">
              {evidenceHint}
            </Badge>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <ScrollArea className="flex-1 bg-background/5">
          <div className="space-y-5 px-5 py-5">
            {messages.length === 0 && !isMessagesLoading ? (
              <ChatWelcome
                framework={framework}
                evidenceHint={evidenceHint}
                agentMessageCount={agentMessageCount}
                suggestedQuestions={getSuggestedQuestions()}
                onSelectQuestion={setInput}
              />
            ) : (
              <ChatMessages
                messages={messages}
                onFileClick={handleFileClick}
                isMessagesLoading={isMessagesLoading}
              />
            )}

            {shouldShowRunDiagnostics && !isMessagesLoading && (
              <ChatDiagnostics
                isLoading={isLoading}
                thinkingStage={thinkingStage}
                latestTrace={latestTrace}
                recentTraces={recentTraces}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Controls */}
        <ChatInput
          input={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
