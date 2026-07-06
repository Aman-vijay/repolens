"use client";

import { FileText, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatMessagesProps {
  messages: any[];
  onFileClick: (filePath: string, lineRange?: string) => void;
  isMessagesLoading?: boolean;
}

export function getMessageText(message: any): string {
  if (message.content) {
    return message.content;
  }
  if (message.text) {
    return message.text;
  }
  if (Array.isArray(message.parts)) {
    const textFromParts = message.parts
      .filter((part: any) => part && part.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("");
    if (textFromParts) return textFromParts;
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  return "";
}

function renderMessageContent(
  content: string,
  onFileClick: (filePath: string, lineRange?: string) => void
) {
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
    const lineRange = startLine
      ? endLine
        ? `${startLine}-${endLine}`
        : startLine
      : undefined;

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

  return parts.length > 0 ? (
    <span className="whitespace-pre-wrap">{parts}</span>
  ) : (
    <span className="whitespace-pre-wrap">{content}</span>
  );
}

export function ChatMessages({
  messages,
  onFileClick,
  isMessagesLoading = false,
}: ChatMessagesProps) {
  if (isMessagesLoading) {
    return (
      <div className="space-y-6 py-4 animate-in fade-in duration-300">
        {/* User Skeleton Message bubble */}
        <div className="flex justify-end gap-3 px-1">
          <div className="max-w-[70%] rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 space-y-2 w-48">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>

        {/* Agent Skeleton Message bubble */}
        <div className="flex justify-start gap-3 px-1">
          <div className="max-w-[85%] rounded-xl border border-border bg-card/20 px-4 py-3 space-y-3 w-[420px]">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-2 w-32" />
              </div>
            </div>
            <div className="space-y-2 pt-1 border-t border-border/40">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
        <span className="h-px flex-1 bg-border/80" />
        <span>Conversation</span>
        <span className="h-px flex-1 bg-border/80" />
      </div>

      {messages.map((message) => {
        const isUser = message.role === "user";
        const contentText = getMessageText(message);

        // Skip rendering if empty and not user (e.g. intermediate tool calls)
        if (!contentText.trim() && !isUser) return null;

        return (
          <div
            key={message.id}
            className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200", isUser ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-xl border px-4 py-3 sm:max-w-[82%] shadow-sm transition-all duration-200",
                isUser
                  ? "border-primary/25 bg-primary/10 hover:border-primary/35"
                  : "border-border bg-card/35 hover:border-border-hover"
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                    isUser
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  )}
                >
                  {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {isUser ? "You" : "Agent"}
                  </p>
                  {!isUser && (
                    <p className="text-[9px] text-muted-foreground/75">
                      Grounded by repository analysis and live retrieval
                    </p>
                  )}
                </div>
              </div>

              <div className="text-[13px] leading-6 text-foreground/92 selection:bg-primary/25 select-text">
                {renderMessageContent(contentText, onFileClick)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
