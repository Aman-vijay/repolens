"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { ChevronRight, File, Folder } from "lucide-react";

import type { TreeNode } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";


function TreeLeaf({ node }: { node: TreeNode; depth: number }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-sm py-1 px-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      role="treeitem"
      aria-selected="false"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
        }
      }}
    >
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
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (node.truncated) {
    return (
      <div className="py-1 px-2 text-xs italic text-muted-foreground/70" role="treeitem" aria-selected="false">
        {"\u2026"} (max depth reached)
      </div>
    );
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      if (!expanded) {
        setExpanded(true);
      } else if (node.children && node.children.length > 0) {
        const firstChild = node.children[0];
        if (firstChild.type === "dir") {
        } else {
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (expanded) {
        setExpanded(false);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded((v) => !v);
    }
  };

  return (
    <div role="group">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        role="treeitem"
        aria-selected="false"
        tabIndex={0}
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
        <div className="ml-3.5 border-l border-border/50 pl-2" role="group">
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