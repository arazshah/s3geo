export type ApiHealthResponse = {
  status?: string;
  service?: string;
  version?: string;
  api_version?: string;
  cors?: string;
  plugin_registry?: string;
  [key: string]: unknown;
};

export type GeoQueryRequest = {
  project_id?: string;
  query: string;
  datasets?: string[];
  dataset_ids?: string[];
  data_source_ids?: string[];
  inputs?: Record<string, unknown>;
  context?: {
    input_roles?: Record<string, string>;
    data_sources?: Array<{
      source_id: string;
      data_source_id?: string;
      title?: string;
      role?: string;
      input_role?: string;
      added_at?: string;
      added_from?: string;
      feature_count?: number;
      geometry_types?: string[];
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  options?: {
    generate_report?: boolean;
    generate_map_layers?: boolean;
    return_geojson?: boolean;
    return_ranking_table?: boolean;
  };
  [key: string]: unknown;
};

export type GeoQueryResponse = {
  request_id?: string;
  requestId?: string;
  id?: string;
  status?: "success" | "error" | "running" | "queued" | string;
  confidence?: number | string;
  execution_time_ms?: number;
  executionTimeMs?: number;
  summary?: string;
  message?: string;
  warnings?: string[];
  layers?: Array<{
    id?: string;
    name: string;
    type?: string;
    visible?: boolean;
    source?: string;
    style?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  map_layers?: unknown;
  ranking_table?: Array<Record<string, unknown>>;
  files?: Array<{
    name: string;
    url?: string;
    size?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  outputs?: Record<string, unknown>;
  raw?: unknown;
  [key: string]: unknown;
};

export class ApiError extends Error {
  status: number;
  path: string;
  data: unknown;

  constructor(message: string, status: number, path: string, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.data = data;
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

const ENV_RUN_PATH = import.meta.env.VITE_API_RUN_PATH || "/api/v1/query";
const ENV_PREVIEW_PATH =
  import.meta.env.VITE_API_PREVIEW_PATH || "/api/v1/planner/intent";

function uniquePaths(paths: string[]) {
  return Array.from(
    new Set(
      paths
        .filter(Boolean)
        .map((path) => (path.startsWith("/") ? path : `/${path}`))
    )
  );
}

const HEALTH_PATHS = uniquePaths([
  "/api/v1/health",
  "/health"
]);

const RUN_QUERY_PATHS = uniquePaths([
  ENV_RUN_PATH,
  "/api/v1/query",
  "/query"
]);

const PREVIEW_QUERY_PATHS = uniquePaths([
  ENV_PREVIEW_PATH,
  "/api/v1/planner/intent",
  "/planner/intent"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}


function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();

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
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data)) {
    if ("detail" in data) {
      const detail = data.detail;

      if (typeof detail === "string") {
        return detail;
      }

      return JSON.stringify(detail);
    }

    if ("message" in data) {
      return String(data.message);
    }

    if ("error" in data) {
      return String(data.error);
    }
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return fallback;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = extractErrorMessage(
      data,
      `API request failed with status ${response.status}`
    );

    throw new ApiError(message, response.status, normalizedPath, data);
  }

  return data as T;
}

async function getWithFallback<T>(paths: string[]): Promise<T> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await request<T>(path);
    } catch (error) {
      lastError = error;

      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 405)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No matching GET endpoint found.");
}

async function postWithFallback<T>(
  paths: string[],
  payload: unknown
): Promise<T> {
  const tried: string[] = [];
  let lastError: unknown = null;

  for (const path of paths) {
    tried.push(path);

    try {
      return await request<T>(path, {
        method: "POST",
        body: safeJsonStringify(payload)
      });
    } catch (error) {
      lastError = error;

      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 405)
      ) {
        continue;
      }

      throw error;
    }
  }

  if (lastError instanceof ApiError) {
    throw new ApiError(
      `No matching API endpoint found. Tried: ${tried.join(", ")}`,
      lastError.status,
      lastError.path,
      lastError.data
    );
  }

  throw new Error(`No matching API endpoint found. Tried: ${tried.join(", ")}`);
}

function extractRequestId(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const direct =
    payload.request_id ??
    payload.requestId ??
    payload.id ??
    payload.request?.valueOf();

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  for (const key of ["data", "result", "request", "job"]) {
    const nested = payload[key];

    if (isRecord(nested)) {
      const nestedId = extractRequestId(nested);

      if (nestedId) {
        return nestedId;
      }
    }
  }

  return null;
}

function findArrayByKeys(
  payload: unknown,
  keys: string[],
  depth = 0
): unknown[] | null {
  if (depth > 5) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value) || Array.isArray(value)) {
      const found = findArrayByKeys(value, keys, depth + 1);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function normalizeLayerPayload(payload: unknown): GeoQueryResponse["layers"] | undefined {
  const array = findArrayByKeys(payload, [
    "layers",
    "map_layers",
    "mapLayers",
    "items",
    "features"
  ]);

  if (!array) {
    return undefined;
  }

  return array.map((item, index) => {
    const record = toRecord(item);
    const properties = toRecord(record.properties);

    return {
      ...properties,
      ...record,
      id: String(
        record.id ??
          properties.id ??
          record.layer_id ??
          properties.layer_id ??
          `layer-${index + 1}`
      ),
      name: String(
        record.name ??
          properties.name ??
          record.title ??
          properties.title ??
          record.layer_name ??
          properties.layer_name ??
          `Layer ${index + 1}`
      ),
      type: String(record.type ?? properties.type ?? "vector"),
      visible:
        typeof record.visible === "boolean"
          ? record.visible
          : typeof properties.visible === "boolean"
            ? properties.visible
            : true,
      source: String(record.source ?? properties.source ?? ""),
      style: isRecord(record.style)
        ? record.style
        : isRecord(properties.style)
          ? properties.style
          : undefined,
      geojson:
        record.geojson ??
        record.geo_json ??
        record.feature_collection ??
        record.featureCollection ??
        record.data ??
        properties.geojson ??
        properties.geo_json ??
        properties.feature_collection ??
        properties.featureCollection ??
        properties.data
    };
  });
}

function normalizeFilesPayload(payload: unknown): GeoQueryResponse["files"] | undefined {
  const array = findArrayByKeys(payload, [
    "files",
    "output_files",
    "outputFiles",
    "items",
    "documents"
  ]);

  if (!array) {
    return undefined;
  }

  return array.map((item, index) => {
    if (typeof item === "string") {
      return {
        name: item,
        size: "—"
      };
    }

    const record = toRecord(item);

    return {
      name: String(
        record.name ??
          record.filename ??
          record.file_name ??
          record.path ??
          `file-${index + 1}`
      ),
      url:
        typeof record.url === "string"
          ? record.url
          : typeof record.href === "string"
            ? record.href
            : undefined,
      size: String(record.size ?? record.file_size ?? "—"),
      type:
        typeof record.type === "string"
          ? record.type
          : typeof record.mime_type === "string"
            ? record.mime_type
            : undefined
    };
  });
}

function normalizeRankingPayload(payload: unknown): GeoQueryResponse["ranking_table"] | undefined {
  const array = findArrayByKeys(payload, [
    "ranking_table",
    "rankingTable",
    "ranking",
    "rows",
    "table",
    "results",
    "candidates"
  ]);

  if (!array) {
    return undefined;
  }

  return array
    .filter((item) => isRecord(item))
    .map((item) => item as Record<string, unknown>);
}

async function enrichQueryResponse(
  submittedResponse: unknown
): Promise<GeoQueryResponse> {
  const baseRecord = toRecord(submittedResponse);
  const requestId = extractRequestId(submittedResponse);

  const enriched: GeoQueryResponse = {
    ...baseRecord,
    request_id: requestId ?? String(baseRecord.request_id ?? ""),
    raw: submittedResponse
  };

  if (!requestId) {
    return enriched;
  }

  const [requestResult, outputsResult, layersResult, filesResult] =
    await Promise.allSettled([
      api.getRequest(requestId),
      api.getRequestOutputs(requestId),
      api.getRequestMapLayers(requestId),
      api.getRequestOutputFiles(requestId)
    ]);

  if (requestResult.status === "fulfilled" && isRecord(requestResult.value)) {
    Object.assign(enriched, requestResult.value);
  }

  if (outputsResult.status === "fulfilled" && isRecord(outputsResult.value)) {
    enriched.outputs = outputsResult.value;
  }

  if (layersResult.status === "fulfilled") {
    const layers = normalizeLayerPayload(layersResult.value);

    if (layers?.length) {
      enriched.layers = layers;
    }
  }

  if (filesResult.status === "fulfilled") {
    const files = normalizeFilesPayload(filesResult.value);

    if (files?.length) {
      enriched.files = files;
    }
  }

  if (!enriched.ranking_table && outputsResult.status === "fulfilled") {
    const ranking = normalizeRankingPayload(outputsResult.value);

    if (ranking?.length) {
      enriched.ranking_table = ranking;
    }
  }

  if (!enriched.layers && outputsResult.status === "fulfilled") {
    const layers = normalizeLayerPayload(outputsResult.value);

    if (layers?.length) {
      enriched.layers = layers;
    }
  }

  if (!enriched.files && outputsResult.status === "fulfilled") {
    const files = normalizeFilesPayload(outputsResult.value);

    if (files?.length) {
      enriched.files = files;
    }
  }

  return enriched;
}

function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function segment(value: string) {
  return encodeURIComponent(value);
}

export const api = {
  baseUrl: API_BASE_URL,

  paths: {
    healthCandidates: HEALTH_PATHS,
    runCandidates: RUN_QUERY_PATHS,
    previewCandidates: PREVIEW_QUERY_PATHS
  },

  health(): Promise<ApiHealthResponse> {
    return getWithFallback<ApiHealthResponse>(HEALTH_PATHS);
  },

  async runGeoQuery(payload: GeoQueryRequest): Promise<GeoQueryResponse> {
    const submitted = await postWithFallback<unknown>(RUN_QUERY_PATHS, payload);
    return enrichQueryResponse(submitted);
  },

  previewPlan(payload: GeoQueryRequest): Promise<GeoQueryResponse> {
    return postWithFallback<GeoQueryResponse>(PREVIEW_QUERY_PATHS, payload);
  },

  getRequest(requestId: string): Promise<GeoQueryResponse> {
    return request<GeoQueryResponse>(`/api/v1/requests/${requestId}`);
  },

  getRequestOutputs(requestId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`/api/v1/requests/${requestId}/outputs`);
  },

  getRequestMapLayers(requestId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/requests/${requestId}/map-layers`);
  },

  getRequestOutputFiles(requestId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/requests/${requestId}/outputs/files`);
  },

  getRequestResult(requestId: string): Promise<GeoQueryResponse> {
    return request<GeoQueryResponse>(`/api/v1/requests/${requestId}`);
  },

  listRequests(): Promise<unknown> {
    return request<unknown>("/api/v1/requests");
  },

  listProjects(): Promise<unknown> {
    return request<unknown>("/api/v1/projects");
  },

  createProject(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/projects", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

  listUploads(): Promise<unknown> {
    return request<unknown>("/api/v1/uploads");
  },

  listPlugins(): Promise<unknown> {
    return request<unknown>("/api/v1/plugins");
  },

  listWeights(): Promise<unknown> {
    return request<unknown>("/api/v1/weights");
  },

  getRuntimeSettings(): Promise<unknown> {
    return request<unknown>("/api/v1/settings/runtime");
  },

  async uploadVector(file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/v1/uploads/vector`, {
      method: "POST",
      body: formData
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        extractErrorMessage(data, `Vector upload failed with status ${response.status}`),
        response.status,
        "/api/v1/uploads/vector",
        data
      );
    }

    return data;
  },

  async uploadRaster(file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/v1/uploads/raster`, {
      method: "POST",
      body: formData
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        extractErrorMessage(data, `Raster upload failed with status ${response.status}`),
        response.status,
        "/api/v1/uploads/raster",
        data
      );
    }

    return data;
  },

  downloadUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }

    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${API_BASE_URL}${normalizedPath}`;
  },

getProject(projectId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/projects/${segment(projectId)}`);
  },

listProjectDataSources(projectId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/projects/${segment(projectId)}/data-sources`);
  },

getUpload(uploadId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/uploads/${segment(uploadId)}`);
  },

getUploadFileUrl(uploadId: string): string {
    return apiUrl(`/api/v1/uploads/${segment(uploadId)}/file`);
  },

downloadUploadFileUrl(uploadId: string): string {
    return apiUrl(`/api/v1/uploads/${segment(uploadId)}/file`);
  },

getDataSource(uploadId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/data-sources/${segment(uploadId)}`);
  },

previewDataSource(uploadId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/data-sources/${segment(uploadId)}/preview`);
  },

updateDataSource(uploadId: string, payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>(`/api/v1/data-sources/${segment(uploadId)}`, {
      method: "PATCH",
      body: safeJsonStringify(payload)
    });
  },

deleteDataSource(uploadId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/data-sources/${segment(uploadId)}`, {
      method: "DELETE"
    });
  },

registerCsvTableSource(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/data-sources/csv-table", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

registerPostgisSource(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/data-sources/postgis", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

registerUrlSource(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/data-sources/url", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

registerWfsSource(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/data-sources/wfs", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

registerWmsSource(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/data-sources/wms", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

listRequestOutputFiles(requestId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/requests/${segment(requestId)}/outputs/files`);
  },

getRequestOutputFileUrl(requestId: string, filename: string): string {
    return apiUrl(`/api/v1/requests/${segment(requestId)}/outputs/files/${segment(filename)}`);
  },

downloadRequestOutputFileUrl(requestId: string, filename: string): string {
    return apiUrl(`/api/v1/requests/${segment(requestId)}/outputs/files/${segment(filename)}`);
  },

getRequestDocumentUrl(requestId: string, filename: string): string {
    return apiUrl(`/api/v1/requests/${segment(requestId)}/documents/${segment(filename)}`);
  },

downloadRequestDocumentUrl(requestId: string, filename: string): string {
    return apiUrl(`/api/v1/requests/${segment(requestId)}/documents/${segment(filename)}`);
  },

saveRequestOutputs(requestId: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return request<unknown>(`/api/v1/requests/${segment(requestId)}/outputs/save`, {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

getPlugin(pluginId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/plugins/${segment(pluginId)}`);
  },

patchPlugin(pluginId: string, payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>(`/api/v1/plugins/${segment(pluginId)}`, {
      method: "PATCH",
      body: safeJsonStringify(payload)
    });
  },

getPluginConfig(pluginId: string): Promise<unknown> {
    return request<unknown>(`/api/v1/plugins/${segment(pluginId)}/config`);
  },

putPluginConfig(pluginId: string, payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>(`/api/v1/plugins/${segment(pluginId)}/config`, {
      method: "PUT",
      body: safeJsonStringify(payload)
    });
  },

reloadWeights(): Promise<unknown> {
    return request<unknown>("/api/v1/weights/reload", {
      method: "POST"
    });
  },

saveWeights(payload: Record<string, unknown> = {}): Promise<unknown> {
    return request<unknown>("/api/v1/weights/save", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

applyWeightProposal(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/weights/proposals/apply", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

llmSmokeTest(payload: Record<string, unknown> = {}): Promise<unknown> {
    return request<unknown>("/api/v1/settings/llm/smoke-test", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

submitFeedback(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/feedback", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  },

planIntent(payload: Record<string, unknown>): Promise<unknown> {
    return request<unknown>("/api/v1/planner/intent", {
      method: "POST",
      body: safeJsonStringify(payload)
    });
  }
};
