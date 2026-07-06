"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 rounded border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
      title="Copy snippet"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400 animate-in zoom-in-50 duration-150" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 transition-transform duration-200 group-hover:scale-105" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
