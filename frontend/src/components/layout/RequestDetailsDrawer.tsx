import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileJson,
  Layers,
  ListChecks,
  X
} from "lucide-react";

import { JsonViewer } from "../ui/JsonViewer";
import { cx } from "../../utils/cx";

export type RequestDetailsState = {
  requestId: string;
  rawRequest?: unknown;
  rawOutputs?: unknown;
  rawMapLayers?: unknown;
  rawFiles?: unknown;
};

type RequestDetailsDrawerProps = {
  open: boolean;
  details: RequestDetailsState | null;
  onClose: () => void;
};

type DetailsTab =
  | "overview"
  | "error"
  | "request"
  | "outputs"
  | "map-layers"
  | "files";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function readText(record: unknown, keys: string[], fallback = "—") {
  if (!isRecord(record)) return fallback;

  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item));
}

function getProductionResponse(rawRequest: unknown) {
  return getRecord(rawRequest, "production_response");
}

function getStructuredError(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);

  return (
    getRecord(production, "structured_error") ||
    getRecord(getRecord(production, "metadata"), "structured_error") ||
    getRecord(rawRequest, "structured_error") ||
    getRecord(getRecord(rawRequest, "metadata"), "structured_error")
  );
}

function getStatus(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);

  return (
    readText(production, ["status"], "") ||
    readText(rawRequest, ["status"], "") ||
    "unknown"
  );
}

function isFailed(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);
  const status = getStatus(rawRequest).toLowerCase();

  if (status === "failed" || status === "error") {
    return true;
  }

  if (isRecord(production) && production.ok === false) {
    return true;
  }

  return Boolean(getStructuredError(rawRequest));
}

function getMainMessage(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);
  const structured = getStructuredError(rawRequest);

  return (
    readText(production, ["message", "answer", "summary"], "") ||
    readText(structured, ["message"], "") ||
    readText(rawRequest, ["message", "summary", "answer"], "No message available.")
  );
}

function getWarnings(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);

  if (isRecord(production) && Array.isArray(production.warnings)) {
    return asStringArray(production.warnings);
  }

  if (isRecord(rawRequest) && Array.isArray(rawRequest.warnings)) {
    return asStringArray(rawRequest.warnings);
  }

  return [];
}

function getNextActions(rawRequest: unknown) {
  const production = getProductionResponse(rawRequest);

  if (isRecord(production) && Array.isArray(production.next_actions)) {
    return asStringArray(production.next_actions);
  }

  if (isRecord(rawRequest) && Array.isArray(rawRequest.next_actions)) {
    return asStringArray(rawRequest.next_actions);
  }

  return [];
}

function getLayerCount(rawMapLayers: unknown) {
  if (!isRecord(rawMapLayers)) return 0;

  const layers = rawMapLayers.layers;

  return Array.isArray(layers) ? layers.length : 0;
}

function getFileCount(rawFiles: unknown) {
  if (Array.isArray(rawFiles)) return rawFiles.length;

  if (isRecord(rawFiles)) {
    for (const key of ["files", "items", "data", "results"]) {
      const value = rawFiles[key];

      if (Array.isArray(value)) return value.length;
    }
  }

  return 0;
}

export function RequestDetailsDrawer({
  open,
  details,
  onClose
}: RequestDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("overview");

  const production = useMemo(
    () => getProductionResponse(details?.rawRequest),
    [details]
  );

  const structuredError = useMemo(
    () => getStructuredError(details?.rawRequest),
    [details]
  );

  const failed = useMemo(
    () => isFailed(details?.rawRequest),
    [details]
  );

  const warnings = useMemo(
    () => getWarnings(details?.rawRequest),
    [details]
  );

  const nextActions = useMemo(
    () => getNextActions(details?.rawRequest),
    [details]
  );

  if (!open || !details) {
    return null;
  }

  const tabs: Array<{ id: DetailsTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "error", label: "Error" },
    { id: "request", label: "Raw Request" },
    { id: "outputs", label: "Outputs" },
    { id: "map-layers", label: "Map Layers" },
    { id: "files", label: "Files" }
  ];

  return (
    <div className="fixed inset-0 z-[999990] bg-slate-950/35 backdrop-blur-sm">
      <div className="absolute right-4 top-4 flex h-[calc(100vh-32px)] w-[760px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-2xl",
                  failed
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {failed ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-slate-900">
                  Request Details
                </div>
                <div className="truncate text-xs text-slate-500">
                  {details.requestId}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                "h-8 shrink-0 rounded-lg px-3 text-xs font-extrabold",
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div
                className={cx(
                  "rounded-2xl border p-4",
                  failed
                    ? "border-red-100 bg-red-50"
                    : "border-emerald-100 bg-emerald-50"
                )}
              >
                <div
                  className={cx(
                    "mb-2 text-sm font-extrabold",
                    failed ? "text-red-800" : "text-emerald-800"
                  )}
                >
                  {failed ? "Backend analysis failed" : "Backend analysis completed"}
                </div>

                <div
                  className={cx(
                    "text-xs leading-6",
                    failed ? "text-red-700" : "text-emerald-700"
                  )}
                >
                  {getMainMessage(details.rawRequest)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  ["Status", getStatus(details.rawRequest), <ListChecks size={17} />],
                  ["Layers", String(getLayerCount(details.rawMapLayers)), <Layers size={17} />],
                  ["Files", String(getFileCount(details.rawFiles)), <FileJson size={17} />],
                  ["Outputs", details.rawOutputs ? "Available" : "Missing", <Database size={17} />]
                ].map(([label, value, icon]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      {icon}
                    </div>

                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {String(label)}
                    </div>

                    <div className="mt-1 truncate text-lg font-extrabold text-slate-900">
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>

              {warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="mb-2 text-sm font-extrabold text-amber-800">
                    Warnings
                  </div>

                  <ul className="space-y-1 text-xs leading-5 text-amber-800">
                    {warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {nextActions.length > 0 && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="mb-2 text-sm font-extrabold text-blue-800">
                    Next Actions
                  </div>

                  <ul className="space-y-1 text-xs leading-5 text-blue-800">
                    {nextActions.map((action) => (
                      <li key={action}>• {action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "error" && (
            <JsonViewer
              title="Structured Error"
              value={structuredError || production || details.rawRequest}
            />
          )}

          {activeTab === "request" && (
            <JsonViewer
              title="Raw Request Response"
              value={details.rawRequest || null}
            />
          )}

          {activeTab === "outputs" && (
            <JsonViewer
              title="Outputs"
              value={details.rawOutputs || { detail: "No output manifest was returned." }}
            />
          )}

          {activeTab === "map-layers" && (
            <JsonViewer
              title="Map Layers"
              value={details.rawMapLayers || { detail: "No map layers were returned." }}
            />
          )}

          {activeTab === "files" && (
            <JsonViewer
              title="Files"
              value={details.rawFiles || { detail: "No files were returned." }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
