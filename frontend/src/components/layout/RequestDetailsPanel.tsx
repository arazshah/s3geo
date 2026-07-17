import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Layers
} from "lucide-react";
import { useMemo, useState } from "react";

import { JsonViewer } from "../ui/JsonViewer";
import { cx } from "../../utils/cx";

export type RequestDetailsState = {
  requestId: string;
  rawRequest?: unknown;
  rawOutputs?: unknown;
  rawMapLayers?: unknown;
  rawFiles?: unknown;
};

type TabKey = "response" | "outputs" | "mapLayers" | "files";

type RequestDetailsPanelProps = {
  details: RequestDetailsState | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, keys: string[], fallback = "") {
  if (!isRecord(value)) return fallback;

  for (const key of keys) {
    const item = value[key];

    if (item !== undefined && item !== null && String(item).trim()) {
      return String(item);
    }
  }

  return fallback;
}

function isSoftUnavailableText(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("planner unavailable") ||
    normalized.includes("preview endpoint unavailable") ||
    normalized.includes("missing capabilities") ||
    normalized.includes("required capabilities") ||
    normalized.includes("could not find required capabilities") ||
    normalized.includes("unavailable capabilities") ||
    normalized.includes("llm planning") ||
    normalized.includes("query spec planning") ||
    normalized.includes("openai_base_url") ||
    normalized.includes("llm_base_url") ||
    normalized.includes("disabled") ||
    normalized.includes("fallback")
  );
}

function getStatus(details: RequestDetailsState | null) {
  const rawRequest = details?.rawRequest;

  if (!isRecord(rawRequest)) {
    return {
      failed: false,
      tone: "empty",
      label: "No response loaded",
      message: "No backend response is available yet. Run an analysis or open request outputs to inspect details."
    };
  }

  const response = isRecord(rawRequest.response)
    ? rawRequest.response
    : isRecord(rawRequest.backendResponse)
      ? rawRequest.backendResponse
      : rawRequest;

  const status = readString(
    response,
    [
      "status",
      "state",
      "outcome",
      "result_status",
      "resultStatus",
      "execution_status",
      "executionStatus",
      "analysis_status",
      "analysisStatus",
      "request_status",
      "requestStatus"
    ],
    ""
  ).toLowerCase();

  const ok = response.ok;
  const success = response.success;

  const errors = Array.isArray(response.errors) ? response.errors : [];

  const metadata = isRecord(response.metadata) ? response.metadata : null;

  const structuredError = isRecord(response.structured_error)
    ? response.structured_error
    : isRecord(response.structuredError)
      ? response.structuredError
      : metadata && isRecord(metadata.structured_error)
        ? metadata.structured_error
        : metadata && isRecord(metadata.structuredError)
          ? metadata.structuredError
          : metadata && isRecord(metadata.service_structured_error)
            ? metadata.service_structured_error
            : metadata && isRecord(metadata.serviceStructuredError)
              ? metadata.serviceStructuredError
              : null;

  const frontendDetectedFailure = readString(
    rawRequest,
    ["frontendDetectedFailure", "frontend_detected_failure"],
    ""
  );

  const statusLooksHardFailed =
    status === "failed" ||
    status === "failure" ||
    status === "error" ||
    status === "errored" ||
    status.includes("failed") ||
    status.includes("failure") ||
    status.includes("error") ||
    status.includes("exception") ||
    status.includes("timeout") ||
    status.includes("aborted") ||
    status.includes("cancelled") ||
    status.includes("canceled") ||
    status.includes("rejected");

  const statusLooksSoftUnavailable =
    status.includes("fallback") ||
    status.includes("unavailable") ||
    status.includes("missing") ||
    isSoftUnavailableText(status);

  const booleanFailure =
    ok === false ||
    success === false ||
    response.failed === true ||
    response.failure === true ||
    response.has_error === true ||
    response.hasError === true;

  const hasFailureSignal =
    Boolean(frontendDetectedFailure) ||
    statusLooksHardFailed ||
    statusLooksSoftUnavailable ||
    booleanFailure ||
    errors.length > 0 ||
    Boolean(structuredError);

  const firstErrorMessage =
    errors.length > 0
      ? errors
          .map((item) => {
            if (typeof item === "string") return item;

            if (isRecord(item)) {
              return readString(
                item,
                ["message", "error", "detail", "reason", "description"],
                ""
              );
            }

            return "";
          })
          .find((item) => item.trim()) || ""
      : "";

  const structuredErrorMessage = isRecord(structuredError)
    ? readString(
        structuredError,
        ["message", "error", "detail", "reason", "description"],
        ""
      )
    : "";

  const directMessage = readString(
    response,
    ["message", "summary", "answer", "error_message", "errorMessage", "detail"],
    ""
  );

  const candidateMessage =
    frontendDetectedFailure ||
    firstErrorMessage ||
    structuredErrorMessage ||
    directMessage;

  const softUnavailable =
    statusLooksSoftUnavailable ||
    isSoftUnavailableText(candidateMessage);

  const failed =
    !softUnavailable &&
    (
      Boolean(frontendDetectedFailure) ||
      statusLooksHardFailed ||
      booleanFailure ||
      errors.length > 0 ||
      Boolean(structuredError)
    );

  const message = hasFailureSignal
    ? candidateMessage || (softUnavailable ? "Backend planning or capability support is unavailable." : "Backend analysis failed.")
    : directMessage || "Backend analysis completed successfully.";

  return {
    failed,
    tone: failed ? "error" : softUnavailable ? "warning" : "success",
    label: failed
      ? "Backend analysis failed"
      : softUnavailable
        ? "Backend response needs attention"
        : "Backend analysis completed",
    message
  };
}



function getResponsePayload(details: RequestDetailsState | null): Record<string, unknown> | null {
  const rawRequest = details?.rawRequest;

  if (!isRecord(rawRequest)) return null;

  if (isRecord(rawRequest.response)) return rawRequest.response;
  if (isRecord(rawRequest.backendResponse)) return rawRequest.backendResponse;
  if (isRecord(rawRequest.production_response)) return rawRequest.production_response;

  return rawRequest;
}

function getMetadata(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null;

  if (isRecord(payload.metadata)) return payload.metadata;

  const response = isRecord(payload.response) ? payload.response : null;
  if (response && isRecord(response.metadata)) return response.metadata;

  const productionResponse = isRecord(payload.production_response)
    ? payload.production_response
    : null;
  if (productionResponse && isRecord(productionResponse.metadata)) {
    return productionResponse.metadata;
  }

  return null;
}

function readBooleanFlag(
  metadata: Record<string, unknown> | null,
  keys: string[]
): boolean | null {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "enabled", "on", "1"].includes(normalized)) return true;
      if (["false", "no", "disabled", "off", "0"].includes(normalized)) return false;
    }
  }

  return null;
}

function collectDiagnosticStrings(payload: unknown): string[] {
  const messages: string[] = [];
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 300) {
    scanned += 1;

    const value = queue.shift();

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (
        trimmed &&
        (
          trimmed.toLowerCase().includes("required capabilities") ||
          trimmed.toLowerCase().includes("missing capabilities") ||
          trimmed.toLowerCase().includes("could not find required capabilities") ||
          trimmed.toLowerCase().includes("planner unavailable") ||
          trimmed.toLowerCase().includes("preview endpoint unavailable") ||
          trimmed.toLowerCase().includes("openai_base_url") ||
          trimmed.toLowerCase().includes("llm_base_url")
        )
      ) {
        messages.push(trimmed);
      }

      continue;
    }

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    if (!isRecord(value)) continue;

    if (visited.has(value)) continue;
    visited.add(value);

    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();

      if (
        [
          "message",
          "summary",
          "answer",
          "error",
          "detail",
          "details",
          "warnings",
          "errors",
          "structured_error",
          "structurederror",
          "service_structured_error",
          "servicestructurederror",
          "metadata",
          "raw",
          "response",
          "production_response",
          "frontenddetectedfailure",
          "frontend_detected_failure"
        ].includes(normalizedKey)
      ) {
        queue.push(nested);
      }
    }
  }

  return Array.from(new Set(messages));
}

function extractCapabilitiesFromPayload(payload: unknown): string[] {
  const messages = collectDiagnosticStrings(payload);
  const capabilities: string[] = [];

  const patterns = [
    /required capabilities:\s*([A-Za-z0-9_,\-\s]+)/gi,
    /missing capabilities:\s*([A-Za-z0-9_,\-\s]+)/gi,
    /could not find required capabilities:\s*([A-Za-z0-9_,\-\s]+)/gi
  ];

  for (const message of messages) {
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(message)) !== null) {
        const segment = match[1] || "";
        const tokens = segment.match(/[A-Za-z][A-Za-z0-9_\-]*/g) || [];

        for (const token of tokens) {
          const cleanToken = token.trim();

          if (
            cleanToken.includes("_") &&
            cleanToken.length > 2 &&
            ![
              "required_capabilities",
              "missing_capabilities",
              "structured_error",
              "service_structured_error"
            ].includes(cleanToken)
          ) {
            capabilities.push(cleanToken);
          }
        }
      }
    }
  }

  return Array.from(new Set(capabilities));
}

function buildSuggestedQueryFromPayload(
  payload: Record<string, unknown> | null,
  missingCapabilities: string[]
) {
  if (!payload) return "";

  const query = readString(payload, ["query", "user_query", "userQuery"], "");

  if (!query.trim() || missingCapabilities.length === 0) return "";

  return `${query.trim()} Use only available vector-based operations such as parcel filtering, distance-based proximity analysis, accessibility scoring, area filtering, ranking table generation, and map layer generation. Avoid operations that require these unavailable capabilities: ${missingCapabilities.join(", ")}.`;
}

function getDiagnostics(details: RequestDetailsState | null) {
  const payload = getResponsePayload(details);
  const metadata = getMetadata(payload);
  const diagnosticMessages = collectDiagnosticStrings(details?.rawRequest);
  const missingCapabilities = extractCapabilitiesFromPayload(details?.rawRequest);

  const llmPlanningEnabled = readBooleanFlag(metadata, [
    "llm_planning_enabled",
    "llmPlanningEnabled"
  ]);

  const querySpecPlanningEnabled = readBooleanFlag(metadata, [
    "query_spec_planning_enabled",
    "querySpecPlanningEnabled"
  ]);

  const preferredExecutionMode = readString(
    metadata || {},
    ["frontend_preferred_execution_mode", "frontendPreferredExecutionMode"],
    ""
  );

  const inferredIntent = readString(
    metadata || {},
    ["frontend_inferred_intent", "frontendInferredIntent"],
    ""
  );

  const service = readString(metadata || {}, ["service"], "");

  const plannerUnavailable = diagnosticMessages.some((message) => {
    const normalized = message.toLowerCase();

    return (
      normalized.includes("planner unavailable") ||
      normalized.includes("preview endpoint unavailable") ||
      normalized.includes("openai_base_url") ||
      normalized.includes("llm_base_url")
    );
  });

  const suggestedQuery = buildSuggestedQueryFromPayload(payload, missingCapabilities);

  return {
    diagnosticMessages,
    missingCapabilities,
    llmPlanningEnabled,
    querySpecPlanningEnabled,
    preferredExecutionMode,
    inferredIntent,
    service,
    plannerUnavailable,
    suggestedQuery
  };
}

function formatFlag(value: boolean | null) {
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  return "Unknown";
}


function countItems(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (isRecord(value)) return Object.keys(value).length;
  if (value === null || value === undefined) return 0;
  return 1;
}

function payloadKeys(value: unknown): string[] {
  if (!isRecord(value)) return [];
  return Object.keys(value);
}

function nestedCollection(value: unknown, keys: string[] = []): unknown[] {
  if (Array.isArray(value)) return value;

  if (!isRecord(value)) return [];

  for (const key of keys) {
    const item = value[key];

    if (Array.isArray(item)) return item;

    if (isRecord(item)) {
      const nested = nestedCollection(item, ["items", "data", "results", "files", "documents", "layers", "features"]);
      if (nested.length) return nested;
    }
  }

  for (const key of ["items", "data", "results", "records", "files", "documents", "layers", "map_layers", "mapLayers", "features", "outputs"]) {
    const item = value[key];

    if (Array.isArray(item)) return item;
  }

  return [];
}

function countCollectionByKeys(value: unknown, keys: string[]) {
  if (!isRecord(value)) return 0;

  for (const key of keys) {
    if (key in value) {
      return countItems(value[key]);
    }
  }

  return 0;
}

function readNestedString(value: unknown, keys: string[], fallback = "—") {
  if (!isRecord(value)) {
    if (typeof value === "string" && value.trim()) return value;
    return fallback;
  }

  for (const key of keys) {
    const item = value[key];

    if (item !== undefined && item !== null && String(item).trim()) {
      return String(item);
    }
  }

  return fallback;
}

function fileNameFromPayload(value: unknown, index: number) {
  const name = readNestedString(
    value,
    ["filename", "file_name", "fileName", "name", "title", "path", "url", "href", "download_url", "downloadUrl", "id"],
    ""
  );

  if (name.trim()) {
    const parts = name.split("/");
    return parts[parts.length - 1] || name;
  }

  if (typeof value === "string" && value.trim()) {
    const parts = value.split("/");
    return parts[parts.length - 1] || value;
  }

  return `File ${index + 1}`;
}

function fileUrlFromPayload(value: unknown) {
  return readNestedString(
    value,
    ["download_url", "downloadUrl", "url", "href", "path", "uri"],
    ""
  );
}

const REQUEST_FILE_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

function normalizeFileActionUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${REQUEST_FILE_BASE_URL}${trimmed}`;
  }

  return `${REQUEST_FILE_BASE_URL}/${trimmed.replace(/^\/+/, "")}`;
}

function fileActionUrlFromPayload(value: unknown) {
  return normalizeFileActionUrl(fileUrlFromPayload(value));
}

async function copyTextToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function stringifyClipboardValue(value: unknown): string {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
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
  } catch {
    return String(value);
  }
}

function safeDownloadName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "request-details";
}

function CopyValueButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  title,
  compact = false
}: {
  value: unknown;
  label?: string;
  copiedLabel?: string;
  title?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = stringifyClipboardValue(value);
  const disabled = !text.trim();

  async function handleCopy() {
    if (disabled) return;

    const ok = await copyTextToClipboard(text);

    if (!ok) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      onClick={handleCopy}
      disabled={disabled}
      className={cx(
        "inline-flex items-center gap-1 rounded-lg border font-extrabold transition",
        compact ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-[10px]",
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
      title={title || label}
    >
      <Copy size={compact ? 11 : 12} />
      {copied ? copiedLabel : label}
    </button>
  );
}

function DownloadJsonButton({
  value,
  filename,
  label = "Export JSON"
}: {
  value: unknown;
  filename: string;
  label?: string;
}) {
  const text = stringifyClipboardValue(value);
  const disabled = !text.trim();

  function handleDownload() {
    if (disabled) return;

    const blob = new Blob([text], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className={cx(
        "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-extrabold transition",
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
          : "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
      )}
      title="Export this payload as a local JSON file"
    >
      <Download size={12} />
      {label}
    </button>
  );
}

function FileActionButtons({
  url,
  filename
}: {
  url: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-2 text-[10px] font-extrabold text-slate-500">
        No URL
      </span>
    );
  }

  async function handleCopy() {
    const ok = await copyTextToClipboard(url);

    if (!ok) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50"
        title="Open file in a new tab"
      >
        <ExternalLink size={12} />
        Open
      </a>

      <a
        href={url}
        download={filename}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 text-[10px] font-extrabold text-blue-700 transition hover:bg-blue-100"
        title="Download file when supported by the browser/backend"
      >
        <Download size={12} />
        Download
      </a>

      <button
        onClick={handleCopy}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50"
        title="Copy file URL"
      >
        <Copy size={12} />
        {copied ? "Copied" : "Copy URL"}
      </button>
    </div>
  );
}

function classifyFile(value: unknown) {
  const source = `${fileNameFromPayload(value, 0)} ${fileUrlFromPayload(value)} ${readNestedString(value, ["type", "kind", "mime_type", "mimeType", "content_type", "contentType"], "")}`.toLowerCase();

  if (source.includes(".pdf") || source.includes(".doc") || source.includes("report") || source.includes("document")) {
    return "Report/document";
  }

  if (source.includes(".csv") || source.includes(".xlsx") || source.includes(".xls") || source.includes("table")) {
    return "Table";
  }

  if (source.includes(".geojson") || source.includes(".json") || source.includes(".gpkg") || source.includes(".shp") || source.includes("vector")) {
    return "Vector/GeoJSON";
  }

  if (source.includes(".tif") || source.includes(".tiff") || source.includes("raster")) {
    return "Raster";
  }

  return "File";
}

function layerNameFromPayload(value: unknown, index: number) {
  return readNestedString(
    value,
    ["name", "title", "layer_name", "layerName", "id", "layer_id", "layerId"],
    `Layer ${index + 1}`
  );
}

function layerTypeFromPayload(value: unknown) {
  return readNestedString(
    value,
    ["type", "kind", "geometry_type", "geometryType", "layer_type", "layerType"],
    "Layer"
  );
}

function hasGeoJsonLikePayload(value: unknown) {
  if (!isRecord(value)) return false;

  const type = readNestedString(value, ["type"], "").toLowerCase();

  return (
    type === "feature" ||
    type === "featurecollection" ||
    Boolean(value.geometry) ||
    Boolean(value.geojson) ||
    Array.isArray(value.features)
  );
}

function hasRemoteLayerSource(value: unknown) {
  if (!isRecord(value)) return false;

  return Boolean(
    value.url ||
    value.href ||
    value.source_url ||
    value.sourceUrl ||
    value.tile_url ||
    value.tileUrl ||
    value.source
  );
}

function layerIdFromPayload(value: unknown, index: number) {
  return readNestedString(
    value,
    ["id", "layer_id", "layerId", "name", "title"],
    `Layer ${index + 1}`
  );
}

function layerSourceUrlFromPayload(value: unknown) {
  if (!isRecord(value)) return "";

  for (const key of ["source_url", "sourceUrl", "url", "href", "tile_url", "tileUrl", "path", "uri"]) {
    const item = value[key];

    if (typeof item === "string" && item.trim()) {
      return item;
    }
  }

  const source = value.source;

  if (typeof source === "string" && source.trim()) {
    return source;
  }

  if (isRecord(source)) {
    for (const key of ["url", "href", "source_url", "sourceUrl", "tile_url", "tileUrl", "path", "uri"]) {
      const item = source[key];

      if (typeof item === "string" && item.trim()) {
        return item;
      }
    }
  }

  return "";
}

function LayerActionButtons({
  layerId,
  sourceUrl
}: {
  layerId: string;
  sourceUrl: string;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const normalizedSourceUrl = normalizeFileActionUrl(sourceUrl);

  async function handleCopyId() {
    const ok = await copyTextToClipboard(layerId);

    if (!ok) return;

    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1200);
  }

  async function handleCopyUrl() {
    if (!normalizedSourceUrl) return;

    const ok = await copyTextToClipboard(normalizedSourceUrl);

    if (!ok) return;

    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1200);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <button
        onClick={handleCopyId}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50"
        title="Copy layer id/name"
      >
        <Copy size={12} />
        {copiedId ? "Copied" : "Copy ID"}
      </button>

      {normalizedSourceUrl ? (
        <>
          <a
            href={normalizedSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 text-[10px] font-extrabold text-blue-700 transition hover:bg-blue-100"
            title="Open layer source in a new tab"
          >
            <ExternalLink size={12} />
            Open source
          </a>

          <button
            onClick={handleCopyUrl}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50"
            title="Copy layer source URL"
          >
            <Copy size={12} />
            {copiedUrl ? "Copied" : "Copy URL"}
          </button>
        </>
      ) : (
        <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-2 text-[10px] font-extrabold text-slate-500">
          No source URL
        </span>
      )}
    </div>
  );
}

function DetailMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "info"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-50 text-slate-700";

  return (
    <div className={cx("rounded-xl p-3", toneClass)}>
      <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-extrabold">
        {value}
      </div>
    </div>
  );
}

function EmptyTabPayload({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
      <div className="text-sm font-extrabold text-slate-800">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{message}</div>
    </div>
  );
}

function RawPayloadBlock({
  title,
  value,
  defaultOpen = false
}: {
  title: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const itemCount = countItems(value);

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Raw payload
            </div>
            <div className="mt-0.5 truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
            {itemCount} items
          </span>

          <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-extrabold text-slate-600">
            {open ? "Hide raw" : "Show raw"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-3">
          <JsonViewer title={title} value={value} />
        </div>
      )}
    </div>
  );
}

function findDeepValue(payload: unknown, keys: string[]) {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 500) {
    scanned += 1;
    const value = queue.shift();

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    if (!isRecord(value)) continue;

    if (visited.has(value)) continue;
    visited.add(value);

    for (const key of keys) {
      if (key in value) {
        const item = value[key];

        if (item !== undefined && item !== null) {
          return item;
        }
      }
    }

    for (const item of Object.values(value)) {
      if (item && typeof item === "object") {
        queue.push(item);
      }
    }
  }

  return undefined;
}

function formatOverviewValue(value: unknown, fallback = "—"): string {
  if (value === undefined || value === null) return fallback;

  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";

  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fallback;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return fallback;
    return value.map((item) => formatOverviewValue(item, "")).filter(Boolean).join(", ");
  }

  if (isRecord(value)) {
    const label = readString(
      value,
      ["name", "title", "id", "label", "value", "status", "mode", "service"],
      ""
    );

    if (label) return label;

    return `${Object.keys(value).length} keys`;
  }

  return String(value);
}

function valueToList(value: unknown): string[] {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => formatOverviewValue(item, ""))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const formatted = formatOverviewValue(value, "");

  return formatted ? [formatted] : [];
}

function ResponseInfoRow({
  label,
  value,
  mono = false,
  copyValue,
  copyLabel = "Copy"
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  copyValue?: unknown;
  copyLabel?: string;
}) {
  const displayValue = formatOverviewValue(value);
  const canCopy = copyValue !== undefined && stringifyClipboardValue(copyValue).trim().length > 0;

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </div>

        {canCopy && (
          <CopyValueButton
            value={copyValue}
            label={copyLabel}
            copiedLabel="Copied"
            compact
            title={`Copy ${label}`}
          />
        )}
      </div>

      <div
        className={cx(
          "break-words text-xs font-bold text-slate-700",
          mono ? "font-mono" : ""
        )}
      >
        {displayValue}
      </div>
    </div>
  );
}

function ResponseChipList({
  label,
  items,
  emptyText = "Not provided"
}: {
  label: string;
  items: string[];
  emptyText?: string;
}) {
  const copyValue = items.join("\n");

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </div>

        {items.length > 0 && (
          <CopyValueButton
            value={copyValue}
            label="Copy all"
            copiedLabel="Copied"
            compact
            title={`Copy ${label}`}
          />
        )}
      </div>

      {items.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {items.slice(0, 10).map((item) => (
            <span
              key={item}
              className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600"
              title={item}
            >
              {item}
            </span>
          ))}

          {items.length > 10 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
              +{items.length - 10} more
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs font-bold text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

function ResponseOverview({
  details,
  status
}: {
  details: RequestDetailsState;
  status: ReturnType<typeof getStatus>;
}) {
  const responsePayload = details.rawRequest;
  const normalizedResponsePayload = getResponsePayload(details) || (isRecord(responsePayload) ? responsePayload : null);
  const metadata = getMetadata(normalizedResponsePayload);
  const keys = payloadKeys(responsePayload);
  const searchRoot = responsePayload ?? normalizedResponsePayload;

  const queryValue = findDeepValue(searchRoot, [
    "query",
    "user_query",
    "userQuery",
    "natural_language_query",
    "naturalLanguageQuery",
    "prompt",
    "input"
  ]);

  const projectValue = findDeepValue(searchRoot, [
    "project_name",
    "projectName",
    "project_id",
    "projectId",
    "workspace",
    "workspace_id",
    "workspaceId"
  ]);

  const dataSourceValue = findDeepValue(searchRoot, [
    "data_source_ids",
    "dataSourceIds",
    "datasource_ids",
    "dataset_ids",
    "datasetIds",
    "source_ids",
    "sourceIds",
    "selected_data_sources",
    "selectedDataSources"
  ]);

  const timingValue = findDeepValue(searchRoot, [
    "execution_time",
    "executionTime",
    "duration_ms",
    "durationMs",
    "elapsed_ms",
    "elapsedMs",
    "processing_time",
    "processingTime",
    "runtime_ms",
    "runtimeMs"
  ]);

  const requestModeValue =
    readString(metadata || {}, [
      "frontend_preferred_execution_mode",
      "frontendPreferredExecutionMode",
      "execution_mode",
      "executionMode",
      "mode"
    ]) ||
    formatOverviewValue(
      findDeepValue(searchRoot, [
        "execution_mode",
        "executionMode",
        "preferred_execution_mode",
        "preferredExecutionMode",
        "mode"
      ]),
      ""
    );

  const serviceValue =
    readString(metadata || {}, ["service", "backend_service", "backendService"]) ||
    formatOverviewValue(
      findDeepValue(searchRoot, [
        "service",
        "backend_service",
        "backendService",
        "planner_service",
        "plannerService"
      ]),
      ""
    );

  const intentValue =
    readString(metadata || {}, ["frontend_inferred_intent", "frontendInferredIntent"]) ||
    formatOverviewValue(
      findDeepValue(searchRoot, ["intent", "inferred_intent", "inferredIntent"]),
      ""
    );

  const llmPlanningEnabled = readBooleanFlag(metadata, [
    "llm_planning_enabled",
    "llmPlanningEnabled"
  ]);

  const querySpecPlanningEnabled = readBooleanFlag(metadata, [
    "query_spec_planning_enabled",
    "querySpecPlanningEnabled"
  ]);

  const dataSourceItems = valueToList(dataSourceValue);

  const statusMetricTone =
    status.tone === "success"
      ? "success"
      : status.tone === "warning" || status.tone === "error"
        ? "warning"
        : "neutral";

  return (
    <div className="space-y-3">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Backend response overview
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Inspect request context, backend metadata and the raw response payload.
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold",
              status.tone === "error"
                ? "bg-red-50 text-red-700"
                : status.tone === "warning"
                  ? "bg-amber-50 text-amber-700"
                  : status.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
            )}
          >
            {status.tone === "empty" ? "No response" : status.tone}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <DetailMetric label="Request ID" value={details.requestId || "—"} tone="info" />
          <DetailMetric label="Status" value={status.label} tone={statusMetricTone} />
          <DetailMetric label="Top-level keys" value={keys.length} />
          <DetailMetric
            label="Payload size"
            value={countItems(responsePayload)}
            tone={countItems(responsePayload) > 0 ? "success" : "neutral"}
          />
        </div>

        {keys.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Top-level response keys
            </div>

            <div className="flex min-w-0 flex-wrap gap-1.5">
              {keys.slice(0, 12).map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600"
                >
                  {key}
                </span>
              ))}

              {keys.length > 12 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                  +{keys.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Quick copy/export
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Copy important request fields or export the raw response as a local JSON file.
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap gap-1.5">
          <CopyValueButton
            value={details.requestId}
            label="Copy Request ID"
            copiedLabel="Copied"
            title="Copy request ID"
          />

          <CopyValueButton
            value={queryValue}
            label="Copy Query"
            copiedLabel="Copied"
            title="Copy query"
          />

          <CopyValueButton
            value={dataSourceItems.join("\n")}
            label="Copy Data Sources"
            copiedLabel="Copied"
            title="Copy data source ids"
          />

          <CopyValueButton
            value={responsePayload}
            label="Copy Raw"
            copiedLabel="Copied"
            title="Copy raw response payload"
          />

          <DownloadJsonButton
            value={responsePayload}
            filename={`${safeDownloadName(details.requestId || "backend-response")}.json`}
            label="Export Raw JSON"
          />
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 text-sm font-extrabold text-slate-900">
          Request context
        </div>

        <div className="space-y-2">
          <ResponseInfoRow
            label="Query"
            value={queryValue}
            copyValue={queryValue}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="Project / workspace"
            value={projectValue}
            mono
            copyValue={projectValue}
            copyLabel="Copy"
          />
          <ResponseChipList
            label="Data sources"
            items={dataSourceItems}
            emptyText="No data source ids were found in this response payload."
          />
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 text-sm font-extrabold text-slate-900">
          Backend metadata
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <ResponseInfoRow
            label="Service"
            value={serviceValue}
            mono
            copyValue={serviceValue}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="Execution mode"
            value={requestModeValue}
            mono
            copyValue={requestModeValue}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="Timing"
            value={timingValue}
            mono
            copyValue={timingValue}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="Intent"
            value={intentValue}
            mono
            copyValue={intentValue}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="LLM planning"
            value={formatFlag(llmPlanningEnabled)}
            copyValue={formatFlag(llmPlanningEnabled)}
            copyLabel="Copy"
          />
          <ResponseInfoRow
            label="Query spec planning"
            value={formatFlag(querySpecPlanningEnabled)}
            copyValue={formatFlag(querySpecPlanningEnabled)}
            copyLabel="Copy"
          />
        </div>
      </div>

      <RawPayloadBlock title="Backend Raw Response" value={responsePayload} />
    </div>
  );
}

function findFirstCollectionByKeys(payload: unknown, keys: string[]) {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 400) {
    scanned += 1;
    const value = queue.shift();

    if (Array.isArray(value)) {
      if (value.length > 0) return value;
      continue;
    }

    if (!isRecord(value)) continue;

    if (visited.has(value)) continue;
    visited.add(value);

    for (const key of keys) {
      const item = value[key];

      if (Array.isArray(item)) return item;

      if (isRecord(item)) {
        const nested = nestedCollection(item, [
          "items",
          "data",
          "results",
          "records",
          "rows",
          "features"
        ]);

        if (nested.length) return nested;
      }
    }

    for (const item of Object.values(value)) {
      if (item && typeof item === "object") {
        queue.push(item);
      }
    }
  }

  return [];
}

function getRankingRows(payload: unknown) {
  const rankingRows = findFirstCollectionByKeys(payload, [
    "ranking_table",
    "rankingTable",
    "ranking_rows",
    "rankingRows",
    "rankings",
    "ranked_results",
    "rankedResults",
    "ranked_parcels",
    "rankedParcels",
    "scored_parcels",
    "scoredParcels",
    "suitability_results",
    "suitabilityResults",
    "candidates",
    "parcels",
    "sites",
    "results",
    "rows"
  ]);

  return rankingRows;
}

function readRowValue(row: unknown, keys: string[], fallback = "—") {
  if (!isRecord(row)) {
    if (row !== undefined && row !== null && String(row).trim()) {
      return String(row);
    }

    return fallback;
  }

  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return fallback;
}

function rankingRowId(row: unknown, index: number) {
  return readRowValue(
    row,
    [
      "parcel_id",
      "parcelId",
      "site_id",
      "siteId",
      "feature_id",
      "featureId",
      "candidate_id",
      "candidateId",
      "id",
      "name",
      "title"
    ],
    `Item ${index + 1}`
  );
}

function rankingRowScore(row: unknown) {
  return readRowValue(
    row,
    [
      "suitability_score",
      "suitabilityScore",
      "score",
      "total_score",
      "totalScore",
      "rank_score",
      "rankScore",
      "confidence",
      "value"
    ],
    "—"
  );
}

function rankingRowRecommendation(row: unknown) {
  return readRowValue(
    row,
    [
      "recommendation",
      "label",
      "status",
      "class",
      "category",
      "decision",
      "summary"
    ],
    "—"
  );
}

function rankingRowRank(row: unknown, index: number) {
  return readRowValue(row, ["rank", "ranking", "position", "order"], String(index + 1));
}

function getOutputTypeLabel(payload: unknown, rankingRows: unknown[]) {
  const keys = payloadKeys(payload).map((key) => key.toLowerCase());

  if (rankingRows.length > 0) return "Ranking/scoring";
  if (keys.some((key) => key.includes("report"))) return "Report outputs";
  if (keys.some((key) => key.includes("layer") || key.includes("geojson"))) return "Map/layer outputs";
  if (keys.some((key) => key.includes("file") || key.includes("document"))) return "File outputs";
  if (countItems(payload) > 0) return "Structured outputs";

  return "No outputs";
}

function getOutputBadgeClass(typeLabel: string) {
  if (typeLabel === "Ranking/scoring") return "bg-emerald-50 text-emerald-700";
  if (typeLabel === "Report outputs") return "bg-purple-50 text-purple-700";
  if (typeLabel === "Map/layer outputs") return "bg-blue-50 text-blue-700";
  if (typeLabel === "File outputs") return "bg-amber-50 text-amber-700";
  if (typeLabel === "Structured outputs") return "bg-slate-100 text-slate-600";

  return "bg-slate-100 text-slate-500";
}

function RankingPreviewTable({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) {
    return (
      <EmptyTabPayload
        title="No ranking rows detected"
        message="No ranking/scoring table was detected in this outputs payload. Inspect the raw JSON below for backend-specific fields."
      />
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-xs font-extrabold text-slate-800">
          Ranking preview
        </div>

        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
          {rows.length} rows
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-[11px]">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-extrabold">Rank</th>
              <th className="px-3 py-2 font-extrabold">Item</th>
              <th className="px-3 py-2 font-extrabold">Score</th>
              <th className="px-3 py-2 font-extrabold">Recommendation</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 8).map((row, index) => {
              const score = rankingRowScore(row);
              const recommendation = rankingRowRecommendation(row);

              return (
                <tr key={index} className="bg-white">
                  <td className="px-3 py-2 font-mono font-extrabold text-slate-700">
                    {rankingRowRank(row, index)}
                  </td>

                  <td className="max-w-[130px] truncate px-3 py-2 font-extrabold text-slate-800">
                    {rankingRowId(row, index)}
                  </td>

                  <td className="px-3 py-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono font-extrabold text-blue-700">
                      {score}
                    </span>
                  </td>

                  <td className="max-w-[150px] truncate px-3 py-2">
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 font-extrabold",
                        recommendation.toLowerCase().includes("excellent") ||
                          recommendation.toLowerCase().includes("good") ||
                          recommendation.toLowerCase().includes("suitable")
                          ? "bg-emerald-50 text-emerald-700"
                          : recommendation === "—"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-amber-50 text-amber-700"
                      )}
                      title={recommendation}
                    >
                      {recommendation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 8 && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-bold text-slate-500">
          Showing 8 of {rows.length} ranking rows. Inspect the raw payload below for the complete table.
        </div>
      )}
    </div>
  );
}

function OutputPreviewList({ items }: { items: unknown[] }) {
  if (items.length === 0) {
    return (
      <EmptyTabPayload
        title="No previewable output rows"
        message="The backend payload may still contain structured outputs below in the raw JSON section."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, index) => (
        <div key={index} className="rounded-xl bg-slate-50 p-2">
          <div className="truncate text-xs font-extrabold text-slate-800">
            {readNestedString(
              item,
              ["name", "title", "id", "parcel_id", "parcelId", "site_id", "siteId"],
              `Output item ${index + 1}`
            )}
          </div>

          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
            {readNestedString(
              item,
              ["summary", "description", "recommendation", "message", "score"],
              "Structured output item"
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OutputsOverview({ payload }: { payload: unknown }) {
  const keys = payloadKeys(payload);
  const outputEntries = countItems(payload);
  const rankingRows = getRankingRows(payload);
  const outputTypeLabel = getOutputTypeLabel(payload, rankingRows);

  const fileRefs = countCollectionByKeys(payload, [
    "files",
    "output_files",
    "outputFiles",
    "documents",
    "reports"
  ]);

  const layerRefs = countCollectionByKeys(payload, [
    "layers",
    "map_layers",
    "mapLayers",
    "geojson",
    "features"
  ]);

  const previewItems = rankingRows.length > 0
    ? []
    : nestedCollection(payload, [
        "items",
        "data",
        "results",
        "outputs",
        "records",
        "rows"
      ]).slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Outputs overview
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Inspect structured backend outputs, ranking/scoring tables and related output references.
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold",
              getOutputBadgeClass(outputTypeLabel)
            )}
          >
            {outputTypeLabel}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <DetailMetric label="Output entries" value={outputEntries} tone={outputEntries > 0 ? "success" : "neutral"} />
          <DetailMetric label="Ranking rows" value={rankingRows.length} tone={rankingRows.length > 0 ? "success" : "neutral"} />
          <DetailMetric label="File refs" value={fileRefs} tone={fileRefs > 0 ? "info" : "neutral"} />
          <DetailMetric label="Layer refs" value={layerRefs} tone={layerRefs > 0 ? "info" : "neutral"} />
        </div>

        {keys.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Top-level output keys
            </div>

            <div className="flex min-w-0 flex-wrap gap-1.5">
              {keys.slice(0, 12).map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600"
                >
                  {key}
                </span>
              ))}

              {keys.length > 12 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                  +{keys.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {rankingRows.length > 0 ? (
        <RankingPreviewTable rows={rankingRows} />
      ) : (
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Output preview
          </div>

          <OutputPreviewList items={previewItems} />
        </div>
      )}

      <RawPayloadBlock title="Backend Outputs" value={payload ?? {}} />
    </div>
  );
}

function LayersOverview({ payload }: { payload: unknown }) {
  const layers = nestedCollection(payload, ["layers", "map_layers", "mapLayers", "items", "data", "results", "features"]);
  const geoJsonCount = layers.filter(hasGeoJsonLikePayload).length;
  const remoteCount = layers.filter(hasRemoteLayerSource).length;
  const noGeometryCount = Math.max(layers.length - geoJsonCount - remoteCount, 0);
  const actionableSourceCount = layers.filter((layer) => Boolean(layerSourceUrlFromPayload(layer))).length;

  return (
    <div className="space-y-3">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Map layers overview
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Inspect generated/requested layers, copy layer identifiers and open backend-provided source links.
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold",
              actionableSourceCount > 0
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {actionableSourceCount} source links
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <DetailMetric label="Total layers" value={layers.length || countItems(payload)} tone={layers.length > 0 ? "success" : "neutral"} />
          <DetailMetric label="GeoJSON-like" value={geoJsonCount} tone={geoJsonCount > 0 ? "success" : "neutral"} />
          <DetailMetric label="Remote/source" value={remoteCount} tone={remoteCount > 0 ? "info" : "neutral"} />
          <DetailMetric label="No geometry" value={noGeometryCount} tone={noGeometryCount > 0 ? "warning" : "neutral"} />
        </div>

        {layers.length > 0 ? (
          <div className="mt-3 space-y-2">
            {layers.slice(0, 6).map((layer, index) => {
              const layerId = layerIdFromPayload(layer, index);
              const sourceUrl = layerSourceUrlFromPayload(layer);
              const normalizedSourceUrl = normalizeFileActionUrl(sourceUrl);

              return (
                <div key={index} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-slate-800">
                        {layerNameFromPayload(layer, index)}
                      </div>
                      <div className="mt-1 truncate text-[11px] font-bold text-slate-500">
                        {layerTypeFromPayload(layer)}
                      </div>
                    </div>

                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                        hasGeoJsonLikePayload(layer)
                          ? "bg-emerald-50 text-emerald-700"
                          : hasRemoteLayerSource(layer)
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {hasGeoJsonLikePayload(layer)
                        ? "GeoJSON"
                        : hasRemoteLayerSource(layer)
                          ? "Remote"
                          : "No geometry"}
                    </span>
                  </div>

                  <div className="mt-2 rounded-lg bg-white/70 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="shrink-0 font-extrabold uppercase tracking-wide text-slate-400">
                        Layer ID
                      </span>
                      <span className="min-w-0 truncate font-mono font-bold text-slate-600">
                        {layerId}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="shrink-0 font-extrabold uppercase tracking-wide text-slate-400">
                        Source
                      </span>
                      <span className="min-w-0 truncate font-bold text-slate-500">
                        {sourceUrl || "No URL/path exposed"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                    <div className="min-w-0 truncate text-[10px] font-bold text-slate-400">
                      {normalizedSourceUrl ? "Backend layer source available" : "Layer metadata only"}
                    </div>

                    <LayerActionButtons layerId={layerId} sourceUrl={sourceUrl} />
                  </div>
                </div>
              );
            })}

            {layers.length > 6 && (
              <div className="rounded-xl bg-slate-50 p-2 text-center text-[11px] font-bold text-slate-500">
                Showing 6 of {layers.length} layers. Inspect the raw payload below for the complete list.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyTabPayload
              title="No layer list detected"
              message="No previewable layer array was detected. Inspect the raw map layer payload below."
            />
          </div>
        )}
      </div>

      <RawPayloadBlock title="Backend Map Layers" value={payload ?? []} />
    </div>
  );
}

function FilesOverview({ payload }: { payload: unknown }) {
  const files = nestedCollection(payload, ["files", "output_files", "outputFiles", "documents", "reports", "items", "data", "results"]);
  const reportCount = files.filter((file) => classifyFile(file) === "Report/document").length;
  const tableCount = files.filter((file) => classifyFile(file) === "Table").length;
  const vectorCount = files.filter((file) => classifyFile(file) === "Vector/GeoJSON").length;
  const actionableCount = files.filter((file) => Boolean(fileActionUrlFromPayload(file))).length;

  return (
    <div className="space-y-3">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Files overview
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Open, download or copy backend-provided file links when URLs are available.
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold",
              actionableCount > 0
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {actionableCount} actionable
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <DetailMetric label="Total files" value={files.length || countItems(payload)} tone={files.length > 0 ? "success" : "neutral"} />
          <DetailMetric label="Reports/docs" value={reportCount} tone={reportCount > 0 ? "info" : "neutral"} />
          <DetailMetric label="Tables" value={tableCount} tone={tableCount > 0 ? "info" : "neutral"} />
          <DetailMetric label="Vector/GeoJSON" value={vectorCount} tone={vectorCount > 0 ? "info" : "neutral"} />
        </div>

        {files.length > 0 ? (
          <div className="mt-3 space-y-2">
            {files.slice(0, 8).map((file, index) => {
              const kind = classifyFile(file);
              const rawUrl = fileUrlFromPayload(file);
              const actionUrl = normalizeFileActionUrl(rawUrl);
              const filename = fileNameFromPayload(file, index);

              return (
                <div key={index} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-slate-800">
                        {filename}
                      </div>
                      <div className="mt-1 truncate text-[11px] font-bold text-slate-500">
                        {rawUrl || "No URL/path exposed in this list record"}
                      </div>
                    </div>

                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                        kind === "Report/document"
                          ? "bg-purple-50 text-purple-700"
                          : kind === "Table"
                            ? "bg-blue-50 text-blue-700"
                            : kind === "Vector/GeoJSON"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {kind}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                    <div className="min-w-0 truncate text-[10px] font-bold text-slate-400">
                      {actionUrl ? "Backend file link available" : "No file action URL"}
                    </div>

                    <FileActionButtons url={actionUrl} filename={filename} />
                  </div>
                </div>
              );
            })}

            {files.length > 8 && (
              <div className="rounded-xl bg-slate-50 p-2 text-center text-[11px] font-bold text-slate-500">
                Showing 8 of {files.length} files. Inspect the raw payload below for the complete list.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyTabPayload
              title="No file list detected"
              message="No previewable files array was detected. Inspect the raw files payload below."
            />
          </div>
        )}
      </div>

      <RawPayloadBlock title="Backend Files" value={payload ?? []} />
    </div>
  );
}

export function RequestDetailsPanel({
 details }: RequestDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("response");

  const status = useMemo(() => getStatus(details), [details]);
  const diagnostics = useMemo(() => getDiagnostics(details), [details]);
  const statusTone = status.tone;
  const statusIsError = statusTone === "error";
  const statusIsWarning =
    statusTone === "warning" ||
    diagnostics.plannerUnavailable ||
    diagnostics.missingCapabilities.length > 0;
  const statusIsSuccess = statusTone === "success" && !statusIsWarning;

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: typeof FileJson;
    count: number;
  }> = [
    {
      key: "response",
      label: "Response",
      icon: Code2,
      count: details?.rawRequest ? 1 : 0
    },
    {
      key: "outputs",
      label: "Outputs",
      icon: Database,
      count: countItems(details?.rawOutputs)
    },
    {
      key: "mapLayers",
      label: "Layers",
      icon: Layers,
      count: countItems(details?.rawMapLayers)
    },
    {
      key: "files",
      label: "Files",
      icon: FileText,
      count: countItems(details?.rawFiles)
    }
  ];

  function renderActiveTab() {
    if (!details) {
      return (
        <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div className="max-w-sm px-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <FileJson size={22} />
            </div>
            <div className="text-sm font-extrabold text-slate-800">
              No request details loaded
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Run an analysis or open request outputs to inspect backend response data.
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "response") {
      return <ResponseOverview details={details} status={status} />;
    }

    if (activeTab === "outputs") {
      return <OutputsOverview payload={details.rawOutputs ?? {}} />;
    }

    if (activeTab === "mapLayers") {
      return <LayersOverview payload={details.rawMapLayers ?? []} />;
    }

    return <FilesOverview payload={details.rawFiles ?? []} />;
  }

  return (
    <div className="space-y-4">
      <div
        className={cx(
          "rounded-2xl border p-4",
          statusIsError
            ? "border-red-100 bg-red-50"
            : statusIsWarning
              ? "border-amber-100 bg-amber-50"
              : statusIsSuccess
                ? "border-emerald-100 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className={cx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
              statusIsError
                ? "bg-red-600"
                : statusIsWarning
                  ? "bg-amber-500"
                  : statusIsSuccess
                    ? "bg-emerald-600"
                    : "bg-slate-500"
            )}
          >
            {statusIsError || statusIsWarning ? (
              <AlertTriangle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
          </div>

          <div className="min-w-0">
            <div
              className={cx(
                "truncate text-sm font-extrabold",
                statusIsError
                  ? "text-red-950"
                  : statusIsWarning
                    ? "text-amber-950"
                    : statusIsSuccess
                      ? "text-emerald-950"
                      : "text-slate-900"
              )}
            >
              {status.label}
            </div>

            <div
              className={cx(
                "truncate text-xs font-bold",
                statusIsError
                  ? "text-red-700"
                  : statusIsWarning
                    ? "text-amber-700"
                    : statusIsSuccess
                      ? "text-emerald-700"
                      : "text-slate-600"
              )}
            >
              Request ID: {details?.requestId || "—"}
            </div>
          </div>
        </div>

        <div
          className={cx(
            "rounded-xl border bg-white/70 p-3 text-xs leading-5",
            statusIsError
              ? "border-red-100 text-red-800"
              : statusIsWarning
                ? "border-amber-100 text-amber-800"
                : statusIsSuccess
                  ? "border-emerald-100 text-emerald-800"
                  : "border-slate-200 text-slate-700"
          )}
        >
          {status.message}
        </div>
      </div>

      {details && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                AI Query Diagnostics
              </div>

              <div className="mt-1 text-sm font-extrabold text-slate-900">
                {diagnostics.missingCapabilities.length > 0
                  ? "Missing backend capabilities"
                  : diagnostics.plannerUnavailable
                    ? "Backend planner unavailable"
                    : statusIsWarning
                      ? "Backend request needs attention"
                      : statusIsError
                        ? "Backend request failed"
                        : "Backend request diagnostics"}
              </div>
            </div>

            <div
              className={cx(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                statusIsError
                  ? "bg-red-50 text-red-700"
                  : statusIsWarning
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
              )}
            >
              {statusIsError ? "Failed" : statusIsWarning ? "Needs attention" : "OK"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="font-extrabold text-slate-500">LLM planning</div>
              <div
                className={cx(
                  "mt-1 font-extrabold",
                  diagnostics.llmPlanningEnabled === false
                    ? "text-amber-700"
                    : diagnostics.llmPlanningEnabled === true
                      ? "text-emerald-700"
                      : "text-slate-700"
                )}
              >
                {formatFlag(diagnostics.llmPlanningEnabled)}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-2">
              <div className="font-extrabold text-slate-500">Query spec planning</div>
              <div
                className={cx(
                  "mt-1 font-extrabold",
                  diagnostics.querySpecPlanningEnabled === false
                    ? "text-amber-700"
                    : diagnostics.querySpecPlanningEnabled === true
                      ? "text-emerald-700"
                      : "text-slate-700"
                )}
              >
                {formatFlag(diagnostics.querySpecPlanningEnabled)}
              </div>
            </div>

            {diagnostics.inferredIntent && (
              <div className="rounded-xl bg-blue-50 p-2">
                <div className="font-extrabold text-blue-500">Frontend intent</div>
                <div className="mt-1 break-words font-mono text-[11px] font-bold text-blue-800">
                  {diagnostics.inferredIntent}
                </div>
              </div>
            )}

            {diagnostics.preferredExecutionMode && (
              <div className="rounded-xl bg-blue-50 p-2">
                <div className="font-extrabold text-blue-500">Preferred execution</div>
                <div className="mt-1 break-words font-mono text-[11px] font-bold text-blue-800">
                  {diagnostics.preferredExecutionMode}
                </div>
              </div>
            )}

            {diagnostics.service && (
              <div className="rounded-xl bg-slate-50 p-2">
                <div className="font-extrabold text-slate-500">Service</div>
                <div className="mt-1 break-words font-mono text-[11px] font-bold text-slate-700">
                  {diagnostics.service}
                </div>
              </div>
            )}
          </div>

          {diagnostics.missingCapabilities.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-amber-700">
                <AlertTriangle size={14} />
                Missing capabilities
              </div>

              <div className="flex min-w-0 flex-wrap gap-1.5">
                {diagnostics.missingCapabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-amber-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700"
                    title={capability}
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          )}

          {diagnostics.diagnosticMessages.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-2">
              <div className="mb-1 text-xs font-extrabold text-amber-700">
                Diagnostic messages
              </div>

              <div className="max-h-24 space-y-1 overflow-auto pr-1">
                {diagnostics.diagnosticMessages.slice(0, 4).map((item) => (
                  <div
                    key={item}
                    className="break-words text-[11px] font-semibold leading-4 text-amber-900"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {diagnostics.suggestedQuery && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-2">
              <div className="mb-1 text-xs font-extrabold text-blue-700">
                Suggested simplified query
              </div>

              <div className="max-h-24 overflow-auto break-words text-[11px] font-semibold leading-4 text-blue-900">
                {diagnostics.suggestedQuery}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-4 gap-2 border-b border-slate-200 p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cx(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-extrabold transition",
                  active
                    ? "border-blue-100 bg-blue-50 text-blue-700"
                    : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-white"
                )}
              >
                <Icon size={15} />
                <span className="truncate">{tab.label}</span>
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-[9px]",
                    active
                      ? "bg-white text-blue-700"
                      : "bg-white text-slate-500"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[calc(100vh-310px)] overflow-y-auto p-3">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
