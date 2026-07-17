import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileSearch,
  Layers,
  Map,
  ShieldCheck
} from "lucide-react";

import type { LayerItem } from "../../data/mockSpatialData";
import type { AnalysisStatus, AnalysisSummaryState } from "../../types/ui";
import { cx } from "../../utils/cx";
import { extractGeoJson as extractGeoJsonForPanel } from "../../utils/geojson";
import { CapabilityDiagnostics } from "./CapabilityDiagnostics";
import {
  RequestDetailsPanel,
  type RequestDetailsState
} from "./RequestDetailsPanel";

type RightPanelTab = "analysis" | "request-details";

type RightPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  layers: LayerItem[];
  onToggleLayer: (layerId: string) => void;
  onShowAllLayers?: () => void;
  onHideAllLayers?: () => void;
  summary: AnalysisSummaryState;
  analysisStatus?: AnalysisStatus;
  apiHealthText: string;
  hasRequestDetails?: boolean;
  onOpenRequestDetails?: () => void;
  missingCapabilities?: string[];
  backendFailureMessage?: string;
  suggestedQuery?: string;
  onRunSimplifiedQuery?: () => void;
  activeTab?: RightPanelTab;
  onTabChange?: (tab: RightPanelTab) => void;
  requestDetails?: RequestDetailsState | null;
};

function layerTypeLabel(type: LayerItem["type"]) {
  if (type === "analysis") return "Analysis";
  if (type === "boundary") return "Boundary";
  if (type === "raster") return "Raster";
  return "Vector";
}

function layerTypeClass(type: LayerItem["type"]) {
  if (type === "analysis") return "bg-emerald-50 text-emerald-700";
  if (type === "boundary") return "bg-purple-50 text-purple-700";
  if (type === "raster") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function looksLikeRealRequestId(requestId: string) {
  const value = String(requestId || "").trim();

  if (!value) return false;

  const normalized = value.toLowerCase();

  return ![
    "running...",
    "previewing...",
    "api-request-failed",
    "response-processing-failed",
    "preview-local-fallback",
    "preview-response",
    "—"
  ].includes(normalized) &&
    !normalized.startsWith("preview-") &&
    !normalized.includes("failed");
}

function getPanelLayerDiagnostic(layer: LayerItem) {
  if (extractGeoJsonForPanel(layer.geojson)) {
    return {
      label: "GeoJSON",
      className: "bg-emerald-50 text-emerald-700"
    };
  }

  if (layer.sourceUrl) {
    return {
      label: "Remote",
      className: "bg-amber-50 text-amber-700"
    };
  }

  return {
    label: "No geometry",
    className: "bg-slate-100 text-slate-500"
  };
}

function isFailureScanRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFailureScanText(
  record: Record<string, unknown>,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return fallback;
}

function getRequestDetailsFailureMessage(payload: unknown): string {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 500) {
    scanned += 1;

    const value = queue.shift();

    if (!isFailureScanRecord(value)) {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }

    visited.add(value);

    const status = readFailureScanText(
      value,
      [
        "status",
        "state",
        "outcome",
        "result_status",
        "execution_status",
        "analysis_status",
        "request_status"
      ]
    ).toLowerCase();

    const failedByStatus =
      status.includes("failed") ||
      status.includes("failure") ||
      status.includes("error") ||
      status.includes("errored") ||
      status.includes("exception") ||
      status.includes("timeout") ||
      status.includes("aborted") ||
      status.includes("cancelled") ||
      status.includes("canceled") ||
      status.includes("rejected");

    const failedByBoolean =
      value.ok === false ||
      value.success === false ||
      value.failed === true ||
      value.failure === true ||
      value.has_error === true ||
      value.hasError === true;

    const errorsValue = value.errors;
    const hasErrorsArray = Array.isArray(errorsValue) && errorsValue.length > 0;

    const metadata = value.metadata;
    const structuredError = value.structured_error || value.structuredError;
    const metadataStructuredError =
      isFailureScanRecord(metadata)
        ? metadata.structured_error ||
          metadata.structuredError ||
          metadata.service_structured_error ||
          metadata.serviceStructuredError
        : undefined;

    if (failedByStatus || failedByBoolean || hasErrorsArray || structuredError || metadataStructuredError) {
      const firstErrorMessage =
        Array.isArray(errorsValue)
          ? errorsValue
              .map((item) => {
                if (typeof item === "string") return item;

                if (isFailureScanRecord(item)) {
                  return readFailureScanText(
                    item,
                    ["message", "error", "detail", "reason", "description"]
                  );
                }

                return "";
              })
              .find((item) => item.trim()) || ""
          : "";

      const directMessage = readFailureScanText(
        value,
        [
          "message",
          "summary",
          "answer",
          "error_message",
          "failure_message",
          "detail",
          "description"
        ]
      );

      return firstErrorMessage || directMessage || "Backend analysis failed.";
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        queue.push(nestedValue);
      }
    }
  }

  return "";
}

function isSoftUnavailableMessage(message: string) {
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
    normalized.includes("disabled")
  );
}

export function RightPanel({
  collapsed,
  onToggle,
  layers,
  onToggleLayer,
  onShowAllLayers,
  onHideAllLayers,
  summary,
  analysisStatus = "idle",
  apiHealthText,
  hasRequestDetails = false,
  onOpenRequestDetails,
  missingCapabilities = [],
  backendFailureMessage,
  suggestedQuery,
  onRunSimplifiedQuery,
  activeTab = "analysis",
  onTabChange,
  requestDetails
}: RightPanelProps) {
  const visibleLayers = layers.filter((layer) => layer.visible).length;
  const geoJsonLayers = layers.filter((layer) => Boolean(extractGeoJsonForPanel(layer.geojson))).length;
  const hasRealRequest = looksLikeRealRequestId(summary.requestId || "");
  const requestDetailsFailureMessage = getRequestDetailsFailureMessage(requestDetails);
  const effectiveBackendFailureMessage: string =
    backendFailureMessage || requestDetailsFailureMessage;
  const effectiveSummaryText: string =
    effectiveBackendFailureMessage || summary.text;
  const hasBackendIssue = Boolean(effectiveBackendFailureMessage);
  const hasSoftUnavailableIssue =
    hasBackendIssue && isSoftUnavailableMessage(effectiveBackendFailureMessage);
  const hasHardBackendFailure = hasBackendIssue && !hasSoftUnavailableIssue;
  const isRunning = analysisStatus === "running";
  const isWarning = hasSoftUnavailableIssue;
  const isError = !isWarning && (hasHardBackendFailure || analysisStatus === "error");
  const isSuccess = !isError && !isWarning && analysisStatus === "success";
  const isIdle = analysisStatus === "idle";

  const statusLabel = isRunning
    ? "Running"
    : isError
      ? "Failed"
      : isWarning
        ? "Limited"
        : isSuccess
          ? "Completed"
          : apiHealthText;

  const statusBadgeClass = isRunning
    ? "bg-blue-50 text-blue-700"
    : isError
      ? "bg-red-50 text-red-700"
      : isWarning
        ? "bg-amber-50 text-amber-700"
        : isSuccess
          ? "bg-emerald-50 text-emerald-700"
          : apiHealthText.toLowerCase() === "online"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700";

  const summaryCardClass = isRunning
    ? "border-blue-100 bg-blue-50/50"
    : isError
      ? "border-red-100 bg-red-50"
      : isWarning
        ? "border-amber-100 bg-amber-50"
        : isSuccess
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-slate-200 bg-slate-50";

  const summaryIconClass = isError
    ? "bg-red-600 text-white"
    : isWarning
      ? "bg-amber-500 text-white"
      : isRunning
        ? "bg-blue-600 text-white"
        : isSuccess
          ? "bg-emerald-600 text-white"
          : "bg-blue-600 text-white";

  const summarySubtitle = isRunning
    ? "Backend request is running"
    : isError
      ? "Backend returned a failed response"
      : isWarning
        ? "Backend returned a limited/unavailable planning response"
        : hasRealRequest
          ? "Latest backend request"
          : "Default workspace state";

  const summaryTag = isRunning
    ? "RUNNING"
    : isError
      ? "ERROR"
      : isWarning
        ? "LIMITED"
        : hasRealRequest
          ? "REAL"
          : "";

  const summaryText =
    effectiveSummaryText ||
    (isRunning
      ? "Running backend spatial analysis..."
      : "No analysis summary is available yet.");

  const noLayerTitle = isRunning
    ? "Waiting for map layers"
    : isError
      ? "No renderable map layers"
      : isWarning
        ? "No map layers returned"
        : "No layers";

  const noLayerDescription = isRunning
    ? "Map layers will appear here when the backend returns them."
    : isError
      ? "Backend did not return renderable map layers for this failed request."
      : isWarning
        ? "This request did not return map layers because planning/capability support is unavailable or limited."
        : isIdle
          ? "Run an analysis to generate map layers."
          : "Backend did not return map layers for this request.";

  const rightTabs: Array<{
    key: RightPanelTab;
    label: string;
    description: string;
    disabled?: boolean;
  }> = [
    {
      key: "analysis",
      label: "Analysis Result",
      description: "Summary and outputs"
    },
    {
      key: "request-details",
      label: "Request Details",
      description: "Raw backend data",
      disabled: !hasRequestDetails
    }
  ];

  return (
    <aside
      className={cx(
        "relative shrink-0 border-l border-slate-200 bg-white transition-all duration-300",
        collapsed ? "w-[48px]" : "w-[340px]"
      )}
    >
      <button
        onClick={onToggle}
        className="absolute -left-4 top-4 z-[50] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg hover:bg-slate-50"
        title={collapsed ? "Show right panel" : "Hide right panel"}
      >
        {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {collapsed ? (
        <div className="flex h-full flex-col items-center gap-3 pt-16">
          <button
            onClick={() => onTabChange?.("analysis")}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-xl transition",
              activeTab === "analysis"
                ? isError
                  ? "bg-red-50 text-red-700"
                  : isWarning
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
            title="Analysis Result"
          >
            {isError ? <AlertTriangle size={18} /> : <Layers size={18} />}
          </button>

          <button
            onClick={() => onTabChange?.("request-details")}
            disabled={!hasRequestDetails}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-35",
              activeTab === "request-details"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
            title="Request Details"
          >
            <FileSearch size={17} />
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {activeTab === "request-details" ? "Request Details" : "Analysis Result"}
              </div>
              <div className="text-xs text-slate-500">
                {activeTab === "request-details"
                  ? "Raw backend response and outputs"
                  : "Summary, diagnostics and map layers"}
              </div>
            </div>

            <div
              className={cx(
                "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                statusBadgeClass
              )}
            >
              {statusLabel}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/70 p-3">
            {rightTabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange?.(tab.key)}
                  disabled={tab.disabled}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                    active
                      ? "border-blue-100 bg-white text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white/70 text-slate-500 hover:bg-white"
                  )}
                >
                  <div className="truncate text-[11px] font-extrabold">
                    {tab.label}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-bold opacity-70">
                    {tab.description}
                  </div>
                </button>
              );
            })}
          </div>

          {activeTab === "request-details" ? (
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              <RequestDetailsPanel details={requestDetails || null} />
            </div>
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div
              className={cx(
                "mb-4 rounded-2xl border p-4",
                summaryCardClass
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className={cx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                      summaryIconClass
                    )}
                  >
                    {isError || isWarning ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <FileSearch size={17} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">
                      Analysis Summary
                    </div>
                    <div className="truncate text-xs text-slate-500">
{summarySubtitle}
                    </div>
                  </div>
                </div>

                {summaryTag && (
                  <span
                    className={cx(
                      "shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold",
                      isError
                        ? "bg-red-100 text-red-700"
                        : isWarning
                          ? "bg-amber-100 text-amber-700"
                          : isRunning
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {summaryTag}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 font-bold text-slate-500">
                    Request ID
                  </span>
                  <span className="min-w-0 truncate text-right font-extrabold text-slate-800">
                    {summary.requestId || "—"}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="font-bold text-slate-500">Confidence</span>
                  <span className="font-extrabold text-slate-800">
                    {summary.confidence || "—"}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="font-bold text-slate-500">Execution</span>
                  <span className="font-extrabold text-slate-800">
                    {summary.executionTime || "—"}
                  </span>
                </div>
              </div>

              <div
                className={cx(
                  "mt-3 rounded-xl border p-3 text-xs leading-5",
                  isError
                    ? "border-red-100 bg-white text-red-700"
                    : isWarning
                      ? "border-amber-100 bg-white text-amber-800"
                      : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {summaryText}
              </div>

              {hasRequestDetails && (
                <button
                  onClick={() => {
                    if (onTabChange) {
                      onTabChange("request-details");
                    } else {
                      onOpenRequestDetails?.();
                    }
                  }}
                  className={cx(
                    "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold text-white shadow-sm",
                    isError
                      ? "bg-red-600 hover:bg-red-700"
                      : isWarning
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-slate-900 hover:bg-slate-800"
                  )}
                >
                  <FileSearch size={15} />
                  View Request Details
                </button>
              )}
            </div>

            <CapabilityDiagnostics
              missingCapabilities={missingCapabilities}
              backendFailureMessage={effectiveBackendFailureMessage}
              suggestedQuery={suggestedQuery}
              onRunSimplifiedQuery={onRunSimplifiedQuery}
            />

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Layers size={16} />
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {layers.length}
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  Layers
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Eye size={16} />
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {visibleLayers}
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  Visible
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Map size={16} />
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {geoJsonLayers}
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  GeoJSON
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Layers size={17} />
                    Map Layers
                  </div>

                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                    {visibleLayers}/{layers.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onShowAllLayers}
                    disabled={!layers.length || visibleLayers === layers.length}
                    className="h-8 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Show all
                  </button>

                  <button
                    onClick={onHideAllLayers}
                    disabled={!layers.length || visibleLayers === 0}
                    className="h-8 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Hide all
                  </button>
                </div>
              </div>

              <div className="max-h-[310px] overflow-y-auto p-2">
                {layers.length ? (
                  layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="mb-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: layer.color }}
                            />
                            <span className="truncate text-xs font-extrabold text-slate-800">
                              {layer.name}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                                layerTypeClass(layer.type)
                              )}
                            >
                              {layerTypeLabel(layer.type)}
                            </span>

                            {(() => {
                              const diagnostic = getPanelLayerDiagnostic(layer);

                              return (
                                <span
                                  className={cx(
                                    "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                                    diagnostic.className
                                  )}
                                >
                                  {diagnostic.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <button
                          onClick={() => onToggleLayer(layer.id)}
                          className={cx(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-600",
                            layer.visible
                              ? "border-blue-100 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-400"
                          )}
                          title={layer.visible ? "Hide layer" : "Show layer"}
                        >
                          {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{layer.id}</span>
                        <span className="font-bold">
                          {layer.visible ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[160px] items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                        <Layers size={18} />
                      </div>
                      <div className="text-sm font-extrabold text-slate-800">
                        {noLayerTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {noLayerDescription}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <ShieldCheck size={17} />
                System Check
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Backend</span>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 font-extrabold",
                      apiHealthText.toLowerCase() === "online"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {apiHealthText}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Map Engine</span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-extrabold text-blue-700">
                    Leaflet
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Diagnostics</span>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 font-extrabold",
                      missingCapabilities.length
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {missingCapabilities.length ? "Required" : "Clear"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-100">
                <Activity size={15} />
                Request State
              </div>

              <div className="space-y-1 font-mono text-[11px] leading-5 text-slate-300">
                <div>
                  <span className={isError ? "text-red-400" : isWarning ? "text-amber-300" : "text-emerald-400"}>•</span>{" "}
                  Status: {statusLabel}
                </div>
                <div>
                  <span className="text-blue-300">•</span> Backend health: {apiHealthText}
                </div>
                <div>
                  <span className="text-blue-300">•</span> Request ID:{" "}
                  <span className="break-all text-slate-100">
                    {summary.requestId || "not available"}
                  </span>
                </div>
                <div>
                  <span className="text-blue-300">•</span> Request details:{" "}
                  {hasRequestDetails ? "available" : "not available"}
                </div>
                <div>
                  <span className="text-blue-300">•</span> Missing capabilities:{" "}
                  {missingCapabilities.length || 0}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </aside>
  );
}
