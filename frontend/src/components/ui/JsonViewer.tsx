import { Copy, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type JsonViewerProps = {
  value: unknown;
  title?: string;
};

function circularSafeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    const result = JSON.stringify(
      value,
      (_key, item) => {
        if (typeof item === "object" && item !== null) {
          if (seen.has(item)) return "[Circular]";
          seen.add(item);
        }

        if (typeof item === "function") {
          return `[Function ${item.name || "anonymous"}]`;
        }

        if (item instanceof Error) {
          return {
            name: item.name,
            message: item.message,
            stack: item.stack
          };
        }

        return item;
      },
      2
    );

    return result ?? "undefined";
  } catch (error) {
    const fallback = JSON.stringify(
      {
        serialization_error:
          error instanceof Error ? error.message : String(error),
        fallback: String(value)
      },
      null,
      2
    );

    return fallback ?? String(value);
  }
}

function getFilteredJsonText(text: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      displayText: text,
      matchCount: 0,
      totalLines: text.split("\n").length,
      filtered: false
    };
  }

  const lines = text.split("\n");
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.toLowerCase().includes(normalizedQuery));

  return {
    displayText:
      matches.length > 0
        ? matches
            .map(({ line, index }) => `${String(index + 1).padStart(4, " ")} │ ${line}`)
            .join("\n")
        : "No matching JSON lines.",
    matchCount: matches.length,
    totalLines: lines.length,
    filtered: true
  };
}

export function JsonViewer({ value, title }: JsonViewerProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => circularSafeStringify(value), [value]);

  const filtered = useMemo(
    () => getFilteredJsonText(text, query),
    [text, query]
  );

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable.
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
      <div className="border-b border-slate-800 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold text-slate-100">
              {title || "JSON"}
            </div>

            <div className="mt-1 text-[10px] font-bold text-slate-400">
              {filtered.filtered
                ? `${filtered.matchCount} matching lines from ${filtered.totalLines}`
                : `${filtered.totalLines} lines`}
            </div>
          </div>

          <button
            onClick={copyJson}
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15"
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
          <Search size={14} className="shrink-0 text-slate-400" />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search JSON lines..."
            className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-500"
          />

          {query.trim() && (
            <button
              onClick={() => setQuery("")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {filtered.filtered && (
          <div className="mt-2 rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-200">
            Showing only matching JSON lines. Copy still copies the full JSON payload.
          </div>
        )}
      </div>

      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-slate-100">
        {filtered.displayText}
      </pre>
    </div>
  );
}
