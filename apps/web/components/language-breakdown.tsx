"use client";

const LANGUAGE_COLORS: Record<string, string> = {
  Python: "#3572A5",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Markdown: "#083fa1",
  JSON: "#292929",
  YAML: "#cb171e",
  TOML: "#9c4221",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  SQL: "#e38c00",
  Docker: "#384d54",
  Config: "hsl(var(--muted-foreground))",
};

export function LanguageBreakdown({
  languages,
}: {
  languages: Record<string, { files: number; bytes: number }> | null;
}) {
  if (!languages) return null;

  const sorted = Object.entries(languages).sort(
    (a, b) => b[1].bytes - a[1].bytes,
  );

  const totalBytes = sorted.reduce((sum, [, v]) => sum + v.bytes, 0);
  if (totalBytes === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Language breakdown">
        {sorted.map(([lang, stats]) => (
          <div
            key={lang}
            style={{
              width: `${(stats.bytes / totalBytes) * 100}%`,
              backgroundColor: LANGUAGE_COLORS[lang] ?? "hsl(var(--muted-foreground))",
            }}
            title={`${lang}: ${((stats.bytes / totalBytes) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {sorted.slice(0, 9).map(([lang, stats]) => (
          <div key={lang} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: LANGUAGE_COLORS[lang] ?? "hsl(var(--muted-foreground))" }}
              aria-hidden="true"
            />
            <span className="truncate">{lang}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {((stats.bytes / totalBytes) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}