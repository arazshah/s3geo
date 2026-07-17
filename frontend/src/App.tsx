import { useCallback, useEffect, useState } from "react";

import { BottomDrawer } from "./components/layout/BottomDrawer";
import { Header } from "./components/layout/Header";
import { LeftSidebar } from "./components/layout/LeftSidebar";
import { MapView } from "./components/layout/MapView";
import { RightPanel } from "./components/layout/RightPanel";
import { TopQueryPanel } from "./components/layout/TopQueryPanel";
import { WorkspacePanel } from "./components/layout/WorkspacePanel";
import type { RequestDetailsState } from "./components/layout/RequestDetailsPanel";
import {
  ToastContainer,
  type AppToast,
  type ToastType
} from "./components/ui/ToastContainer";

import { usePersistedState } from "./hooks/usePersistedState";
import { api, type GeoQueryRequest, type GeoQueryResponse } from "./lib/api";
import { buildAiInputRoleBindings } from "./lib/aiInputRoles";
import { buildFrontendLlmRequestConfig } from "./lib/llmSettings";

import type {
  LayerItem,
  OutputFile,
  RankingRow
} from "./data/mockSpatialData";

import type {
  AnalysisStatus,
  AnalysisSummaryState,
  NavView,
  SelectedMapFeature
} from "./types/ui";

import {
  normalizeFiles,
  normalizeLayers,
  normalizeRankingRows
} from "./utils/normalizers";
import { extractGeoJson } from "./utils/geojson";

type RightDockTab = "analysis" | "request-details";

const EMPTY_ANALYSIS_SUMMARY: AnalysisSummaryState = {
  requestId: "—",
  confidence: "—",
  executionTime: "—",
  text: "No analysis has been run yet. Select a project, add datasets, and run an AI spatial query."
};


function createToastId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function encodeFilePath(filename: string) {
  return filename
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown, key: string) {
  if (!isRecord(value)) return null;

  const nested = value[key];

  return isRecord(nested) ? nested : null;
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

function arrayFromPayload(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload)) return [];

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normalizeProjectOptions(payload: unknown) {
  const items = arrayFromPayload(payload, [
    "items",
    "data",
    "results",
    "projects"
  ]);

  const options = items
    .map((item) => {
      if (typeof item === "string") {
        const value = item.trim();
        return value ? { id: value, label: value } : null;
      }

      if (!isRecord(item)) {
        return null;
      }

      const id = readString(
        item,
        [
          "project_id",
          "projectId",
          "id",
          "uuid"
        ],
        ""
      ).trim();

      const label = readString(
        item,
        [
          "display_name",
          "displayName",
          "name",
          "title",
          "project_name",
          "projectName",
          "label"
        ],
        id
      ).trim();

      if (!id) {
        return null;
      }

      return {
        id,
        label: label || id
      };
    })
    .filter((item): item is { id: string; label: string } => Boolean(item));

  const byId = new Map<string, { id: string; label: string }>();

  for (const option of options) {
    if (!byId.has(option.id)) {
      byId.set(option.id, option);
    }
  }

  return Array.from(byId.values());
}

function normalizeDatasetOptions(payload: unknown) {
  const items = arrayFromPayload(payload, [
    "items",
    "data",
    "results",
    "uploads",
    "files",
    "data_sources",
    "sources"
  ]);

  const options = items
    .map((item) => {
      if (typeof item === "string") {
        const value = item.trim();
        return value ? { id: value, label: value } : null;
      }

      if (!isRecord(item)) {
        return null;
      }

      const id = readString(
        item,
        [
          "source_id",
          "data_source_id",
          "dataSourceId",
          "upload_id",
          "uploadId",
          "id",
          "uuid"
        ],
        ""
      ).trim();

      const label = readString(
        item,
        [
          "display_name",
          "displayName",
          "filename",
          "file_name",
          "name",
          "title",
          "original_filename",
          "originalFilename",
          "source_name",
          "sourceName"
        ],
        id
      ).trim();

      if (!id) {
        return null;
      }

      return {
        id,
        label: label || id
      };
    })
    .filter((item): item is { id: string; label: string } => Boolean(item));

  const byId = new Map<string, { id: string; label: string }>();

  for (const option of options) {
    if (!byId.has(option.id)) {
      byId.set(option.id, option);
    }
  }

  return Array.from(byId.values());
}

function getProductionResponse(response: GeoQueryResponse) {
  return getRecord(response, "production_response");
}

function getStructuredBackendError(response: GeoQueryResponse) {
  const production = getProductionResponse(response);

  return (
    getRecord(production, "structured_error") ||
    getRecord(getRecord(production, "metadata"), "structured_error") ||
    getRecord(response, "structured_error") ||
    getRecord(getRecord(response, "metadata"), "structured_error")
  );
}

function getBackendFailureMessage(response: GeoQueryResponse) {
  const production = getProductionResponse(response);

  const status = (
    readString(production, ["status"], "") ||
    readString(response, ["status"], "")
  ).toLowerCase();

  const productionOkValue = isRecord(production) ? production.ok : undefined;
  const topLevelOkValue = isRecord(response) ? response.ok : undefined;

  const structuredError =
    getStructuredBackendError(response) ||
    getRecord(response, "structured_error") ||
    getRecord(getRecord(response, "metadata"), "structured_error");

  const hasErrorsArray =
    isRecord(response) &&
    Array.isArray(response.errors) &&
    response.errors.length > 0;

  const failed =
    status === "failed" ||
    status === "error" ||
    productionOkValue === false ||
    topLevelOkValue === false ||
    Boolean(structuredError) ||
    hasErrorsArray;

  if (!failed) {
    return "";
  }

  let firstErrorMessage = "";

  if (isRecord(response) && Array.isArray(response.errors) && response.errors[0]) {
    firstErrorMessage = readString(response.errors[0], ["message"], "");
  }

  return (
    readString(production, ["message", "answer", "summary"], "") ||
    readString(response, ["message", "summary", "answer"], "") ||
    firstErrorMessage ||
    readString(structuredError, ["message"], "") ||
    "Backend analysis failed."
  );
}

function extractMissingCapabilities(payload: unknown): string[] {
  const messages: string[] = [];
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 250) {
    scanned += 1;

    const value = queue.shift();

    if (typeof value === "string") {
      if (
        value.toLowerCase().includes("required capabilities") ||
        value.toLowerCase().includes("missing capabilities") ||
        value.toLowerCase().includes("could not find required capabilities")
      ) {
        messages.push(value);
      }

      continue;
    }

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    if (!isRecord(value)) {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }

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
          "service_structured_error",
          "metadata",
          "raw",
          "production_response"
        ].includes(normalizedKey)
      ) {
        queue.push(nested);
      }
    }
  }

  const capabilityNames: string[] = [];

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
            !["required_capabilities", "missing_capabilities"].includes(cleanToken)
          ) {
            capabilityNames.push(cleanToken);
          }
        }
      }
    }
  }

  return Array.from(new Set(capabilityNames));
}


function buildSimplifiedQuery(sourceQuery: string, missingCapabilities: string[]) {
  const removedKeywords = [
    "ndvi",
    "vegetation",
    "spectral",
    "raster",
    "slope",
    "dem",
    "satellite",
    "mask"
  ];

  const sentences = sourceQuery
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const kept = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();

    return !removedKeywords.some((keyword) => lower.includes(keyword));
  });

  const base =
    kept.length > 0
      ? kept.join(" ")
      : "Find suitable land parcels in District 6 for a commercial complex.";

  const missingText = missingCapabilities.length
    ? ` Avoid operations that require these unavailable capabilities: ${missingCapabilities.join(", ")}.`
    : "";

  return `${base} Use only available vector-based operations such as parcel filtering, distance to metro stations, distance to shopping centers, accessibility scoring, area filtering, ranking table generation, and map layer generation.${missingText}`;
}

function getBackendSummaryText(response: GeoQueryResponse) {
  const production = getProductionResponse(response);

  return (
    readString(response, ["summary", "message"], "") ||
    readString(production, ["summary", "message", "answer"], "") ||
    ""
  );
}

function getResponseRequestId(response: GeoQueryResponse) {
  const production = getProductionResponse(response);

  return String(
    response.request_id ||
      response.requestId ||
      response.id ||
      readString(production, ["request_id"], "") ||
      "request-unknown"
  );
}

function getConfidenceText(response: GeoQueryResponse) {
  if (typeof response.confidence === "number") {
    return `${Math.round(response.confidence * 100)}%`;
  }

  if (typeof response.confidence === "string" && response.confidence) {
    return response.confidence;
  }

  const production = getProductionResponse(response);
  const confidence = getRecord(production, "confidence");

  if (confidence) {
    const score = confidence.score;

    if (typeof score === "number") {
      return `${Math.round(score * 100)}%`;
    }

    const level = confidence.level;

    if (typeof level === "string" && level) {
      return level;
    }
  }

  return "";
}

function getExecutionTimeText(response: GeoQueryResponse) {
  if (typeof response.execution_time_ms === "number") {
    return `${(response.execution_time_ms / 1000).toFixed(1)}s`;
  }

  if (typeof response.executionTimeMs === "number") {
    return `${(response.executionTimeMs / 1000).toFixed(1)}s`;
  }

  return "";
}function readResponseMapPayload(response: GeoQueryResponse) {
  if (!isRecord(response)) return undefined;

  const production = getProductionResponse(response);

  return (
    response.map_layers ||
    response.layers ||
    response.map ||
    (production ? production.map_layers : undefined) ||
    (production ? production.layers : undefined) ||
    (production ? production.map : undefined)
  );
}

function readResponseFilesPayload(response: GeoQueryResponse) {
  if (!isRecord(response)) return undefined;

  const production = getProductionResponse(response);

  return (
    response.files ||
    (production ? production.files : undefined) ||
    undefined
  );
}

function safeStringifyForDiagnostics(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, item) => {
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) {
          return "[Circular]";
        }

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
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(value);
  }
}
function extractErrorPayload(error: unknown) {
  if (!isRecord(error)) {
    return {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  const response = getRecord(error, "response");
  const responseData = response ? response.data : undefined;

  return makeJsonSafe({
    name: error instanceof Error ? error.name : readString(error, ["name"], "Error"),
    message: error instanceof Error ? error.message : readString(error, ["message"], "Unknown error"),
    responseData,
    status: response ? response.status : undefined,
    statusText: response ? response.statusText : undefined,
    raw: safeStringifyForDiagnostics(error)
  });
}

function makeJsonSafe<T = unknown>(value: T): T {
  const seen = new WeakSet<object>();

  function walk(item: unknown): unknown {
    if (item === null || item === undefined) return item;

    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      return item;
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

    if (Array.isArray(item)) {
      return item.map((entry) => walk(entry));
    }

    if (typeof item === "object") {
      if (seen.has(item)) {
        return "[Circular]";
      }

      seen.add(item);

      const output: Record<string, unknown> = {};

      for (const [key, entry] of Object.entries(item as Record<string, unknown>)) {
        output[key] = walk(entry);
      }

      return output;
    }

    return String(item);
  }

  return walk(value) as T;
}

function unwrapApiPayload<T = unknown>(value: T): T {
  if (!isRecord(value)) return value;

  if ("data" in value && isRecord(value.data)) {
    return value.data as T;
  }

  for (const key of ["payload", "result", "body"]) {
    const nested = value[key];

    if (isRecord(nested)) {
      return nested as T;
    }
  }

  return value;
}

function normalizeDatasetIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;

        if (isRecord(item)) {
          return String(
            item.id ||
              item.dataset_id ||
              item.name ||
              item.slug ||
              item.key ||
              ""
          );
        }

        return String(item || "");
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function geometryTypesFromGeoJson(value: unknown) {
  const geojson = extractGeoJson(value);

  if (!geojson) return [];

  return Array.from(
    new Set(
      geojson.features
        .map((feature) => feature.geometry?.type)
        .filter(Boolean)
        .map(String)
    )
  );
}

function buildDataSourceQueryContext({
  sourceId,
  title,
  metadata,
  preview
}: {
  sourceId: string;
  title: string;
  metadata: unknown;
  preview: unknown;
}) {
  const previewGeoJson = extractGeoJson(preview);
  const metadataGeoJson = extractGeoJson(metadata);
  const geojson = previewGeoJson || metadataGeoJson;
  const featureCount = geojson?.features.length;
  const geometryTypes = geometryTypesFromGeoJson(preview).length
    ? geometryTypesFromGeoJson(preview)
    : geometryTypesFromGeoJson(metadata);

  const lines = [
    `[Data Source Context: ${sourceId}]`,
    `Use the data source "${title || sourceId}" as an available dataset for the next spatial analysis.`,
    `Source ID: ${sourceId}`
  ];

  if (typeof featureCount === "number") {
    lines.push(`Available preview features: ${featureCount}`);
  }

  if (geometryTypes.length) {
    lines.push(`Geometry types: ${geometryTypes.join(", ")}`);
  }

  lines.push(
    "When answering or running analysis, prefer this data source when it is relevant to the user's request."
  );

  return lines.join("\n");
}

const backendFailureKeywords = [
  "failed",
  "failure",
  "error",
  "errored",
  "exception",
  "cancelled",
  "canceled",
  "timeout",
  "timed_out",
  "aborted",
  "unavailable",
  "invalid",
  "rejected"
];

function hasBackendFailureKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return backendFailureKeywords.some((keyword) => normalized.includes(keyword));
}

function isExplicitFalse(value: unknown): boolean {
  return value === false || String(value).toLowerCase() === "false";
}

function readUsefulFailureMessage(record: Record<string, unknown>): string {
  const message = readString(
    record,
    [
      "error_message",
      "errorMessage",
      "failure_message",
      "failureMessage",
      "failed_message",
      "failedMessage",
      "failure_reason",
      "failureReason",
      "reason",
      "detail",
      "details",
      "message",
      "description"
    ],
    ""
  );

  const normalizedMessage = message.toLowerCase();

  if (
    message &&
    !normalizedMessage.includes("completed successfully") &&
    !normalizedMessage.includes("analysis completed successfully") &&
    !normalizedMessage.includes("backend analysis completed")
  ) {
    return message;
  }

  return "";
}

function readErrorArrayMessage(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }

  const firstMessage = value
    .map((item) => {
      if (typeof item === "string") return item;

      if (isRecord(item)) {
        return readString(
          item,
          [
            "message",
            "error",
            "detail",
            "reason",
            "description",
            "failure_message",
            "failureMessage"
          ],
          ""
        );
      }

      return "";
    })
    .find((item) => item.trim());

  return firstMessage || "Backend analysis failed with one or more errors.";
}

function readBackendFailureFromRecord(record: unknown): string {
  if (!isRecord(record)) {
    return "";
  }

  const status = readString(
    record,
    [
      "status",
      "state",
      "outcome",
      "result",
      "result_status",
      "resultStatus",
      "execution_status",
      "executionStatus",
      "analysis_status",
      "analysisStatus",
      "request_status",
      "requestStatus",
      "task_status",
      "taskStatus",
      "job_status",
      "jobStatus",
      "run_status",
      "runStatus"
    ],
    ""
  );

  const hasFailedStatus = status ? hasBackendFailureKeyword(status) : false;

  const explicitFailedBoolean =
    isExplicitFalse(record.success) ||
    isExplicitFalse(record.ok) ||
    record.failed === true ||
    record.failure === true ||
    record.has_error === true ||
    record.hasError === true;

  for (const key of [
    "errors",
    "error_details",
    "errorDetails",
    "failures",
    "failure_details",
    "failureDetails",
    "exceptions"
  ]) {
    const message = readErrorArrayMessage(record[key]);

    if (message) {
      return message;
    }
  }

  const errorValue = record.error;

  if (typeof errorValue === "string" && errorValue.trim()) {
    return errorValue;
  }

  if (isRecord(errorValue)) {
    const nestedErrorMessage: string =
      readUsefulFailureMessage(errorValue) ||
      readBackendFailureFromRecord(errorValue);

    if (nestedErrorMessage) {
      return nestedErrorMessage;
    }
  }

  if (!hasFailedStatus && !explicitFailedBoolean) {
    return "";
  }

  const usefulMessage = readUsefulFailureMessage(record);

  if (usefulMessage) {
    return usefulMessage;
  }

  if (status) {
    return `Backend analysis failed with status "${status}".`;
  }

  return "Backend analysis failed.";
}

function getResponseStatusFailureMessage(response: GeoQueryResponse | null): string {
  if (!response) {
    return "";
  }

  const visited = new WeakSet<object>();

  function scan(value: unknown, depth: number): string {
    if (depth > 8 || value === null || value === undefined) {
      return "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const message = scan(item, depth + 1);

        if (message) {
          return message;
        }
      }

      return "";
    }

    if (!isRecord(value)) {
      return "";
    }

    if (visited.has(value)) {
      return "";
    }

    visited.add(value);

    const directFailure = readBackendFailureFromRecord(value);

    if (directFailure) {
      return directFailure;
    }

    // Scan high-signal fields first so nested backend execution status wins.
    for (const key of [
      "production_response",
      "productionResponse",
      "analysis",
      "analysis_result",
      "analysisResult",
      "execution",
      "job",
      "task",
      "request",
      "result",
      "response",
      "outputs",
      "output",
      "data",
      "raw",
      "summary",
      "diagnostics",
      "capability_diagnostics",
      "capabilityDiagnostics"
    ]) {
      if (key in value) {
        const message = scan(value[key], depth + 1);

        if (message) {
          return message;
        }
      }
    }

    // Fallback: scan all remaining fields.
    for (const nestedValue of Object.values(value)) {
      const message = scan(nestedValue, depth + 1);

      if (message) {
        return message;
      }
    }

    return "";
  }

  return scan(response, 0);
}


function getDefinitiveBackendFailureMessage(payload: unknown): string {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length && scanned < 300) {
    scanned += 1;

    const value = queue.shift();

    if (!isRecord(value)) {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }

    visited.add(value);

    const status = readString(
      value,
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
        "requestStatus",
        "task_status",
        "taskStatus",
        "job_status",
        "jobStatus",
        "run_status",
        "runStatus"
      ],
      ""
    );

    const normalizedStatus = status.toLowerCase();

    const failedByStatus =
      normalizedStatus.includes("failed") ||
      normalizedStatus.includes("failure") ||
      normalizedStatus.includes("error") ||
      normalizedStatus.includes("errored") ||
      normalizedStatus.includes("exception") ||
      normalizedStatus.includes("timeout") ||
      normalizedStatus.includes("aborted") ||
      normalizedStatus.includes("cancelled") ||
      normalizedStatus.includes("canceled") ||
      normalizedStatus.includes("rejected");

    const failedByBoolean =
      value.ok === false ||
      value.success === false ||
      value.failed === true ||
      value.failure === true ||
      value.has_error === true ||
      value.hasError === true;

    const structuredError = value.structured_error || value.structuredError;
    const serviceStructuredError =
      isRecord(value.metadata)
        ? value.metadata.service_structured_error || value.metadata.structured_error
        : undefined;

    const errorsValue = value.errors;
    const warningsValue = value.warnings;

    const hasErrorsArray = Array.isArray(errorsValue) && errorsValue.length > 0;

    if (failedByStatus || failedByBoolean || hasErrorsArray || structuredError || serviceStructuredError) {
      const structuredMessage =
        isRecord(structuredError)
          ? readString(structuredError, ["message", "detail", "reason", "description"], "")
          : "";

      const serviceStructuredMessage =
        isRecord(serviceStructuredError)
          ? readString(serviceStructuredError, ["message", "detail", "reason", "description"], "")
          : "";

      const firstErrorMessage =
        Array.isArray(errorsValue)
          ? errorsValue
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

      const firstWarningMessage =
        Array.isArray(warningsValue)
          ? warningsValue
              .map((item) => String(item || ""))
              .find((item) => item.trim()) || ""
          : "";

      const directMessage = readString(
        value,
        ["message", "summary", "answer", "error_message", "errorMessage", "failure_message", "failureMessage", "detail"],
        ""
      );

      return (
        structuredMessage ||
        serviceStructuredMessage ||
        firstErrorMessage ||
        directMessage ||
        firstWarningMessage ||
        (status ? `Backend analysis failed with status "${status}".` : "Backend analysis failed.")
      );
    }

    for (const nested of Object.values(value)) {
      if (nested && (typeof nested === "object")) {
        queue.push(nested);
      }
    }
  }

  return "";
}

function getHardBackendFailureMessage(payload: unknown): string {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 500) {
    scanned += 1;

    const value = queue.shift();

    if (!isRecord(value)) {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }

    visited.add(value);

    const status = readString(
      value,
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
        "requestStatus",
        "task_status",
        "taskStatus",
        "job_status",
        "jobStatus",
        "run_status",
        "runStatus"
      ],
      ""
    );

    const normalizedStatus = status.trim().toLowerCase();

    const failedByStatus =
      normalizedStatus === "failed" ||
      normalizedStatus === "failure" ||
      normalizedStatus === "error" ||
      normalizedStatus === "errored" ||
      normalizedStatus.includes("failed") ||
      normalizedStatus.includes("failure") ||
      normalizedStatus.includes("error") ||
      normalizedStatus.includes("exception") ||
      normalizedStatus.includes("timeout") ||
      normalizedStatus.includes("aborted") ||
      normalizedStatus.includes("cancelled") ||
      normalizedStatus.includes("canceled") ||
      normalizedStatus.includes("rejected");

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
      isRecord(metadata)
        ? metadata.structured_error ||
          metadata.structuredError ||
          metadata.service_structured_error ||
          metadata.serviceStructuredError
        : undefined;

    const hasStructuredError =
      Boolean(structuredError) || Boolean(metadataStructuredError);

    if (failedByStatus || failedByBoolean || hasErrorsArray || hasStructuredError) {
      const firstErrorMessage =
        Array.isArray(errorsValue)
          ? errorsValue
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

      const structuredMessage =
        isRecord(structuredError)
          ? readString(structuredError, ["message", "detail", "reason", "description"], "")
          : "";

      const metadataStructuredMessage =
        isRecord(metadataStructuredError)
          ? readString(metadataStructuredError, ["message", "detail", "reason", "description"], "")
          : "";

      const directMessage = readString(
        value,
        [
          "message",
          "summary",
          "answer",
          "error_message",
          "errorMessage",
          "failure_message",
          "failureMessage",
          "detail",
          "description"
        ],
        ""
      );

      return (
        firstErrorMessage ||
        structuredMessage ||
        metadataStructuredMessage ||
        directMessage ||
        (status ? `Backend analysis failed with status "${status}".` : "Backend analysis failed.")
      );
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        queue.push(nestedValue);
      }
    }
  }

  return "";
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function compactPlanStepText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildSelectedPlanningDataSourceLabels(
  selectedDatasetIds: string[],
  datasetLabels: Record<string, string>,
  dataSourceContexts: Array<{
    sourceId: string;
    title?: string;
    featureCount?: number;
    geometryTypes?: string[];
  }>
): string[] {
  const contextLabels = dataSourceContexts.map((item) => item.title || item.sourceId);

  const datasetSelectorLabels = selectedDatasetIds.map(
    (datasetId) => datasetLabels[datasetId] || datasetId
  );

  return uniqueNonEmptyStrings([...contextLabels, ...datasetSelectorLabels]);
}

function buildPlannerIntentHints(queryText: string, dataSourceTitles: string[]) {
  const normalizedQuery = queryText.toLowerCase();

  const mentionsRaster =
    normalizedQuery.includes("raster") ||
    normalizedQuery.includes("ndvi") ||
    normalizedQuery.includes("dem") ||
    normalizedQuery.includes("slope") ||
    normalizedQuery.includes("vegetation") ||
    normalizedQuery.includes("satellite") ||
    normalizedQuery.includes("spectral") ||
    normalizedQuery.includes("green cover");

  const mentionsMetro =
    normalizedQuery.includes("metro") ||
    normalizedQuery.includes("station");

  const mentionsMap =
    normalizedQuery.includes("map") ||
    normalizedQuery.includes("layer") ||
    normalizedQuery.includes("geojson");

  const detectedCriteria: string[] = [];

  if (mentionsMetro) {
    detectedCriteria.push("vector_proximity_to_metro_stations");
  }

  if (mentionsMap) {
    detectedCriteria.push("map_layer_generation");
  }

  if (mentionsRaster) {
    detectedCriteria.push("raster_analysis");
  }

  const selectedDataLooksVectorOnly =
    dataSourceTitles.length > 0 &&
    dataSourceTitles.every((title) => {
      const value = title.toLowerCase();

      return (
        value.endsWith(".geojson") ||
        value.endsWith(".json") ||
        value.endsWith(".gpkg") ||
        value.endsWith(".shp") ||
        value.includes("geojson") ||
        value.includes("vector")
      );
    });

  const requiresRaster = mentionsRaster;

  return {
    frontend_inferred_intent: mentionsRaster
      ? "raster_or_mixed_spatial_analysis"
      : mentionsMetro
        ? "vector_proximity_analysis"
        : "general_vector_spatial_analysis",
    frontend_detected_criteria: detectedCriteria,
    frontend_requires_raster: requiresRaster,
    frontend_selected_sources_look_vector_only: selectedDataLooksVectorOnly,
    frontend_selected_data_source_titles: dataSourceTitles,
    frontend_avoid_capabilities: requiresRaster
      ? []
      : [
          "calculate_spectral_index",
          "threshold_raster",
          "raster_to_vector"
        ],
    frontend_preferred_execution_mode: requiresRaster
      ? "allow_raster_if_available"
      : "vector_only_if_possible"
  };
}

function buildDynamicPlanningSteps(
  queryText: string,
  projectLabel: string,
  dataSourceLabels: string[]
): string[] {
  const normalizedQuery = queryText.toLowerCase();

  const districtMatch =
    queryText.match(/district\s*([0-9]+)/i) ||
    queryText.match(/منطقه\s*([0-9]+)/i);

  const targetArea = districtMatch
    ? `District ${districtMatch[1]}`
    : projectLabel
      ? projectLabel
      : normalizedQuery.includes("tehran")
        ? "Tehran study area"
        : "the requested study area";

  const selectedSourcesText =
    dataSourceLabels.length > 0
      ? dataSourceLabels.slice(0, 4).join(", ") +
        (dataSourceLabels.length > 4 ? ` +${dataSourceLabels.length - 4} more` : "")
      : "no selected data source yet";

  const steps = [
    `Parse the user query and identify the target area: ${targetArea}.`,
    projectLabel
      ? `Use selected project context: ${projectLabel}.`
      : "Use the currently selected project context if available.",
    `Use selected data source${dataSourceLabels.length === 1 ? "" : "s"}: ${selectedSourcesText}.`
  ];

  const constraints: string[] = [];

  if (normalizedQuery.includes("metro")) {
    constraints.push("metro station proximity");
  }

  if (
    normalizedQuery.includes("shopping") ||
    normalizedQuery.includes("mall") ||
    normalizedQuery.includes("center") ||
    normalizedQuery.includes("centre")
  ) {
    constraints.push("shopping center proximity");
  }

  if (
    normalizedQuery.includes("vegetation") ||
    normalizedQuery.includes("ndvi") ||
    normalizedQuery.includes("green")
  ) {
    constraints.push("vegetation / NDVI constraint");
  }

  if (normalizedQuery.includes("slope") || normalizedQuery.includes("dem")) {
    constraints.push("slope / DEM constraint");
  }

  if (
    normalizedQuery.includes("area") ||
    normalizedQuery.includes("square") ||
    normalizedQuery.includes("sqm") ||
    normalizedQuery.includes("m2")
  ) {
    constraints.push("minimum parcel area");
  }

  if (constraints.length > 0) {
    steps.push(`Detect spatial criteria: ${constraints.join(", ")}.`);
  } else {
    steps.push("Detect spatial filters, scoring criteria, and output requirements from the query.");
  }

  const outputRequirements: string[] = [];

  if (normalizedQuery.includes("map")) outputRequirements.push("map layers");
  if (normalizedQuery.includes("ranking") || normalizedQuery.includes("rank")) {
    outputRequirements.push("ranking table");
  }
  if (normalizedQuery.includes("report") || normalizedQuery.includes("pdf")) {
    outputRequirements.push("PDF report");
  }
  if (normalizedQuery.includes("geojson")) outputRequirements.push("GeoJSON output");

  steps.push("Check available backend capabilities and selected data sources before execution.");
  steps.push("Build an execution plan for filtering, scoring, and ranking candidate locations.");

  if (outputRequirements.length > 0) {
    steps.push(`Prepare requested outputs: ${outputRequirements.join(", ")}.`);
  } else {
    steps.push("Prepare analysis outputs for review in the workspace.");
  }

  return uniqueNonEmptyStrings(steps.map(compactPlanStepText));
}

function readPlanStepTextFromItem(item: unknown): string {
  if (typeof item === "string") {
    return compactPlanStepText(item);
  }

  if (!isRecord(item)) {
    return "";
  }

  const title = readString(
    item,
    ["title", "name", "label", "step", "action", "operation", "capability", "tool"],
    ""
  );

  const description = readString(
    item,
    ["description", "summary", "message", "detail", "details", "reason"],
    ""
  );

  if (title && description && title !== description) {
    return compactPlanStepText(`${title}: ${description}`);
  }

  return compactPlanStepText(title || description);
}

function extractPreviewPlanSteps(payload: unknown, fallbackSteps: string[]): string[] {
  const planKeys = new Set([
    "steps",
    "plan_steps",
    "planSteps",
    "planning_steps",
    "planningSteps",
    "execution_steps",
    "executionSteps",
    "execution_plan",
    "executionPlan",
    "tasks",
    "actions",
    "trace"
  ]);

  const collected: string[] = [];
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();
  let scanned = 0;

  while (queue.length > 0 && scanned < 300) {
    scanned += 1;

    const value = queue.shift();

    if (!isRecord(value)) {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }

    visited.add(value);

    for (const [key, nested] of Object.entries(value)) {
      if (Array.isArray(nested) && planKeys.has(key)) {
        for (const item of nested) {
          const stepText = readPlanStepTextFromItem(item);

          if (stepText) {
            collected.push(stepText);
          }
        }
      }

      if (
        nested &&
        typeof nested === "object" &&
        ["plan", "planning", "preview", "outputs", "metadata", "result"].includes(key)
      ) {
        queue.push(nested);
      }
    }
  }

  const normalized = uniqueNonEmptyStrings(collected);

  return normalized.length > 0 ? normalized : fallbackSteps;
}

function removeDataSourceContextBlock(queryText: string, sourceId: string) {
  const marker = `[Data Source Context: ${sourceId}]`;
  const start = queryText.indexOf(marker);

  if (start < 0) {
    return queryText;
  }

  const before = queryText.slice(0, start).trimEnd();
  const afterMarkerStart = start + marker.length;
  const nextContextStart = queryText.indexOf(
    "\n[Data Source Context:",
    afterMarkerStart
  );

  if (nextContextStart >= 0) {
    const after = queryText.slice(nextContextStart + 1).trimStart();
    return `${before}\n\n${after}`.trim();
  }

  return before.trim();
}

type QueryDataSourceContext = {
  sourceId: string;
  title: string;
  addedAt: string;
  featureCount?: number;
  geometryTypes?: string[];
  role?: string;
  inputRole?: string;
};

function readDatasetIdValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "[object Object]" ? "" : trimmed;
  }

  if (isRecord(value)) {
    return readString(
      value,
      [
        "data_source_id",
        "source_id",
        "dataset_id",
        "upload_id",
        "id"
      ],
      ""
    );
  }

  return "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return uniqueNonEmptyStrings(
    value
      .map(readDatasetIdValue)
      .filter((item) => item && item !== "[object Object]")
  );
}

function collectPayloadRecords(payload: unknown, maxRecords = 120): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();

  while (queue.length > 0 && records.length < maxRecords) {
    const item = queue.shift();

    if (!isRecord(item)) continue;
    if (visited.has(item)) continue;

    visited.add(item);
    records.push(item);

    for (const [key, value] of Object.entries(item)) {
      if (!value || typeof value !== "object") continue;

      if (
        [
          "submittedPayload",
          "submitted_payload",
          "request_payload",
          "payload",
          "request",
          "raw",
          "metadata",
          "production_response",
          "response",
          "outputs",
          "context",
          "query_spec"
        ].includes(key)
      ) {
        queue.push(value);
      }
    }
  }

  return records;
}

function readDataSourceContextsFromPayload(payload: unknown): QueryDataSourceContext[] {
  const contexts: QueryDataSourceContext[] = [];
  const records = collectPayloadRecords(payload);

  for (const record of records) {
    const context = isRecord(record.context) ? record.context : record;
    const dataSources = Array.isArray(context.data_sources)
      ? context.data_sources
      : Array.isArray(record.data_sources)
        ? record.data_sources
        : [];

    for (const item of dataSources) {
      if (!isRecord(item)) continue;

      const sourceId = readString(
        item,
        ["data_source_id", "source_id", "dataset_id", "id", "upload_id"],
        ""
      );

      if (!sourceId) continue;

      contexts.push({
        sourceId,
        title: readString(item, ["title", "name", "label", "filename"], sourceId),
        addedAt: readString(item, ["added_at", "addedAt"], new Date().toISOString()),
        featureCount:
          typeof item.feature_count === "number"
            ? item.feature_count
            : typeof item.featureCount === "number"
              ? item.featureCount
              : undefined,
        geometryTypes: Array.isArray(item.geometry_types)
          ? item.geometry_types.map(String)
          : Array.isArray(item.geometryTypes)
            ? item.geometryTypes.map(String)
            : undefined,
        role: readString(item, ["role"], ""),
        inputRole: readString(item, ["input_role", "inputRole"], "")
      });
    }
  }

  return Array.from(
    new Map(contexts.map((item) => [item.sourceId, item])).values()
  );
}

function readDatasetIdsFromRequestPayload(payload: unknown): string[] {
  const records = collectPayloadRecords(payload);
  const collected: string[] = [];

  for (const record of records) {
    collected.push(
      ...readStringArray(record.data_source_ids),
      ...readStringArray(record.dataset_ids),
      ...readStringArray(record.datasets)
    );

    if (isRecord(record.inputs)) {
      collected.push(
        readDatasetIdValue(record.inputs.source),
        readDatasetIdValue(record.inputs.target)
      );
    }

    if (isRecord(record.input_roles)) {
      for (const value of Object.values(record.input_roles)) {
        collected.push(readDatasetIdValue(value));
      }
    }

    if (isRecord(record.resolved_input_roles)) {
      for (const value of Object.values(record.resolved_input_roles)) {
        if (!isRecord(value)) continue;

        collected.push(
          readString(value, ["data_source_id", "source_id", "dataset_id", "id"], "")
        );
      }
    }

    if (Array.isArray(record.entities)) {
      for (const entity of record.entities) {
        if (!isRecord(entity) || !isRecord(entity.binding)) continue;

        collected.push(
          readString(entity.binding, ["data_source_id", "source_id", "dataset_id", "id"], "")
        );
      }
    }
  }

  const contextIds = readDataSourceContextsFromPayload(payload).map((item) => item.sourceId);

  return normalizeDatasetIds([...collected, ...contextIds])
    .filter((item) => item && item !== "[object Object]");
}

function extractAiQueryRestoreState(payload: unknown): {
  queryText: string;
  projectId: string;
  datasetIds: string[];
  dataSourceContexts: QueryDataSourceContext[];
} {
  const records = collectPayloadRecords(payload);

  let queryText = "";
  let projectId = "";

  for (const record of records) {
    if (!queryText) {
      queryText = readString(
        record,
        [
          "query",
          "user_query",
          "userQuery",
          "natural_language_query",
          "naturalLanguageQuery",
          "raw_query",
          "original_query",
          "effective_query"
        ],
        ""
      );
    }

    if (!projectId) {
      projectId = readString(record, ["project_id", "projectId"], "");
    }

    if (queryText && projectId) break;
  }

  const dataSourceContexts = readDataSourceContextsFromPayload(payload);
  const datasetIds = readDatasetIdsFromRequestPayload(payload);

  return {
    queryText,
    projectId,
    datasetIds,
    dataSourceContexts
  };
}


function getPlanningFallbackIntro(message: unknown) {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("disabled") ||
    normalized.includes("planning_enabled=false") ||
    normalized.includes("llm_planning_enabled=false") ||
    normalized.includes("query_spec_planning_enabled=false") ||
    normalized.includes("llm planning is disabled") ||
    normalized.includes("query spec planning is disabled")
  ) {
    return "Planner/LLM planning is disabled by configuration. Showing dynamic local plan.";
  }

  if (
    normalized.includes("openai_base_url") ||
    normalized.includes("llm_base_url") ||
    normalized.includes("api key") ||
    normalized.includes("api_key") ||
    normalized.includes("not configured")
  ) {
    return "LLM backend configuration is incomplete. Showing dynamic local plan.";
  }

  return "Backend planner preview was not used. Showing dynamic local plan.";
}

function isBackendRequestId(value: string | null | undefined) {
  const requestId = String(value || "").trim();

  if (!requestId) return false;

  const normalized = requestId.toLowerCase();

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

export default function App() {
  const [activeView, setActiveView] = usePersistedState<NavView>(
    "smart-spatial:active-view",
    "ai-query"
  );

  const [leftCollapsed, setLeftCollapsed] = usePersistedState(
    "smart-spatial:left-collapsed",
    false
  );

  const [topCollapsed, setTopCollapsed] = usePersistedState(
    "smart-spatial:top-query-collapsed",
    false
  );

  const [rightCollapsed, setRightCollapsed] = usePersistedState(
    "smart-spatial:right-panel-collapsed",
    false
  );

  const [bottomCollapsed, setBottomCollapsed] = usePersistedState(
    "smart-spatial:bottom-drawer-collapsed",
    false
  );

  const [query, setQuery] = usePersistedState("smart-spatial:ai-query:text", "");
  const [queryDataSourceContexts, setQueryDataSourceContexts] = useState<QueryDataSourceContext[]>([]);
  const [selectedProjectId, setSelectedProjectId] = usePersistedState("smart-spatial:ai-query:selected-project-id", "");
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [projectLabels, setProjectLabels] = useState<Record<string, string>>({});
  const [selectedDatasets, setSelectedDatasets] = usePersistedState<string[]>("smart-spatial:ai-query:selected-datasets", []);
  const [availableDatasets, setAvailableDatasets] = useState<string[]>([]);
  const [datasetLabels, setDatasetLabels] = useState<Record<string, string>>({});
  const [layerItems, setLayerItems] = useState<LayerItem[]>([]);
  const [zoomToLayerRequest, setZoomToLayerRequest] = useState<string | null>(null);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedMapFeature | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetailsState | null>(null);
  const [rightActiveTab, setRightActiveTab] = useState<RightDockTab>("analysis");
  const [, setBackendFailureMessage] = useState("");
  const [missingCapabilities, setMissingCapabilities] = useState<string[]>([]);
  const [suggestedQuery, setSuggestedQuery] = useState("");
  const [planningPreviewSource, setPlanningPreviewSource] = useState<
    "local-draft" | "backend" | "backend-failed" | "local-fallback"
  >("local-draft");
  const [planningSteps, setPlanningSteps] = useState<string[]>(() =>
    buildDynamicPlanningSteps("", "", [])
  );

  const [summary, setSummary] =
    useState<AnalysisSummaryState>(EMPTY_ANALYSIS_SUMMARY);

  const [apiHealthText, setApiHealthText] = useState("Checking");
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisStatus>("checking");

  const [message, setMessage] = useState("Checking backend connection...");
  const [toasts, setToasts] = useState<AppToast[]>([]);

  useEffect(() => {
    const projectLabel = selectedProjectId
      ? projectLabels[selectedProjectId] || selectedProjectId
      : "";

    const dataSourceLabels = buildSelectedPlanningDataSourceLabels(
      selectedDatasets,
      datasetLabels,
      queryDataSourceContexts
    );

    setPlanningSteps(buildDynamicPlanningSteps(query, projectLabel, dataSourceLabels));
    setPlanningPreviewSource("local-draft");
  }, [
    query,
    selectedProjectId,
    selectedDatasets,
    datasetLabels,
    queryDataSourceContexts,
    projectLabels
  ]);

  useEffect(() => {
    const normalizedSelectedDatasets = normalizeDatasetIds(
      (selectedDatasets as unknown[])
        .map(readDatasetIdValue)
        .filter((item) => item && item !== "[object Object]")
    );

    const hasInvalidRuntimeValue =
      (selectedDatasets as unknown[]).some((item) => typeof item !== "string") ||
      selectedDatasets.some((item) => item === "[object Object]");

    const hasChanged =
      hasInvalidRuntimeValue ||
      normalizedSelectedDatasets.length !== selectedDatasets.length ||
      normalizedSelectedDatasets.some((item, index) => item !== selectedDatasets[index]);

    if (hasChanged) {
      setSelectedDatasets(normalizedSelectedDatasets);
    }
  }, [selectedDatasets, setSelectedDatasets]);

  const isMapLoading =
    analysisStatus === "running" || analysisStatus === "previewing";

  function handleNavigate(view: NavView) {
    setActiveView(view);

    if (view === "ai-query") {
      setTopCollapsed(false);
    } else {
      setTopCollapsed(true);
    }
  }

  function restoreAiQueryFromRequestPayload(payload: unknown) {
    const restored = extractAiQueryRestoreState(payload);

    const nextDatasetIds = normalizeDatasetIds(restored.datasetIds);
    const nextContexts = restored.dataSourceContexts;

    let restoredFields = 0;

    if (restored.queryText.trim()) {
      setQuery(restored.queryText);
      restoredFields += 1;
    }

    if (restored.projectId.trim()) {
      setSelectedProjectId(restored.projectId);
      restoredFields += 1;
    }

    if (nextDatasetIds.length > 0) {
      setSelectedDatasets(nextDatasetIds);
      restoredFields += 1;
    }

    if (nextContexts.length > 0) {
      setQueryDataSourceContexts(nextContexts);
      restoredFields += 1;
    }

    return {
      restored: restoredFields > 0,
      queryRestored: Boolean(restored.queryText.trim()),
      projectRestored: Boolean(restored.projectId.trim()),
      datasetCount: nextDatasetIds.length,
      contextCount: nextContexts.length
    };
  }

  function buildGeoQueryRequest(queryText: string): GeoQueryRequest {
    const selectedDatasetIds = normalizeDatasetIds(selectedDatasets);

    const contextDataSourceIds = queryDataSourceContexts
      .map((item) => item.sourceId)
      .filter(Boolean);

    const dataSourceIds = Array.from(
      new Set([...selectedDatasetIds, ...contextDataSourceIds])
    ).filter(Boolean);

    const combinedDatasetIds = Array.from(
      new Set([...selectedDatasetIds, ...contextDataSourceIds])
    ).filter(Boolean);

    const contextDataSources = queryDataSourceContexts.map((item) => ({
      source_id: item.sourceId,
      title: item.title,
      added_at: item.addedAt,
      added_from: "data_source_context",
      feature_count: item.featureCount,
      geometry_types: item.geometryTypes,
      role: item.role,
      input_role: item.inputRole
    }));

    const selectedDatasetDataSources = selectedDatasetIds
      .filter(
        (datasetId) =>
          !contextDataSources.some((item) => item.source_id === datasetId)
      )
      .map((datasetId) => ({
        source_id: datasetId,
        title: datasetLabels[datasetId] || datasetId,
        added_from: "ai_query_dataset_selector"
      }));

    const dataSources = [
      ...contextDataSources,
      ...selectedDatasetDataSources
    ];

    const dataSourceTitles = dataSources
      .map((item) => item.title || item.source_id)
      .filter(Boolean);

    const plannerIntentHints = buildPlannerIntentHints(queryText, dataSourceTitles);

    const roleBinding = buildAiInputRoleBindings({
      query: queryText,
      inferredIntent: plannerIntentHints.frontend_inferred_intent,
      detectedCriteria: plannerIntentHints.frontend_detected_criteria,
      datasets: dataSources.map((item) => ({
        id: item.source_id,
        title: item.title || item.source_id,
        addedFrom: item.added_from || "ai_query_dataset_selector"
      }))
    });

    const enrichedRoleDataSources = roleBinding.dataSources.map((roleSource) => {
      const original = dataSources.find((item) => item.source_id === roleSource.source_id);

      return {
        ...original,
        ...roleSource
      };
    });

    const hasRoleInputs = Object.keys(roleBinding.inputs).length > 0;
    const hasInputRoles = Object.keys(roleBinding.inputRoles).length > 0;
    const hasDataSources = enrichedRoleDataSources.length > 0;

    return {
      ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
      query: queryText,
      datasets: [...combinedDatasetIds],
      ...(hasRoleInputs
        ? {
            inputs: {
              ...roleBinding.inputs
            }
          }
        : {}),
      ...(dataSourceIds.length
        ? {
            dataset_ids: [...combinedDatasetIds],
            data_source_ids: [...dataSourceIds],
            context: {
              ...(hasInputRoles
                ? {
                    input_roles: {
                      ...roleBinding.inputRoles
                    }
                  }
                : {}),
              ...(hasDataSources
                ? {
                    data_sources: enrichedRoleDataSources
                  }
                : {})
            }
          }
        : {}),
      metadata: {
        data_source_context_count: enrichedRoleDataSources.length,
        selected_dataset_count: selectedDatasetIds.length,
        data_source_id_count: dataSourceIds.length,
        ...plannerIntentHints,
        frontend_operation: roleBinding.metadata.frontend_operation,
        frontend_input_roles: roleBinding.metadata.frontend_input_roles,
        frontend_role_binding_strategy: roleBinding.metadata.frontend_role_binding_strategy,
        frontend_role_binding_warnings: roleBinding.metadata.frontend_role_binding_warnings,
        llm: buildFrontendLlmRequestConfig()
      },
      options: {
        generate_report: true,
        generate_map_layers: true,
        return_geojson: true,
        return_ranking_table: true
      }
    };
  }

  const addToast = useCallback(
    (type: ToastType, title: string, toastMessage?: string) => {
      const id = createToastId();

      setToasts((current) => [
        {
          id,
          type,
          title,
          message: toastMessage
        },
        ...current.slice(0, 3)
      ]);

      if (type !== "loading") {
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4200);
      }

      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);

    addToast(
      "info",
      "Project selected",
      projectLabels[projectId] || projectId
    );
  }

  function handleAddDataset(datasetId: string) {
    setSelectedDatasets((current) => {
      if (current.includes(datasetId)) {
        return current;
      }

      return [...current, datasetId];
    });

    setAvailableDatasets((current) =>
      current.includes(datasetId) ? current : [...current, datasetId]
    );

    setDatasetLabels((current) => ({
      ...current,
      [datasetId]: current[datasetId] || datasetId
    }));

    addToast(
      "success",
      "Dataset added",
      datasetLabels[datasetId] || datasetId
    );
  }

  function handleRemoveDataset(datasetId: string) {
    setSelectedDatasets((current) =>
      current.filter((item) => item !== datasetId)
    );

    addToast(
      "info",
      "Dataset removed",
      datasetId
    );
  }

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const health = await api.health();

        if (!mounted) return;

        const healthMessage = String(
          health.status || health.service || health.version || "Backend online"
        );

        setApiHealthText("Online");
        setAnalysisStatus("idle");
        setMessage(healthMessage);

        addToast(
          "success",
          "Backend connected",
          `API is available at ${api.baseUrl}`
        );
      } catch {
        if (!mounted) return;

        setApiHealthText("Offline");
        setAnalysisStatus("idle");
        setMessage("Backend unavailable. Using mock data.");

        addToast(
          "warning",
          "Backend unavailable",
          "The interface is running with mock data until the API is available."
        );
      }
    }

    checkHealth();

    return () => {
      mounted = false;
    };
  }, [addToast]);

  useEffect(() => {
    let mounted = true;

    async function loadAiQuerySelectors() {
      const [projectsResult, uploadsResult] = await Promise.allSettled([
        api.listProjects(),
        api.listUploads()
      ]);

      if (!mounted) return;

      if (projectsResult.status === "fulfilled") {
        const projectOptions = normalizeProjectOptions(projectsResult.value);
        const nextProjects = projectOptions.map((item) => item.id);

        setAvailableProjects(nextProjects);

        setProjectLabels((current) => {
          const next = { ...current };

          for (const option of projectOptions) {
            next[option.id] = option.label;
          }

          return next;
        });

        setSelectedProjectId((current) =>
          current && nextProjects.includes(current)
            ? current
            : nextProjects[0] || ""
        );
      }

      if (uploadsResult.status === "fulfilled") {
        const uploadDatasetOptions = normalizeDatasetOptions(uploadsResult.value);

        if (uploadDatasetOptions.length) {
          const uploadDatasetIds = uploadDatasetOptions.map((item) => item.id);

          setAvailableDatasets((current) =>
            Array.from(new Set([...current, ...uploadDatasetIds]))
          );

          setDatasetLabels((current) => {
            const next = { ...current };

            for (const option of uploadDatasetOptions) {
              next[option.id] = option.label;
            }

            return next;
          });
        }
      }
    }

    void loadAiQuerySelectors();

    return () => {
      mounted = false;
    };
  }, []);

  function maximizeMap() {
    setLeftCollapsed(true);
    setTopCollapsed(true);
    setRightCollapsed(true);
    setBottomCollapsed(true);
    setActiveView("ai-query");

    addToast(
      "info",
      "Map maximized",
      "All collapsible panels were minimized to prioritize the map workspace."
    );
  }

  function handleMapFeatureSelect(feature: SelectedMapFeature) {
    setSelectedFeatureId(feature.id);
    setSelectedFeature(feature);

    addToast(
      "info",
      "Feature selected",
      `${feature.layerName}: ${feature.id}`
    );
  }

  function handleClearFeatureSelection() {
    setSelectedFeatureId(null);
    setSelectedFeature(null);
  }

  function handleRankingRowSelect(row: RankingRow) {
    setSelectedFeatureId(row.parcelId);
    setSelectedFeature({
      id: row.parcelId,
      layerId: "ranking-table",
      layerName: "Ranking Table",
      geometryType: "Table Row",
      properties: {
        rank: row.rank,
        parcelId: row.parcelId,
        suitabilityScore: row.suitabilityScore,
        distanceToMetro: row.distanceToMetro,
        distanceToShoppingCenter: row.distanceToShoppingCenter,
        meanNdvi: row.meanNdvi,
        meanSlope: row.meanSlope,
        area: row.area,
        recommendation: row.recommendation
      }
    });
  }

  function toggleLayer(layerId: string) {
    setLayerItems((current) =>
      current.map((layer) =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
  }

  function showAllLayers() {
    setLayerItems((currentLayers) =>
      currentLayers.map((layer) => ({
        ...layer,
        visible: true
      }))
    );
  }

  function hideAllLayers() {
    setLayerItems((currentLayers) =>
      currentLayers.map((layer) => ({
        ...layer,
        visible: false
      }))
    );
  }

  function handleZoomToMapLayer(layerId: string) {
    const targetLayer = layerItems.find((layer) => layer.id === layerId);

    if (!targetLayer) {
      addToast(
        "error",
        "Layer not found",
        "The selected map layer is no longer available."
      );
      return;
    }

    setLayerItems((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: true } : layer
      )
    );

    handleNavigate("ai-query");
    setZoomToLayerRequest(`${layerId}::${Date.now()}`);

    addToast(
      "info",
      "Zooming to layer",
      targetLayer.name
    );
  }

  function handleRemoveMapLayer(layerId: string) {
    const targetLayer = layerItems.find((layer) => layer.id === layerId);

    if (!targetLayer) {
      addToast(
        "error",
        "Layer not found",
        "The selected map layer is no longer available."
      );
      return;
    }

    setLayerItems((currentLayers) =>
      currentLayers.filter((layer) => layer.id !== layerId)
    );

    if (selectedFeature?.layerId === layerId) {
      setSelectedFeature(null);
      setSelectedFeatureId(null);
    }

    addToast(
      "success",
      "Layer removed",
      `${targetLayer.name} was removed from the live map.`
    );
  }

  function handleUseDataSourceInQueryContext({
    sourceId,
    title,
    metadata,
    preview
  }: {
    sourceId: string;
    title: string;
    metadata: unknown;
    preview: unknown;
  }) {
    const contextBlock = buildDataSourceQueryContext({
      sourceId,
      title,
      metadata,
      preview
    });

    const contextMarker = `[Data Source Context: ${sourceId}]`;
    const previewGeoJson = extractGeoJson(preview);
    const metadataGeoJson = extractGeoJson(metadata);
    const geojson = previewGeoJson || metadataGeoJson;
    const previewGeometryTypes = geometryTypesFromGeoJson(preview);
    const metadataGeometryTypes = geometryTypesFromGeoJson(metadata);

    setQueryDataSourceContexts((current) => {
      if (current.some((item) => item.sourceId === sourceId)) {
        return current;
      }

      return [
        ...current,
        {
          sourceId,
          title: title || sourceId,
          addedAt: new Date().toISOString(),
          featureCount: geojson?.features.length,
          geometryTypes: previewGeometryTypes.length
            ? previewGeometryTypes
            : metadataGeometryTypes
        }
      ];
    });

    setAvailableDatasets((current) =>
      current.includes(sourceId) ? current : [...current, sourceId]
    );

    setDatasetLabels((current) => ({
      ...current,
      [sourceId]: title || current[sourceId] || sourceId
    }));

    setQuery((currentQuery) => {
      if (currentQuery.includes(contextMarker)) {
        return currentQuery;
      }

      return `${currentQuery.trim()}\n\n${contextBlock}`;
    });

    handleNavigate("ai-query");
    setTopCollapsed(false);

    addToast(
      "success",
      "Data source added to AI Query",
      `${title || sourceId} is now included as query context.`
    );
  }

  function handleRemoveDataSourceQueryContext(sourceId: string) {
    const targetContext = queryDataSourceContexts.find(
      (item) => item.sourceId === sourceId
    );

    setQueryDataSourceContexts((current) =>
      current.filter((item) => item.sourceId !== sourceId)
    );

    setQuery((currentQuery) =>
      removeDataSourceContextBlock(currentQuery, sourceId)
    );

    addToast(
      "info",
      "Data source context removed",
      targetContext?.title || sourceId
    );
  }

  function handleShowDataSourcePreviewOnMap({
    sourceId,
    title,
    geojson
  }: {
    sourceId: string;
    title: string;
    geojson: unknown;
  }) {
    const normalizedGeoJson = extractGeoJson(geojson);

    if (!normalizedGeoJson) {
      addToast(
        "error",
        "Preview cannot be rendered",
        "The selected data source preview does not contain valid GeoJSON."
      );
      return;
    }

    const layerId = `data-source-preview-${sourceId}`;
    const layerName = title || `Data Source Preview ${sourceId}`;

    const previewLayer: LayerItem = {
      id: layerId,
      name: layerName,
      type: "analysis",
      visible: true,
      color: "#10b981",
      geojson: normalizedGeoJson,
      metadata: {
        __source: "backend",
        sourceKind: "data-source-preview",
        sourceId,
        featureCount: normalizedGeoJson.features.length,
        addedFrom: "Data Sources",
        addedAt: new Date().toISOString()
      }
    };

    setLayerItems((currentLayers) => {
      const withoutExisting = currentLayers.filter((layer) => layer.id !== layerId);
      return [previewLayer, ...withoutExisting];
    });

    handleNavigate("ai-query");
    setRightCollapsed(false);

    addToast(
      "success",
      "Preview added to map",
      `${layerName} rendered with ${normalizedGeoJson.features.length} feature${
        normalizedGeoJson.features.length === 1 ? "" : "s"
      }.`
    );
  }


  function handleDownloadFile(file: OutputFile) {
    const directUrl = file.downloadUrl || file.url;

    if (directUrl) {
      window.open(api.downloadUrl(directUrl), "_blank", "noopener,noreferrer");

      addToast(
        "info",
        "Download started",
        file.name
      );

      return;
    }

    if (isBackendRequestId(summary.requestId)) {
      const encodedFilename = encodeFilePath(file.name);
      const path = `/api/v1/requests/${summary.requestId}/outputs/files/${encodedFilename}`;

      window.open(api.downloadUrl(path), "_blank", "noopener,noreferrer");

      addToast(
        "info",
        "Download requested",
        file.name
      );

      return;
    }

    addToast(
      "warning",
      "File endpoint unavailable",
      "Run a real analysis first so the backend can provide request-specific file URLs."
    );
  }

  async function loadRequestOutputs(requestId: string) {
    setRequestDetails(null);
    setRightActiveTab("analysis");
    setAnalysisStatus("running");
    setMessage(`Loading outputs for ${requestId}...`);

    try {
      const [requestResult, outputsResult, layersResult, filesResult] =
        await Promise.allSettled([
          api.getRequest(requestId),
          api.getRequestOutputs(requestId),
          api.getRequestMapLayers(requestId),
          api.getRequestOutputFiles(requestId)
        ]);

      const merged: GeoQueryResponse = {
        request_id: requestId,
        summary: `Loaded outputs for ${requestId}`
      };

      if (requestResult.status === "fulfilled") {
        Object.assign(merged, requestResult.value);
      }

      if (outputsResult.status === "fulfilled") {
        merged.outputs = outputsResult.value;
      }

      if (layersResult.status === "fulfilled") {
        (merged as Record<string, unknown>).layers = layersResult.value;
      }

      if (filesResult.status === "fulfilled") {
        (merged as Record<string, unknown>).files = filesResult.value;
      }

      setRequestDetails({
        requestId,
        rawRequest:
          requestResult.status === "fulfilled"
            ? requestResult.value
            : merged,
        rawOutputs:
          outputsResult.status === "fulfilled"
            ? outputsResult.value
            : undefined,
        rawMapLayers:
          layersResult.status === "fulfilled"
            ? layersResult.value
            : undefined,
        rawFiles:
          filesResult.status === "fulfilled"
            ? filesResult.value
            : undefined
      });
      openRequestDetailsTab();

      const restoreResult = restoreAiQueryFromRequestPayload(merged);

      if (restoreResult.restored) {
        addToast(
          "info",
          "Request restored in AI Query",
          `Restored ${restoreResult.queryRestored ? "query" : "request context"}${
            restoreResult.datasetCount > 0 ? ` and ${restoreResult.datasetCount} dataset${restoreResult.datasetCount === 1 ? "" : "s"}` : ""
          } from ${requestId}.`
        );
      }

      const requestFailureMessage = getBackendFailureMessage(merged);
      const detectedMissingCapabilities = extractMissingCapabilities(merged);

      setBackendFailureMessage(requestFailureMessage);
      setMissingCapabilities(detectedMissingCapabilities);
      setSuggestedQuery(
        requestFailureMessage
          ? buildSimplifiedQuery(query, detectedMissingCapabilities)
          : ""
      );

      const nextRows = normalizeRankingRows(merged);
      const nextFiles = normalizeFiles(merged);
      const nextLayers = normalizeLayers(merged);

      setRankingRows(nextRows || []);
      setFiles(nextFiles || []);
      setLayerItems(nextLayers || []);

      setSelectedFeatureId(null);
      setSelectedFeature(null);

      setSummary({
        requestId,
        confidence:
          typeof merged.confidence === "number"
            ? `${Math.round(merged.confidence * 100)}%`
            : merged.confidence ? String(merged.confidence) : "",
        executionTime:
          typeof merged.execution_time_ms === "number"
            ? `${(merged.execution_time_ms / 1000).toFixed(1)}s`
            : typeof merged.executionTimeMs === "number"
              ? `${(merged.executionTimeMs / 1000).toFixed(1)}s`
              : "",
        text:
          merged.summary ||
          merged.message ||
          `Outputs loaded for request ${requestId}.`
      });

      handleNavigate("ai-query");
      setAnalysisStatus("success");
      setMessage("Request outputs loaded successfully.");
      setRightCollapsed(false);
      setBottomCollapsed(false);

      addToast(
        "success",
        "Request loaded",
        `Outputs for ${requestId} were loaded into the workspace.`
      );
    } catch {
      setAnalysisStatus("error");
      setMessage("Could not load request outputs.");

      addToast(
        "error",
        "Request load failed",
        `Could not load outputs for ${requestId}.`
      );
    }
  }

  async function handlePreviewPlan() {
    handleNavigate("ai-query");
    setRequestDetails(null);
    setRightActiveTab("analysis");
    setAnalysisStatus("previewing");
    setLayerItems([]);
    setRankingRows([]);
    setFiles([]);
    setSelectedFeatureId(null);
    setSelectedFeature(null);
    setMessage("Generating AI execution plan...");

    const requestPayload = buildGeoQueryRequest(query);

    setRequestDetails({
      requestId: "previewing...",
      rawRequest: {
        status: "previewing",
        kind: "backend_preview",
        submittedPayload: requestPayload
      },
      rawOutputs: undefined,
      rawMapLayers: undefined,
      rawFiles: undefined
    });

    const projectLabel = selectedProjectId
      ? projectLabels[selectedProjectId] || selectedProjectId
      : "";

    const dataSourceLabels = buildSelectedPlanningDataSourceLabels(
      selectedDatasets,
      datasetLabels,
      queryDataSourceContexts
    );

    const fallbackPlanSteps = buildDynamicPlanningSteps(
      query,
      projectLabel,
      dataSourceLabels
    );

    setPlanningSteps(fallbackPlanSteps);
    setPlanningPreviewSource("local-draft");
    setBackendFailureMessage("");
    setMissingCapabilities([]);
    setSuggestedQuery("");

    try {
      const previewResponse = await api.previewPlan(requestPayload);
      const requestId = getResponseRequestId(previewResponse);
      const previewFailureMessage =
        getHardBackendFailureMessage(previewResponse) ||
        getDefinitiveBackendFailureMessage(previewResponse) ||
        getResponseStatusFailureMessage(previewResponse) ||
        getBackendFailureMessage(previewResponse);

      const previewSteps = extractPreviewPlanSteps(previewResponse, fallbackPlanSteps);

      setRequestDetails({
        requestId,
        rawRequest: {
          submittedPayload: requestPayload,
          response: previewResponse,
          frontendDetectedFailure: previewFailureMessage || undefined
        },
        rawOutputs: isRecord(previewResponse) ? previewResponse.outputs : undefined,
        rawMapLayers: readResponseMapPayload(previewResponse),
        rawFiles: readResponseFilesPayload(previewResponse)
      });

      if (previewFailureMessage) {
        const failedPreviewSteps = uniqueNonEmptyStrings([
          `Preview failed: ${previewFailureMessage}`,
          ...previewSteps
        ]);

        setPlanningSteps(failedPreviewSteps);
        setPlanningPreviewSource("backend-failed");
        setBackendFailureMessage(previewFailureMessage);
        setMissingCapabilities(extractMissingCapabilities(previewResponse));
        setSuggestedQuery(buildSimplifiedQuery(query, extractMissingCapabilities(previewResponse)));

        setSummary({
          requestId,
          confidence: "—",
          executionTime: "—",
          text: previewFailureMessage
        });

        setAnalysisStatus("error");
        setMessage(previewFailureMessage);
        openRequestDetailsTab();

        addToast(
          "error",
          "Plan preview failed",
          previewFailureMessage
        );

        return;
      }

      setPlanningSteps(previewSteps);
      setPlanningPreviewSource("backend");
      setBackendFailureMessage("");
      setMissingCapabilities([]);
      setSuggestedQuery("");

      setSummary({
        requestId,
        confidence: getConfidenceText(previewResponse),
        executionTime: getExecutionTimeText(previewResponse),
        text: getBackendSummaryText(previewResponse) || "AI plan preview is ready."
      });

      setAnalysisStatus("success");
      setMessage("AI plan preview is ready.");

      addToast(
        "success",
        "Plan preview ready",
        "The AI execution plan was generated successfully."
      );
    } catch (error) {
      const processingMessage =
        error instanceof Error
          ? error.message
          : "Preview endpoint is unavailable.";

      const failureMessage =
        `${getPlanningFallbackIntro(processingMessage)} ${processingMessage}`;

      setPlanningSteps([
        "Backend AI planner is unavailable. The steps below are a dynamic local preview generated from the current query, project, and selected data sources.",
        failureMessage,
        ...fallbackPlanSteps
      ]);
      setPlanningPreviewSource("local-fallback");

      setRequestDetails({
        requestId: "preview-local-fallback",
        rawRequest: {
          status: "failed",
          ok: false,
          kind: "preview_local_fallback",
          message: failureMessage,
          frontendDetectedFailure: failureMessage,
          errors: [
            {
              message: failureMessage
            }
          ],
          submittedPayload: requestPayload
        },
        rawOutputs: undefined,
        rawMapLayers: [],
        rawFiles: []
      });

      setBackendFailureMessage(failureMessage);
      setMissingCapabilities([]);
      setSuggestedQuery("");

      setSummary({
        requestId: "preview-local-fallback",
        confidence: "—",
        executionTime: "—",
        text: failureMessage
      });

      setAnalysisStatus("error");
      setMessage("Backend planner preview was not used. Dynamic local plan is shown.");
      openRequestDetailsTab();

      addToast(
        "warning",
        "Preview fallback",
        "Preview API is unavailable. A dynamic local plan is displayed."
      );
    }
  }

  async function handleRunAnalysis(queryOverride?: string) {
    const queryToRun =
      typeof queryOverride === "string" && queryOverride.trim()
        ? queryOverride
        : query;

    handleNavigate("ai-query");
    setRequestDetails(null);
    setRightActiveTab("analysis");
    setAnalysisStatus("running");
    setMessage("Running spatial analysis...");

    // Clear old mock output immediately.
    setRankingRows([]);
    setFiles([]);
    setLayerItems([]);
    setSelectedFeatureId(null);
    setSelectedFeature(null);
    setBackendFailureMessage("");
    setMissingCapabilities([]);
    setSuggestedQuery("");

    setSummary({
      requestId: "running...",
      confidence: "—",
      executionTime: "—",
      text: "Running backend spatial analysis..."
    });

    setRightCollapsed(false);
    setBottomCollapsed(false);

    addToast(
      "info",
      "Analysis started",
      "Spatial analysis is running. Previous mock outputs were cleared."
    );

    let response: GeoQueryResponse | null = null;
    const requestPayload = buildGeoQueryRequest(queryToRun);

    setRequestDetails({
      requestId: "running...",
      rawRequest: {
        status: "running",
        kind: "backend_analysis",
        submittedPayload: requestPayload
      },
      rawOutputs: undefined,
      rawMapLayers: undefined,
      rawFiles: undefined
    });

    try {
      const rawResponse = await api.runGeoQuery(requestPayload);

      response = makeJsonSafe(
        unwrapApiPayload(rawResponse)
      ) as GeoQueryResponse;
    } catch (error) {
      const errorPayload = extractErrorPayload(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown frontend/API error.";

      const failureMessage =
        `API request failed before a backend analysis response was returned. ${errorMessage}`;

      setRankingRows([]);
      setFiles([]);
      setLayerItems([]);

      setBackendFailureMessage(failureMessage);
      setMissingCapabilities([]);
      setSuggestedQuery("");

      setRequestDetails({
        requestId: "api-request-failed",
        rawRequest: {
          status: "frontend_api_error",
          message: failureMessage,
          errorPayload,
          submittedPayload: requestPayload
        },
        rawOutputs: undefined,
        rawMapLayers: undefined,
        rawFiles: undefined
      });

      setSummary({
        requestId: "api-request-failed",
        confidence: "—",
        executionTime: "—",
        text: failureMessage
      });

      setAnalysisStatus("error");
      setMessage(failureMessage);
      openRequestDetailsTab();

      addToast("error", "Analysis API failed", failureMessage);
      return;
    }

    try {
      const requestId = getResponseRequestId(response);
      const hardFailureMessage = getHardBackendFailureMessage(response);
      const definitiveFailureMessage = getDefinitiveBackendFailureMessage(response);
      const backendFailureMessage = getBackendFailureMessage(response);
      const responseStatusFailureMessage = getResponseStatusFailureMessage(response);
      const failureMessage =
        hardFailureMessage ||
        definitiveFailureMessage ||
        backendFailureMessage ||
        responseStatusFailureMessage;
      const detectedMissingCapabilities = extractMissingCapabilities(response);

      const nextSuggestedQuery = failureMessage
        ? buildSimplifiedQuery(queryToRun, detectedMissingCapabilities)
        : "";

      const nextRows = failureMessage ? [] : normalizeRankingRows(response);
      const nextFiles = failureMessage ? [] : normalizeFiles(response);
      const nextLayers = failureMessage ? [] : normalizeLayers(response);

      setRankingRows(nextRows || []);
      setFiles(nextFiles || []);
      setLayerItems(nextLayers || []);

      setBackendFailureMessage(failureMessage);
      setMissingCapabilities(detectedMissingCapabilities);
      setSuggestedQuery(nextSuggestedQuery);

      setRequestDetails({
        requestId,
        rawRequest: {
          submittedPayload: requestPayload,
          response,
          frontendDetectedFailure: failureMessage || undefined
        },
        rawOutputs: isRecord(response) ? response.outputs : undefined,
        rawMapLayers: readResponseMapPayload(response),
        rawFiles: readResponseFilesPayload(response)
      });

      setSummary({
        requestId,
        confidence: failureMessage ? "—" : getConfidenceText(response),
        executionTime: failureMessage ? "—" : getExecutionTimeText(response),
        text: failureMessage || getBackendSummaryText(response)
      });

      if (failureMessage) {
        setAnalysisStatus("error");
        setMessage(failureMessage);
        openRequestDetailsTab();

        addToast(
          "error",
          "Backend analysis failed",
          failureMessage
        );

        return;
      }

      const lastChanceFailureMessage =
        getHardBackendFailureMessage(response) ||
        getDefinitiveBackendFailureMessage(response) ||
        getResponseStatusFailureMessage(response) ||
        getBackendFailureMessage(response);

      if (lastChanceFailureMessage) {
        setRankingRows([]);
        setFiles([]);
        setLayerItems([]);

        setBackendFailureMessage(lastChanceFailureMessage);
        setSummary({
          requestId,
          confidence: "—",
          executionTime: "—",
          text: lastChanceFailureMessage
        });

        setAnalysisStatus("error");
        setMessage(lastChanceFailureMessage);
        openRequestDetailsTab();

        addToast(
          "error",
          "Backend analysis failed",
          lastChanceFailureMessage
        );

        return;
      }

      setAnalysisStatus("success");
      setMessage("Analysis completed successfully.");

      addToast(
        "success",
        "Analysis completed",
        "Ranking table, map layers, files and report outputs are ready."
      );
    } catch (error) {
      const errorPayload = extractErrorPayload(error);
      const processingMessage =
        error instanceof Error
          ? error.message
          : "Unknown response processing error.";

      const failureMessage =
        `Frontend failed while processing backend response. ${processingMessage}`;

      setRankingRows([]);
      setFiles([]);
      setLayerItems([]);

      setBackendFailureMessage(failureMessage);
      setMissingCapabilities([]);
      setSuggestedQuery("");

      setRequestDetails({
        requestId: response ? getResponseRequestId(response) : "response-processing-failed",
        rawRequest: {
          status: "frontend_response_processing_error",
          message: failureMessage,
          backendResponse: response,
          errorPayload
        },
        rawOutputs: response && isRecord(response) ? response.outputs : undefined,
        rawMapLayers: response ? readResponseMapPayload(response) : undefined,
        rawFiles: response ? readResponseFilesPayload(response) : undefined
      });

      setSummary({
        requestId: response ? getResponseRequestId(response) : "response-processing-failed",
        confidence: "—",
        executionTime: "—",
        text: failureMessage
      });

      setAnalysisStatus("error");
      setMessage(failureMessage);
      openRequestDetailsTab();

      addToast(
        "error",
        "Response processing failed",
        failureMessage
      );
    }
  }

  function openRequestDetailsTab() {
    setRightActiveTab("request-details");
    setRightCollapsed(false);
  }

  function openAnalysisTab() {
    setRightActiveTab("analysis");
    setRightCollapsed(false);
  }

  function handleRunSimplifiedQuery() {
    const nextQuery =
      suggestedQuery || buildSimplifiedQuery(query, missingCapabilities);

    setQuery(nextQuery);
    void handleRunAnalysis(nextQuery);
  }

  return (
    <div className="app-shell flex">
      <LeftSidebar
        collapsed={leftCollapsed}
        activeView={activeView}
        onToggle={() => setLeftCollapsed((value) => !value)}
        onNavigate={handleNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeView={activeView}
          onToggleLeft={() => setLeftCollapsed((value) => !value)}
          onMaximizeMap={maximizeMap}
          apiHealthText={apiHealthText}
          analysisStatus={analysisStatus}
        />

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            {activeView === "ai-query" && (

              <TopQueryPanel
                collapsed={topCollapsed}
                onToggle={() => setTopCollapsed((value) => !value)}
                query={query}
                onQueryChange={setQuery}
                selectedProject={selectedProjectId}
                availableProjects={availableProjects}
                projectLabels={projectLabels}
                selectedDatasets={selectedDatasets}
                availableDatasets={availableDatasets}
                datasetLabels={datasetLabels}
                onProjectChange={handleProjectChange}
                onAddDataset={handleAddDataset}
                onRemoveDataset={handleRemoveDataset}
                status={analysisStatus}
                message={message}
                planningPreviewSource={planningPreviewSource}
                planningSteps={planningSteps}
                dataSourceContexts={queryDataSourceContexts}
                onRemoveDataSourceContext={handleRemoveDataSourceQueryContext}
                onPreviewPlan={handlePreviewPlan}
                onRunAnalysis={handleRunAnalysis}
                onOpenRequestDetails={openRequestDetailsTab}
              />
            )}

            <div className="relative min-h-0 flex-1">
              <MapView
                layers={layerItems}
                onToggleLayer={toggleLayer}
                onShowAllLayers={showAllLayers}
                onHideAllLayers={hideAllLayers}
                controlsSuppressed={activeView !== "ai-query"}
                isLoading={isMapLoading}
                loadingMessage={message}
                selectedFeatureId={selectedFeatureId}
                selectedFeature={selectedFeature}
                zoomToLayerRequest={zoomToLayerRequest}
                onFeatureSelect={handleMapFeatureSelect}
                onClearSelection={handleClearFeatureSelection}
              />

              {activeView !== "ai-query" && (
                <WorkspacePanel
                  activeView={activeView}
                  onClose={() => handleNavigate("ai-query")}
                  onOpenRequest={loadRequestOutputs}
                  onNavigate={handleNavigate}
                  onShowDataSourcePreviewOnMap={handleShowDataSourcePreviewOnMap}
                  onUseDataSourceInQueryContext={handleUseDataSourceInQueryContext}
                  mapLayers={layerItems}
                  onToggleMapLayer={toggleLayer}
                  onShowAllMapLayers={showAllLayers}
                  onHideAllMapLayers={hideAllLayers}
                  onZoomToMapLayer={handleZoomToMapLayer}
                  onRemoveMapLayer={handleRemoveMapLayer}
                />
              )}
            </div>

            <BottomDrawer
              collapsed={bottomCollapsed}
              onToggle={() => setBottomCollapsed((value) => !value)}
              rankingRows={rankingRows}
              files={files}
              requestId={summary.requestId}
              selectedParcelId={selectedFeatureId}
              onSelectRankingRow={handleRankingRowSelect}
              onDownloadFile={handleDownloadFile}
            />
          </main>

          <RightPanel
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((value) => !value)}
            layers={layerItems}
            onToggleLayer={toggleLayer}
            onShowAllLayers={showAllLayers}
            onHideAllLayers={hideAllLayers}
            summary={summary}
            analysisStatus={analysisStatus}
            apiHealthText={apiHealthText}
            hasRequestDetails={Boolean(requestDetails)}
            activeTab={rightActiveTab}
            onTabChange={(tab) => {
              if (tab === "analysis") {
                openAnalysisTab();
              } else {
                openRequestDetailsTab();
              }
            }}
            requestDetails={requestDetails}
            onOpenRequestDetails={openRequestDetailsTab}
            onRunSimplifiedQuery={handleRunSimplifiedQuery}
          />
        </div>
      </div>

      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}
