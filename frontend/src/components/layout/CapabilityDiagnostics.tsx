import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Sparkles,
  XCircle
} from "lucide-react";

import { api } from "../../lib/api";
import { cx } from "../../utils/cx";

type CapabilityDiagnosticsProps = {
  missingCapabilities: string[];
  backendFailureMessage?: string;
  suggestedQuery?: string;
  onRunSimplifiedQuery?: () => void;
};

type CapabilityStatus = {
  capability: string;
  foundInPluginRegistry: boolean;
};

function collectText(value: unknown, depth = 0): string {
  if (depth > 6) return "";

  if (typeof value === "string") return value;

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => collectText(item, depth + 1)).join(" ");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key} ${collectText(item, depth + 1)}`)
      .join(" ");
  }

  return "";
}

export function CapabilityDiagnostics({
  missingCapabilities,
  backendFailureMessage,
  suggestedQuery,
  onRunSimplifiedQuery
}: CapabilityDiagnosticsProps) {
  const [loading, setLoading] = useState(false);
  const [pluginPayload, setPluginPayload] = useState<unknown>(null);
  const [pluginError, setPluginError] = useState("");

  const normalizedMissing = useMemo(
    () =>
      Array.from(
        new Set(
          missingCapabilities
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ),
    [missingCapabilities]
  );

  async function loadPlugins() {
    if (!normalizedMissing.length) return;

    setLoading(true);
    setPluginError("");

    try {
      const payload = await api.listPlugins();
      setPluginPayload(payload);
    } catch (error) {
      setPluginError(
        error instanceof Error
          ? error.message
          : "Could not load plugin registry."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedMissing.join("|")]);

  const registryText = useMemo(
    () => collectText(pluginPayload).toLowerCase(),
    [pluginPayload]
  );

  const statuses: CapabilityStatus[] = useMemo(
    () =>
      normalizedMissing.map((capability) => ({
        capability,
        foundInPluginRegistry: registryText.includes(capability.toLowerCase())
      })),
    [normalizedMissing, registryText]
  );

  if (!normalizedMissing.length) {
    return null;
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50">
      <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle size={18} />
          </div>

          <div>
            <div className="text-sm font-extrabold text-amber-900">
              Capability Diagnostics
            </div>
            <div className="text-xs text-amber-700">
              Required backend capabilities are missing
            </div>
          </div>
        </div>

        <button
          onClick={loadPlugins}
          disabled={loading}
          className="flex h-8 items-center gap-2 rounded-lg bg-white/70 px-3 text-xs font-extrabold text-amber-800 hover:bg-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Check
        </button>
      </div>

      <div className="p-4">
        {backendFailureMessage && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs leading-5 text-amber-900">
            {backendFailureMessage}
          </div>
        )}

        <div className="mb-3 space-y-2">
          {statuses.map((item) => (
            <div
              key={item.capability}
              className="flex items-center justify-between rounded-xl border border-amber-100 bg-white/75 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Plug size={14} className="shrink-0 text-amber-700" />
                <span className="truncate font-mono text-xs font-extrabold text-slate-800">
                  {item.capability}
                </span>
              </div>

              <span
                className={cx(
                  "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                  item.foundInPluginRegistry
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                )}
              >
                {item.foundInPluginRegistry ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <XCircle size={11} />
                )}
                {item.foundInPluginRegistry ? "Registered" : "Missing"}
              </span>
            </div>
          ))}
        </div>

        {pluginError && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
            {pluginError}
          </div>
        )}

        {suggestedQuery && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-blue-800">
              <Sparkles size={14} />
              Suggested simplified query
            </div>

            <div className="max-h-[120px] overflow-y-auto rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">
              {suggestedQuery}
            </div>

            <button
              onClick={onRunSimplifiedQuery}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700"
            >
              <Sparkles size={14} />
              Run Simplified Query
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
