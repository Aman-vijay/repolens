"use client";

import { useState } from "react";
import { ChevronRight, File, Folder } from "lucide-react";

import type { TreeNode } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TreeLeaf({ node }: { node: TreeNode; depth: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-sm py-1 px-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground">
      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      <span className="truncate">{node.name}</span>
      {node.size !== undefined && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground/50">
          {formatBytes(node.size)}
        </span>
      )}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
}: {
  node: TreeNode;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.truncated) {
    return (
      <div className="py-1 px-2 text-xs italic text-muted-foreground/70">
        {"\u2026"} (max depth reached)
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-sm py-1 px-2 text-sm text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden="true"
        />
        <Folder className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {expanded && (
        <div className="ml-3.5 border-l border-border/50 pl-2">
          {node.children?.map((child, i) =>
            child.type === "dir" ? (
              <TreeBranch key={i} node={child} depth={depth + 1} />
            ) : (
              <TreeLeaf key={i} node={child} depth={depth + 1} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({ tree }: { tree: TreeNode | null }) {
  if (!tree) return null;
  return (
    <div className="max-h-96 space-y-0.5 overflow-auto rounded-md border border-border bg-card/50 p-2 font-mono text-sm">
      <TreeBranch node={tree} depth={0} />
    </div>
  );
}