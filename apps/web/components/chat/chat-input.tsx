"use client";

import { useEffect, useRef, FormEvent, KeyboardEvent } from "react";
import { ArrowUp, Brain, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading: boolean;
  maxLength?: number;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  maxLength = 1000,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the height of textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-card/35 p-4">
      <div className="rounded-xl border border-border bg-background/55 p-3 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)] focus-within:border-primary/30 transition-all duration-200">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isLoading
              ? "The agent is generating an answer..."
              : "Ask about architecture, data flow, files, dependencies, or execution paths..."
          }
          disabled={isLoading}
          maxLength={maxLength}
          rows={1}
          className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
        />

        <div className="mt-3 flex flex-col gap-3 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Instructions chips */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/50 px-2.5 py-1">
              <Brain className="h-3 w-3 text-primary/70" />
              Agent shows retrieval progress
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/50 px-2.5 py-1">
              <CornerDownLeft className="h-3 w-3 text-primary/70" />
              Enter to send, Shift + Enter for newline
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-[10px] font-mono tracking-tight tabular-nums text-muted-foreground/75">
              {input.length}/{maxLength}
            </span>
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onStop}
                aria-label="Stop generation"
                className="h-8 rounded-md px-3.5 text-xs font-semibold shadow-sm transition-all duration-200"
              >
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Send message"
                className="h-8 w-8 rounded-md shadow-sm transition-all duration-200"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
