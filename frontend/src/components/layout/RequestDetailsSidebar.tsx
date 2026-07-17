import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  FileJson,
  FileText,
  Layers,
  X
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

type RequestDetailsSidebarProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  details: RequestDetailsState | null;
};

type TabKey = "response" | "outputs" | "mapLayers" | "files";

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

function getStatus(details: RequestDetailsState | null) {
  const raw = details?.rawRequest;

  if (!isRecord(raw)) {
    return {
      failed: false,
      label: "No response",
      message: "No backend response is available yet."
    };
  }

  const status = readString(raw, ["status"], "").toLowerCase();
  const ok = raw.ok;

  const errors = Array.isArray(raw.errors) ? raw.errors : [];
  const structuredError = isRecord(raw.structured_error)
    ? raw.structured_error
    : isRecord(raw.metadata) && isRecord(raw.metadata.structured_error)
      ? raw.metadata.structured_error
      : null;

  const failed =
    status === "failed" ||
    status === "error" ||
    ok === false ||
    errors.length > 0 ||
    Boolean(structuredError);

  const firstErrorMessage =
    errors.length > 0 ? readString(errors[0], ["message"], "") : "";

  const message =
    readString(raw, ["message", "summary", "answer"], "") ||
    firstErrorMessage ||
    readString(structuredError, ["message"], "") ||
    (failed
      ? "Backend analysis failed."
      : "Backend analysis completed successfully.");

  return {
    failed,
    label: failed ? "Backend analysis failed" : "Backend analysis completed",
    message
  };
}

function countItems(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (isRecord(value)) return Object.keys(value).length;
  if (value === null || value === undefined) return 0;
  return 1;
}

export function RequestDetailsSidebar({
  open,
  onOpen,
  onClose,
  details
}: RequestDetailsSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("response");

  const status = useMemo(() => getStatus(details), [details]);

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: typeof FileJson;
    count: number;
  }> = [
    {
      key: "response",
      label: "Raw Response",
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
      label: "Map Layers",
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

  function handleToggle() {
    if (open) {
      onClose();
      return;
    }

    onOpen();
  }

  function renderActiveTab() {
    if (!details) {
      return (
        <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <FileJson size={22} />
            </div>
            <div className="text-sm font-extrabold text-slate-800">
              No request details
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Run an analysis to inspect backend response data.
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "response") {
      return <JsonViewer title="Backend Raw Response" value={details.rawRequest} />;
    }

    if (activeTab === "outputs") {
      return <JsonViewer title="Backend Outputs" value={details.rawOutputs ?? {}} />;
    }

    if (activeTab === "mapLayers") {
      return <JsonViewer title="Backend Map Layers" value={details.rawMapLayers ?? []} />;
    }

    return <JsonViewer title="Backend Files" value={details.rawFiles ?? []} />;
  }

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-[80]">
      <button
        onClick={handleToggle}
        className={cx(
          "pointer-events-auto fixed top-24 z-[90] flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-xl transition-all duration-300 hover:bg-slate-50",
          open
            ? "right-[520px] rounded-l-2xl border-r-0"
            : "right-0 rounded-l-2xl"
        )}
        title={open ? "Hide request details" : "Show request details"}
      >
        {open ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <aside
        className={cx(
          "pointer-events-auto h-full w-[520px] border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div
          className={cx(
            "flex h-16 items-center justify-between border-b px-5",
            status.failed
              ? "border-red-100 bg-red-50"
              : "border-emerald-100 bg-emerald-50"
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
                status.failed ? "bg-red-600" : "bg-emerald-600"
              )}
            >
              {status.failed ? (
                <AlertTriangle size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )}
            </div>

            <div className="min-w-0">
              <div
                className={cx(
                  "truncate text-sm font-extrabold",
                  status.failed ? "text-red-950" : "text-emerald-950"
                )}
              >
                {status.label}
              </div>
              <div
                className={cx(
                  "truncate text-xs font-bold",
                  status.failed ? "text-red-700" : "text-emerald-700"
                )}
              >
                Request ID: {details?.requestId || "—"}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-slate-600 shadow-sm hover:bg-white"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <div
            className={cx(
              "rounded-2xl border p-4 text-xs leading-6",
              status.failed
                ? "border-red-100 bg-red-50 text-red-800"
                : "border-emerald-100 bg-emerald-50 text-emerald-800"
            )}
          >
            {status.message}
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cx(
                    "rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Icon size={16} />
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                        active
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {tab.count}
                    </span>
                  </div>
                  <div className="text-[11px] font-extrabold leading-4">
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[calc(100%-16rem)] overflow-y-auto p-4">
          {renderActiveTab()}
        </div>
      </aside>
    </div>
  );
}
