"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { DefaultChatTransport } from "ai";
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Sparkles, 
  FileText, 
  Terminal, 
  Info, 
  HelpCircle,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export function CodebaseChat({ projectId }: { projectId: string }) {
  const { getToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { chatThreads, setChatMessages, clearChatThread, activeAnalysis } = useAppStore();
  const initialMessages = chatThreads[projectId] || [];

  // 1. Declare state for input and chatData (traces)
  const [input, setInput] = useState("");
  const [chatData, setChatData] = useState<any[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const { 
    messages, 
    sendMessage, 
    status, 
    setMessages,
    stop 
  } = useChat({
    messages: initialMessages as any,
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

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Clear previous traces
    setChatData([]);
    
    // Send the user message
    sendMessage({ text: input });
    setInput("");
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

  return (
    <div className="flex flex-col h-[600px] border border-border rounded-lg overflow-hidden bg-card/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Codebase Chat</span>
        </div>
        {messages.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearHistory}
            className="h-7 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Clear Thread
          </Button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 p-4 bg-background/5">
        <div className="space-y-4 pr-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Bot className="h-10 w-10 text-muted-foreground/45" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground/90">Ask about this codebase</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Query architecture, trace configurations, find specific variables, or get code highlights.
                </p>
              </div>
              <div className="grid gap-2 w-full max-w-md pt-2">
                {getSuggestedQuestions().map((question, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      handleInputChange({ target: { value: question } } as any);
                    }}
                    className="flex items-center gap-2 rounded border border-border/60 bg-card/30 p-2.5 text-left text-xs text-muted-foreground hover:border-primary/30 hover:bg-muted/15 transition-all focus:outline-none"
                  >
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <span className="truncate">{question}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div 
                key={message.id} 
                className={cn(
                  "flex gap-3 text-sm max-w-[85%] rounded-lg p-3.5 border",
                  isUser 
                    ? "ml-auto bg-primary/10 border-primary/20 text-foreground" 
                    : "bg-card/45 border-border/80 text-foreground/90"
                )}
              >
                <div className="shrink-0 pt-0.5">
                  {isUser ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-emerald-400" />}
                </div>
                <div className="space-y-1.5 overflow-hidden flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                    {isUser ? "User" : "Agent"}
                  </span>
                  <div className="leading-6 text-[13px]">
                    {renderMessageContent(getMessageText(message), handleFileClick)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Retrieval Trace Display */}
          {isLoading && latestTrace && (
            <div className="flex items-center gap-2 rounded border border-border/40 bg-muted/15 p-2 px-3 text-[11px] font-mono text-muted-foreground w-fit animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              <span>{latestTrace}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card/20 flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder={isLoading ? "Generating response..." : "Ask a question about the repository..."}
          disabled={isLoading}
          maxLength={1000}
          className="flex-1 text-xs"
        />
        {isLoading ? (
          <Button type="button" variant="destructive" size="sm" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
