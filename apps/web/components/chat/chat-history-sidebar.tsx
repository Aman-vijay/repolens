"use client";

import { MessageSquare, Plus, Trash2, Loader2, History, ChevronLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatHistorySidebarProps {
  sessions: any[] | undefined;
  sessionsLoading: boolean;
  activeChatSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  deletingSessionId: string | null;
  onCloseMobile?: () => void;
  onCollapseDesktop?: () => void;
}

export function ChatHistorySidebar({
  sessions,
  sessionsLoading,
  activeChatSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  deletingSessionId,
  onCloseMobile,
  onCollapseDesktop,
}: ChatHistorySidebarProps) {
  return (
    <div className="flex h-full w-full flex-col bg-card/10 backdrop-blur-md">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5 text-primary" />
          <span>Chat History</span>
        </div>
        <div className="flex items-center gap-1">
          {onCloseMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseMobile}
              className="h-7 w-7 md:hidden text-muted-foreground hover:text-foreground"
              aria-label="Close history"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {onCollapseDesktop && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapseDesktop}
              className="hidden md:flex h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              aria-label="Collapse history"
              title="Collapse history"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={() => {
            onNewChat();
            if (onCloseMobile) onCloseMobile();
          }}
          variant="outline"
          className="w-full justify-start gap-2 border-border/80 bg-background/50 hover:bg-primary/5 hover:border-primary/30 text-xs font-medium transition-all"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          New Chat
        </Button>
      </div>

      {/* Sessions Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin">
        {sessionsLoading ? (
          // Session loading skeletons
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-background/25 px-3 py-2.5 animate-pulse"
            >
              <div className="h-3.5 w-3.5 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-2 w-1/4 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : !sessions || sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <MessageSquare className="h-7 w-7 text-muted-foreground/30 mb-2" />
            <p className="text-[11px] text-muted-foreground">No conversations yet.</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = activeChatSessionId === session.id;
            const isDeleting = deletingSessionId === session.id;

            return (
              <div
                key={session.id}
                className="group relative flex w-full items-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs transition-all duration-200 pr-10",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-foreground font-medium"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-border"
                  )}
                >
                  <MessageSquare
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary/70"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{session.title || "Untitled Chat"}</p>
                    <p className="mt-0.5 text-[9px] tabular-nums text-muted-foreground/60">
                      {new Date(session.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </button>

                {/* Quick Deletion Button */}
                <div className="absolute right-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className={cn(
                      "h-6 w-6 rounded text-muted-foreground/75 hover:text-destructive hover:bg-destructive/10",
                      isDeleting && "text-muted-foreground"
                    )}
                    title="Delete session"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
