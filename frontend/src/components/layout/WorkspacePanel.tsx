import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  FileText,
  FolderOpen,
  HeartPulse,
  Home,
  Layers,
  Loader2,
  Package,
  Plug,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  UploadCloud,
  X
} from "lucide-react";

import type { LayerItem } from "../../data/mockSpatialData";
import { api } from "../../lib/api";
import type { NavView } from "../../types/ui";
import { cx } from "../../utils/cx";
import { extractGeoJson } from "../../utils/geojson";
import { LlmSettingsCard } from "./LlmSettingsCard";

type DataSourcePreviewMapPayload = {
  sourceId: string;
  title: string;
  geojson: unknown;
};

type DataSourceQueryContextPayload = {
  sourceId: string;
  title: string;
  metadata: unknown;
  preview: unknown;
};

type WorkspacePanelProps = {
  activeView: NavView;
  onClose: () => void;
  onOpenRequest: (requestId: string) => void;
  onNavigate?: (view: NavView) => void;
  onShowDataSourcePreviewOnMap?: (payload: DataSourcePreviewMapPayload) => void;
  onUseDataSourceInQueryContext?: (payload: DataSourceQueryContextPayload) => void;
  mapLayers?: LayerItem[];
  onToggleMapLayer?: (layerId: string) => void;
  onShowAllMapLayers?: () => void;
  onHideAllMapLayers?: () => void;
  onZoomToMapLayer?: (layerId: string) => void;
  onRemoveMapLayer?: (layerId: string) => void;
};

type LoadState = "idle" | "loading" | "success" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload)) return [];

  for (const key of [
    "items",
    "data",
    "results",
    "records",
    "requests",
    "projects",
    "uploads",
    "files",
    "documents",
    "reports",
    "plugins",
    "weights",
    "data_sources",
    "dataSources",
    "sources"
  ]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
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

function readRequestId(record: unknown) {
  return readText(record, ["request_id", "requestId", "id"], "");
}

function readProjectId(record: unknown) {
  return readText(
    record,
    ["project_id", "projectId", "id", "slug", "uuid", "project_uuid"],
    ""
  );
}

function readProjectTitle(record: unknown, fallbackId = "") {
  return (
    readText(
      record,
      [
        "name",
        "title",
        "project_name",
        "projectName",
        "label",
        "display_name",
        "displayName",
        "slug"
      ],
      ""
    ) || (fallbackId ? `Project ${fallbackId}` : "Project")
  );
}

function readCollectionCount(record: unknown, keys: string[]) {
  if (!isRecord(record)) return null;

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) return value.length;

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function formatCount(value: number | null) {
  return value === null ? "—" : String(value);
}

function projectStatusLabel(status: string) {
  return status.trim() ? status : "Backend Project";
}

function projectStatusClass(status: string) {
  return status.trim()
    ? statusClass(status)
    : "bg-slate-100 text-slate-600";
}

function isErrorMessage(value: string) {
  const normalized = value.toLowerCase();

  return (
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("could not") ||
    normalized.includes("unable")
  );
}

function buildProjectDataSourcesMessage(
  projectId: string,
  _payload: unknown,
  count: number
) {
  void _payload;

  if (count > 0) {
    return `Loaded ${count} attached project data source${count === 1 ? "" : "s"} for ${projectId}.`;
  }

  return `No attached project data sources were returned for ${projectId}. The documented endpoint GET /projects/{project_id}/data-sources returned an empty collection. Global uploads are not shown here unless the backend attaches them to this project.`;
}

function readStatus(record: unknown, fallback = "ready") {
  return readText(record, ["status", "state", "health", "type"], fallback);
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("offline")
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    normalized.includes("running") ||
    normalized.includes("queued") ||
    normalized.includes("processing")
  ) {
    return "bg-blue-50 text-blue-700";
  }

  if (
    normalized.includes("warning") ||
    normalized.includes("pending") ||
    normalized.includes("draft")
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

function titleForView(view: NavView) {
  const titles: Record<NavView, string> = {
    dashboard: "Dashboard",
    "ai-query": "AI Query",
    projects: "Projects",
    uploads: "Uploads",
    "data-sources": "Data Sources",
    "map-layers": "Map Layers",
    outputs: "Outputs",
    reports: "Reports",
    plugins: "Plugins",
    weights: "Weights",
    settings: "Settings",
    "system-health": "System Health"
  };

  return titles[view];
}

function iconForView(view: NavView) {
  if (view === "dashboard") return <Home size={18} />;
  if (view === "projects") return <FolderOpen size={18} />;
  if (view === "uploads") return <UploadCloud size={18} />;
  if (view === "data-sources") return <Database size={18} />;
  if (view === "map-layers") return <Layers size={18} />;
  if (view === "outputs") return <BarChart3 size={18} />;
  if (view === "reports") return <FileText size={18} />;
  if (view === "plugins") return <Plug size={18} />;
  if (view === "weights") return <SlidersHorizontal size={18} />;
  if (view === "settings") return <Settings size={18} />;
  if (view === "system-health") return <HeartPulse size={18} />;
  return <Package size={18} />;
}

function EmptyPanel({
  title = "No data available",
  message,
  actionLabel,
  onAction,
  tone = "neutral"
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "info" | "warning";
}) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "info"
        ? "border-blue-100 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-500";

  const iconClasses =
    tone === "warning"
      ? "text-amber-600"
      : tone === "info"
        ? "text-blue-700"
        : "text-slate-400";

  return (
    <div
      className={cx(
        "flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed p-4",
        toneClasses
      )}
    >
      <div className="max-w-md text-center">
        <div className={cx("mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm", iconClasses)}>
          <Package size={22} />
        </div>
        <div className="text-sm font-extrabold text-slate-800">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{message}</div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="secondary-button mx-auto mt-4 h-8 px-3 text-xs"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-blue-100 bg-blue-50/40">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <div className="text-sm font-extrabold text-slate-800">Loading {title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          Reading the latest data from the backend API. This workspace will update automatically when the request finishes.
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({
  title,
  message,
  onRetry
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-red-700">
        <AlertTriangle size={18} />
        Could not load {title}
      </div>
      <div className="text-xs leading-5 text-red-700">
        {message || "The backend did not return a readable error message."}
      </div>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-red-100 bg-white px-3 text-xs font-extrabold text-red-700 transition hover:bg-red-50"
      >
        <RefreshCw size={13} />
        Retry
      </button>
    </div>
  );
}

function RecordCard({
  item,
  onOpenRequest
}: {
  item: unknown;
  onOpenRequest?: (requestId: string) => void;
}) {
  const requestId = readRequestId(item);
  const title =
    readText(item, ["name", "title", "project_name", "filename", "file_name"], "") ||
    requestId ||
    "Record";

  const status = readText(item, ["status", "state", "type"], "ready");
  const created = readText(item, ["created_at", "createdAt", "timestamp", "updated_at"], "—");
  const description = readText(item, ["query", "prompt", "description", "summary", "message"], "—");

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-slate-900">{title}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{description}</div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            status.toLowerCase().includes("error")
              ? "bg-red-50 text-red-700"
              : status.toLowerCase().includes("running")
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700"
          )}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div>
          <span className="font-bold">ID:</span>{" "}
          <span className="break-all">{requestId || readText(item, ["id", "upload_id"], "—")}</span>
        </div>
        <div>
          <span className="font-bold">Created:</span> {created}
        </div>
      </div>

      {requestId && onOpenRequest && (
        <button
          onClick={() => onOpenRequest(requestId)}
          className="secondary-button mt-4 h-8 px-3 text-xs"
        >
          Open Request Outputs
        </button>
      )}
    </div>
  );
}

function FieldLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 justify-between gap-3 text-[11px] text-slate-500">
      <span className="shrink-0 font-bold">{label}</span>
      <span className="truncate text-right">{value || "—"}</span>
    </div>
  );
}

type ProjectCardProps = {
  item: unknown;
  busyProjectId?: string;
  selected?: boolean;
  onOpenProject: (projectId: string) => void;
  onLoadDataSources: (projectId: string) => void;
};

function ProjectCard({
  item,
  busyProjectId,
  selected = false,
  onOpenProject,
  onLoadDataSources
}: ProjectCardProps) {
  const projectId = readProjectId(item);
  const title = readProjectTitle(item, projectId);
  const status = readStatus(item, "");
  const description = readText(
    item,
    ["description", "summary", "message"],
    "Project metadata is available from the backend."
  );
  const updated = readText(item, ["updated_at", "created_at", "createdAt"], "—");
  const dataSourcesCount = readCollectionCount(item, [
    "data_sources",
    "dataSources",
    "sources",
    "datasets",
    "uploads",
    "files",
    "data_source_count",
    "data_sources_count",
    "dataSourceCount",
    "source_count",
    "sources_count",
    "dataset_count",
    "datasets_count",
    "upload_count",
    "uploads_count"
  ]);
  const requestsCount = readCollectionCount(item, [
    "requests",
    "analyses",
    "analysis_requests",
    "request_count",
    "requests_count",
    "analysis_count",
    "analyses_count"
  ]);
  const isBusy = Boolean(projectId && busyProjectId === projectId);
  const statusBadgeLabel = selected ? "Selected" : projectStatusLabel(status);
  const statusBadgeClass = selected
    ? "bg-blue-50 text-blue-700"
    : projectStatusClass(status);

  return (
    <div
      className={cx(
        "min-w-0 rounded-2xl border p-4 shadow-sm transition",
        selected
          ? "border-blue-300 bg-blue-50/30 ring-2 ring-blue-100"
          : "border-slate-200 bg-white hover:border-blue-100 hover:shadow-md"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FolderOpen size={16} className="shrink-0 text-blue-700" />
            <div className="truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {description}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            statusBadgeClass
          )}
        >
          {statusBadgeLabel}
        </span>
      </div>

      <div className="space-y-1.5 rounded-xl bg-slate-50 p-3">
        <FieldLine label="Project ID" value={projectId || "—"} />
        <FieldLine label="Updated" value={updated} />
        <FieldLine
          label="Created"
          value={readText(item, ["created_at", "createdAt"], "—")}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-blue-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
            Attached Sources
          </div>
          <div className="mt-1 text-sm font-extrabold text-blue-900" title="Count comes from the project's attached uploads/data_sources fields. Global uploads are not counted here unless the backend attaches them to the project.">
            {formatCount(dataSourcesCount)}
          </div>
        </div>

        <div className="rounded-xl bg-purple-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-purple-400">
            Requests
          </div>
          <div className="mt-1 text-sm font-extrabold text-purple-900">
            {formatCount(requestsCount)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          disabled={!projectId || isBusy}
          onClick={() => onOpenProject(projectId)}
          className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="Load project detail from backend"
        >
          {isBusy ? <Loader2 size={13} className="animate-spin" /> : null}
          Open Project
        </button>

        <button
          disabled={!projectId || isBusy}
          onClick={() => onLoadDataSources(projectId)}
          className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="Load project data sources from backend"
        >
          Data Sources
        </button>
      </div>
    </div>
  );
}

function ProjectCreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("Frontend Test Project");
  const [description, setDescription] = useState("Created from smart-spatial-frontend");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");

  async function createProject() {
    if (!name.trim()) {
      setMessageTone("error");
      setMessage("Project name is required.");
      return;
    }

    setCreating(true);
    setMessage("");
    setMessageTone("info");

    try {
      const created = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        metadata: {
          source: "frontend-operational-test",
          created_from: "workspace-projects-panel"
        }
      });

      const createdId = readProjectId(created) || readText(created, ["project", "result"], "created");
      const createdTitle = readProjectTitle(created, createdId);

      setMessageTone("success");
      setMessage(`Project created: ${createdTitle}${createdId ? ` (${createdId})` : ""}`);
      onCreated();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  }

  const messageClass =
    messageTone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : messageTone === "error"
        ? "border-red-100 bg-red-50 text-red-700"
        : "border-blue-100 bg-white text-blue-800";

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-blue-950">
            Create Project
          </div>
          <div className="mt-1 text-xs leading-5 text-blue-800">
            Create a backend project context using POST /api/v1/projects.
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm">
          Operational
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold text-blue-900">
            Project Name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-xl border border-blue-100 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold text-blue-900">
            Description
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="h-10 w-full rounded-xl border border-blue-100 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={createProject}
          disabled={creating || !name.trim()}
          className="primary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating && <Loader2 size={14} className="animate-spin" />}
          Create Project
        </button>

        {message && (
          <span className={cx("rounded-xl border px-3 py-2 text-[11px] font-bold shadow-sm", messageClass)}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

function ProjectInspector({
  project,
  dataSources,
  message
}: {
  project: unknown;
  dataSources: unknown[];
  message: string;
}) {
  if (!project && !dataSources.length && !message) {
    return null;
  }

  const projectId = readProjectId(project) || "—";
  const projectName = project ? readProjectTitle(project, projectId) : "Selected Project";

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">
            Project Details
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Live data loaded from project detail and project data source endpoints.
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-600 shadow-sm">
          GET /projects/:id
        </span>
      </div>

      {message && (
        <div
          className={cx(
            "rounded-xl border px-4 py-3 text-xs font-bold",
            isErrorMessage(message)
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-blue-100 bg-blue-50 text-blue-800"
          )}
        >
          {message}
        </div>
      )}

      {Boolean(project) && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-extrabold text-slate-900">
              {projectName}
            </div>

            <div className="space-y-1.5">
              <FieldLine label="Project ID" value={projectId} />
              <FieldLine label="Created" value={readText(project, ["created_at", "createdAt"], "—")} />
              <FieldLine label="Updated" value={readText(project, ["updated_at", "updatedAt"], "—")} />
              <FieldLine label="Description" value={readText(project, ["description"], "—")} />
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-xs font-extrabold text-slate-700 transition hover:text-blue-700">
              Advanced: Raw Project JSON
            </summary>

            <div className="mt-3 rounded-xl bg-slate-950 p-3">
              <pre className="max-h-[280px] overflow-auto text-[11px] leading-5 text-slate-100">
                {JSON.stringify(project, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-900">
            Project Data Sources
          </div>

          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-500 shadow-sm">
            {dataSources.length} source{dataSources.length === 1 ? "" : "s"}
          </span>
        </div>

        {dataSources.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {dataSources.map((source, index) => (
              <DataSourceCard
                key={readText(source, ["data_source_id", "upload_id", "source_id", "id", "name"], String(index))}
                item={source}
              />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No attached data sources were returned by GET /projects/{project_id}/data-sources for this project." />
        )}
      </div>
    </div>
  );
}

function ProjectsWorkspace({
  items,
  onRefresh
}: {
  items: unknown[];
  onRefresh: () => void;
}) {
  const [selectedProject, setSelectedProject] = useState<unknown>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDataSources, setProjectDataSources] = useState<unknown[]>([]);
  const [busyProjectId, setBusyProjectId] = useState("");
  const [message, setMessage] = useState("");

  async function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setBusyProjectId(projectId);
    setMessage("");
    setSelectedProject(null);
    setProjectDataSources([]);

    try {
      const [detailResult, sourcesResult] = await Promise.allSettled([
        api.getProject(projectId),
        api.listProjectDataSources(projectId)
      ]);

      const messages: string[] = [];

      if (detailResult.status === "fulfilled") {
        setSelectedProject(detailResult.value);
        messages.push("Project details loaded");
      } else {
        messages.push(
          `Project details could not be loaded: ${
            detailResult.reason instanceof Error
              ? detailResult.reason.message
              : "unknown error"
          }`
        );
      }

      if (sourcesResult.status === "fulfilled") {
        const sourceItems = asArray(sourcesResult.value);
        setProjectDataSources(sourceItems);
        messages.push(buildProjectDataSourcesMessage(projectId, sourcesResult.value, sourceItems.length));
      } else {
        setProjectDataSources([]);
        messages.push(
          `Attached data sources could not be loaded: ${
            sourcesResult.reason instanceof Error
              ? sourcesResult.reason.message
              : "unknown error"
          }`
        );
      }

      setMessage(messages.join(" · "));
    } catch (error) {
      setSelectedProject(null);
      setProjectDataSources([]);
      setMessage(error instanceof Error ? error.message : "Could not load project.");
    } finally {
      setBusyProjectId("");
    }
  }

  async function loadProjectDataSources(projectId: string) {
    setSelectedProjectId(projectId);
    setBusyProjectId(projectId);
    setMessage("");
    setProjectDataSources([]);

    try {
      const sources = await api.listProjectDataSources(projectId);
      const sourceItems = asArray(sources);
      setProjectDataSources(sourceItems);
      setMessage(buildProjectDataSourcesMessage(projectId, sources, sourceItems.length));
    } catch (error) {
      setProjectDataSources([]);
      setMessage(error instanceof Error ? error.message : "Could not load project data sources.");
    } finally {
      setBusyProjectId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
        <div className="mb-1 text-sm font-extrabold text-purple-950">
          Project context
        </div>
        <div className="text-xs leading-5 text-purple-800">
          Projects define the operational context for datasets, uploaded layers and AI spatial analysis. This workspace is connected to list, create, detail and project data-source backend APIs.
        </div>
      </div>

      <ProjectCreateForm onCreated={onRefresh} />

      {items.length ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-900">
              Backend Projects
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
              {items.length} project{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {items.map((item, index) => (
              <ProjectCard
                key={readProjectId(item) || readProjectTitle(item) || String(index)}
                item={item}
                busyProjectId={busyProjectId}
                selected={Boolean(readProjectId(item) && readProjectId(item) === selectedProjectId)}
                onOpenProject={openProject}
                onLoadDataSources={loadProjectDataSources}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="No projects returned"
          message="Create a project to start organizing datasets, analysis requests and generated outputs."
          tone="info"
        />
      )}

      <ProjectInspector
        project={selectedProject}
        dataSources={projectDataSources}
        message={message}
      />
    </div>
  );
}


type DataSourceCardProps = {
  item: unknown;
  busySourceId?: string;
  onOpenMetadata?: (sourceId: string) => void;
  onPreview?: (sourceId: string) => void;
};

function readDataSourceId(item: unknown) {
  return readText(
    item,
    ["data_source_id", "upload_id", "source_id", "dataset_id", "id", "name"],
    ""
  );
}

function DataSourceCard({
  item,
  busySourceId,
  onOpenMetadata,
  onPreview
}: DataSourceCardProps) {
  const id = readDataSourceId(item);
  const title =
    readText(item, ["display_name", "name", "title", "filename", "file_name", "dataset"], "") ||
    `Source ${id || "—"}`;
  const type = readText(item, ["kind", "type", "format", "driver", "mime_type", "media_type"], "dataset");
  const status = readStatus(item, "connected");
  const extension = readText(item, ["extension", "file_extension"], "—");
  const size = readText(item, ["size_bytes", "size", "file_size"], "—");
  const description = readText(
    item,
    ["description", "summary", "message", "path", "original_filename"],
    "Backend source is available for spatial analysis."
  );
  const isBusy = Boolean(id && busySourceId === id);
  const downloadUrl = id ? api.downloadUploadFileUrl(id) : "";

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-100 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Database size={16} className="shrink-0 text-emerald-700" />
            <div className="truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {description}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            statusClass(status)
          )}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Source Type
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {type}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Source ID
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {id || "—"}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Extension
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {extension}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Size
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {size}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          disabled={!id || isBusy || !onOpenMetadata}
          onClick={() => onOpenMetadata?.(id)}
          className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="Load data source metadata"
        >
          {isBusy ? <Loader2 size={13} className="animate-spin" /> : null}
          Metadata
        </button>

        <button
          disabled={!id || isBusy || !onPreview}
          onClick={() => onPreview?.(id)}
          className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="Load data source preview"
        >
          Preview
        </button>

        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="secondary-button h-8 px-3 text-xs"
            title="Download uploaded source file"
          >
            Download
          </a>
        ) : (
          <button
            disabled
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-extrabold text-slate-400"
          >
            Download
          </button>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
        Operational source: metadata, preview and download endpoints are connected
      </div>
    </div>
  );
}

function previewBody(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.preview)) {
    return payload.preview;
  }

  return payload;
}

function previewFeatureCount(payload: unknown) {
  const body = previewBody(payload);
  return readText(body, ["feature_count", "features_count", "count"], "—");
}

function previewGeometryTypes(payload: unknown) {
  const body = previewBody(payload);

  if (isRecord(body)) {
    const value = body.geometry_types ?? body.geometryTypes ?? body.geometries;

    if (Array.isArray(value)) {
      return value.map(String).join(", ");
    }
  }

  return readText(body, ["geometry_types", "geometryTypes", "geometries"], "—");
}

function previewSampleGeoJson(payload: unknown) {
  const body = previewBody(payload);

  if (isRecord(body)) {
    return (
      body.sample_geojson ??
      body.sampleGeojson ??
      body.sample_geo_json ??
      body.geojson ??
      body.geo_json ??
      null
    );
  }

  return null;
}

type DataSourceInspectorTab = "overview" | "preview" | "raw";

function DataSourceInspectorTabButton({
  tab,
  activeTab,
  onClick,
  children
}: {
  tab: DataSourceInspectorTab;
  activeTab: DataSourceInspectorTab;
  onClick: (tab: DataSourceInspectorTab) => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={cx(
        "h-8 rounded-xl px-3 text-xs font-extrabold transition",
        activeTab === tab
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function DataSourceInspector({
  open,
  metadata,
  preview,
  message,
  selectedSourceId,
  selectedSourceTitle,
  activeTab,
  onTabChange,
  onClose,
  onShowOnMap,
  onUseInQuery
}: {
  open: boolean;
  metadata: unknown;
  preview: unknown;
  message: string;
  selectedSourceId: string;
  selectedSourceTitle: string;
  activeTab: DataSourceInspectorTab;
  onTabChange: (tab: DataSourceInspectorTab) => void;
  onClose: () => void;
  onShowOnMap?: (payload: DataSourcePreviewMapPayload) => void;
  onUseInQuery?: (payload: DataSourceQueryContextPayload) => void;
}) {
  const sampleGeojson = previewSampleGeoJson(preview);
  const hasMetadata = Boolean(metadata);
  const hasPreview = Boolean(preview);
  const canShowOnMap = Boolean(sampleGeojson && onShowOnMap && selectedSourceId);

  function showPreviewOnMap() {
    if (!sampleGeojson || !onShowOnMap || !selectedSourceId) return;

    onShowOnMap({
      sourceId: selectedSourceId,
      title: selectedSourceTitle || selectedSourceId,
      geojson: sampleGeojson
    });
  }

  function useDataSourceInQuery() {
    if (!onUseInQuery || !selectedSourceId) return;

    onUseInQuery({
      sourceId: selectedSourceId,
      title: selectedSourceTitle || selectedSourceId,
      metadata,
      preview
    });
  }

  if (!open) {
    return (
      <aside className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 xl:sticky xl:top-0">
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
              <Database size={22} />
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              Data Source Inspector
            </div>
            <div className="mt-2 max-w-[280px] text-xs leading-5 text-slate-500">
              Select Metadata or Preview from a data source card to inspect it here without scrolling away from the catalog.
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-0 xl:max-h-[calc(100vh-150px)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">
            Data Source Inspector
          </div>
          <div className="mt-1 truncate text-xs font-bold text-slate-500">
            {selectedSourceTitle || selectedSourceId || "Selected source"}
          </div>
          {selectedSourceId && (
            <div className="mt-1 truncate text-[11px] text-slate-400">
              {selectedSourceId}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="icon-button h-8 w-8 shrink-0"
          title="Close data source inspector"
        >
          <X size={15} />
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <DataSourceInspectorTabButton
            tab="overview"
            activeTab={activeTab}
            onClick={onTabChange}
          >
            Overview
          </DataSourceInspectorTabButton>

          <DataSourceInspectorTabButton
            tab="preview"
            activeTab={activeTab}
            onClick={onTabChange}
          >
            Preview
          </DataSourceInspectorTabButton>

          <DataSourceInspectorTabButton
            tab="raw"
            activeTab={activeTab}
            onClick={onTabChange}
          >
            Raw JSON
          </DataSourceInspectorTabButton>
        </div>
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-4">
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            {message}
          </div>
        )}

        {Boolean(onUseInQuery && selectedSourceId) && (
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-extrabold text-blue-950">
                  AI Query Context
                </div>
                <div className="mt-1 text-xs leading-5 text-blue-800">
                  Add this data source as explicit context for the next natural language spatial analysis.
                </div>
              </div>

              <button
                onClick={useDataSourceInQuery}
                className="primary-button h-9 px-3 text-xs"
              >
                Use in AI Query
              </button>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-4">
            {hasMetadata ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-extrabold text-slate-900">
                    Metadata Summary
                  </div>

                  <div className="space-y-2">
                    <FieldLine
                      label="Name"
                      value={readText(metadata, ["display_name", "name", "filename", "original_filename"], "—")}
                    />
                    <FieldLine
                      label="Kind"
                      value={readText(metadata, ["kind", "type", "format", "media_type"], "—")}
                    />
                    <FieldLine
                      label="Status"
                      value={readText(metadata, ["status", "state"], "—")}
                    />
                    <FieldLine
                      label="Size"
                      value={readText(metadata, ["size_bytes", "size", "file_size"], "—")}
                    />
                    <FieldLine
                      label="Created"
                      value={readText(metadata, ["created_at", "stored_at", "createdAt"], "—")}
                    />
                    <FieldLine
                      label="Parsed JSON"
                      value={readText(metadata, ["parsed_json_available", "parsedJsonAvailable"], "—")}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-extrabold text-emerald-900">
                    API endpoint
                  </div>
                  <div className="mt-1 break-all text-[11px] font-bold text-emerald-700">
                    GET /api/v1/data-sources/{selectedSourceId}
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel
              title="Metadata not loaded"
              message="Click Metadata on a data source card to load backend metadata into this inspector."
              tone="info"
            />
            )}
          </div>
        )}

        {activeTab === "preview" && (
          <div className="space-y-4">
            {hasPreview ? (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                      Preview Type
                    </div>
                    <div className="mt-2 truncate text-sm font-extrabold text-slate-900">
                      {readText(previewBody(preview), ["type", "preview_type", "geojson_type"], "preview")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                      Feature Count
                    </div>
                    <div className="mt-2 truncate text-sm font-extrabold text-slate-900">
                      {previewFeatureCount(preview)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                      Geometry Types
                    </div>
                    <div className="mt-2 text-sm font-extrabold leading-5 text-slate-900">
                      {previewGeometryTypes(preview)}
                    </div>
                  </div>
                </div>

                {Boolean(sampleGeojson) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">
                        Sample GeoJSON
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                        Map-ready
                      </span>
                    </div>

                    <div className="mb-3 text-xs leading-5 text-slate-500">
                      Preview sample is available. In the next stage this will be sent directly to the Leaflet map.
                    </div>

                    <button
                      disabled={!canShowOnMap}
                      onClick={showPreviewOnMap}
                      className="primary-button h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      title={canShowOnMap ? "Render this preview sample on the map" : "No map-ready sample GeoJSON is available"}
                    >
                      Show on Map
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-extrabold text-emerald-900">
                    API endpoint
                  </div>
                  <div className="mt-1 break-all text-[11px] font-bold text-emerald-700">
                    GET /api/v1/data-sources/{selectedSourceId}/preview
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel
              title="Preview not loaded"
              message="Click Preview on a data source card to load a backend preview sample."
              tone="info"
            />
            )}
          </div>
        )}

        {activeTab === "raw" && (
          <div className="space-y-4">
            {hasMetadata && (
              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
                <div className="mb-2 text-xs font-extrabold text-slate-100">
                  Metadata JSON
                </div>
                <pre className="max-h-[300px] overflow-auto text-[11px] leading-5 text-slate-100">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            )}

            {hasPreview && (
              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
                <div className="mb-2 text-xs font-extrabold text-slate-100">
                  Preview JSON
                </div>
                <pre className="max-h-[300px] overflow-auto text-[11px] leading-5 text-slate-100">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </div>
            )}

            {Boolean(sampleGeojson) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
                <div className="mb-2 text-xs font-extrabold text-slate-100">
                  Sample GeoJSON
                </div>
                <pre className="max-h-[360px] overflow-auto text-[11px] leading-5 text-slate-100">
                  {JSON.stringify(sampleGeojson, null, 2)}
                </pre>
              </div>
            )}

            {!hasMetadata && !hasPreview && (
              <EmptyPanel
              title="No raw payload"
              message="Select Metadata or Preview first to inspect the raw backend response."
            />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function DataSourcesWorkspace({
  items,
  onRefresh,
  onShowDataSourcePreviewOnMap,
  onUseDataSourceInQueryContext
}: {
  items: unknown[];
  onRefresh: () => void;
  onShowDataSourcePreviewOnMap?: (payload: DataSourcePreviewMapPayload) => void;
  onUseDataSourceInQueryContext?: (payload: DataSourceQueryContextPayload) => void;
}) {
  const [metadata, setMetadata] = useState<unknown>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [busySourceId, setBusySourceId] = useState("");
  const [message, setMessage] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<DataSourceInspectorTab>("overview");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceTitle, setSelectedSourceTitle] = useState("");
  const [updateDisplayName, setUpdateDisplayName] = useState("");
  const [updateDescription, setUpdateDescription] = useState("");
  const [updateTagsText, setUpdateTagsText] = useState("");
  const [maintenanceBusy, setMaintenanceBusy] = useState<"update" | "delete" | null>(null);

  function sourceTitleFor(sourceId: string) {
    const selected = items.find((item) => readDataSourceId(item) === sourceId);

    return readText(
      selected,
      ["display_name", "name", "title", "filename", "file_name", "dataset"],
      sourceId
    );
  }

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setSelectedSourceTitle(sourceTitleFor(sourceId));
  }

  async function openMetadata(sourceId: string) {
    selectSource(sourceId);
    setInspectorOpen(true);
    setInspectorTab("overview");
    setBusySourceId(sourceId);
    setMessage("");

    try {
      const result = await api.getDataSource(sourceId);
      setMetadata(result);
      setMessage(`Metadata loaded for ${sourceTitleFor(sourceId)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data source metadata.");
    } finally {
      setBusySourceId("");
    }
  }

  async function openPreview(sourceId: string) {
    selectSource(sourceId);
    setInspectorOpen(true);
    setInspectorTab("preview");
    setBusySourceId(sourceId);
    setMessage("");

    try {
      const result = await api.previewDataSource(sourceId);
      setPreview(result);
      setMessage(`Preview loaded for ${sourceTitleFor(sourceId)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data source preview.");
    } finally {
      setBusySourceId("");
    }
  }

  function closeInspector() {
    setInspectorOpen(false);
  }

  async function updateSelectedSource() {
    if (!selectedSourceId) {
      setMessage("Select Metadata or Preview on a data source first.");
      return;
    }

    const tags = updateTagsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {};

    if (updateDisplayName.trim()) payload.display_name = updateDisplayName.trim();
    if (updateDescription.trim()) payload.description = updateDescription.trim();
    if (tags.length) payload.tags = tags;

    if (!Object.keys(payload).length) {
      setMessage("Enter display_name, description or comma-separated tags before updating.");
      return;
    }

    setMaintenanceBusy("update");
    setMessage("");

    try {
      await api.updateDataSource(selectedSourceId, payload);
      setMessage(`Updated data source metadata for ${selectedSourceTitle || selectedSourceId}.`);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update data source.");
    } finally {
      setMaintenanceBusy(null);
    }
  }

  async function deleteSelectedSource() {
    if (!selectedSourceId) {
      setMessage("Select Metadata or Preview on a data source first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete data source ${selectedSourceTitle || selectedSourceId}? This calls DELETE /api/v1/data-sources/{upload_id}.`
    );

    if (!confirmed) return;

    setMaintenanceBusy("delete");
    setMessage("");

    try {
      await api.deleteDataSource(selectedSourceId);
      setMessage(`Deleted data source ${selectedSourceTitle || selectedSourceId}.`);
      setSelectedSourceId("");
      setSelectedSourceTitle("");
      setMetadata(null);
      setPreview(null);
      setInspectorOpen(false);
      setUpdateDisplayName("");
      setUpdateDescription("");
      setUpdateTagsText("");
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete data source.");
    } finally {
      setMaintenanceBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-emerald-950">
              Data source catalog
            </div>
            <div className="mt-1 text-xs leading-5 text-emerald-800">
              Browse uploaded spatial sources, inspect metadata and previews, send map-ready samples to the map, or add a selected source directly to AI Query context. Advanced update/delete actions are available after selecting a source.
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 shadow-sm">
            {items.length} source{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900">
                  Selected Data Source Maintenance
                </div>
                <div className="mt-1 break-all text-xs text-slate-500">
                  {selectedSourceId
                    ? selectedSourceTitle || selectedSourceId
                    : "Select Metadata or Preview on a data source card to enable maintenance actions."}
                </div>
                {selectedSourceId && (
                  <div className="mt-1 break-all text-[11px] font-semibold text-slate-400">
                    PATCH / DELETE /api/v1/data-sources/{selectedSourceId}
                  </div>
                )}
              </div>

              <span
                className={cx(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                  selectedSourceId
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {selectedSourceId ? "Selected" : "No selection"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <input
                value={updateDisplayName}
                onChange={(event) => setUpdateDisplayName(event.target.value)}
                placeholder="display_name"
                disabled={!selectedSourceId || maintenanceBusy !== null}
                className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />

              <input
                value={updateDescription}
                onChange={(event) => setUpdateDescription(event.target.value)}
                placeholder="description"
                disabled={!selectedSourceId || maintenanceBusy !== null}
                className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />

              <input
                value={updateTagsText}
                onChange={(event) => setUpdateTagsText(event.target.value)}
                placeholder="tags: commercial, tehran"
                disabled={!selectedSourceId || maintenanceBusy !== null}
                className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={updateSelectedSource}
                disabled={!selectedSourceId || maintenanceBusy !== null}
                className="secondary-button h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="PATCH /api/v1/data-sources/{upload_id}"
              >
                {maintenanceBusy === "update" && <Loader2 size={14} className="animate-spin" />}
                Update Metadata
              </button>

              <button
                type="button"
                onClick={deleteSelectedSource}
                disabled={!selectedSourceId || maintenanceBusy !== null}
                className="h-9 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="DELETE /api/v1/data-sources/{upload_id}"
              >
                {maintenanceBusy === "delete" && <Loader2 size={14} className="animate-spin" />}
                Delete Data Source
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
              Delete is destructive. Test it only on temporary uploads such as stage18_4_upload_smoke.geojson.
            </div>
          </div>

          {items.length ? (
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {items.map((item, index) => (
                <DataSourceCard
                  key={readDataSourceId(item) || String(index)}
                  item={item}
                  busySourceId={busySourceId}
                  onOpenMetadata={openMetadata}
                  onPreview={openPreview}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
            title="No data sources available"
            message="Upload a vector/raster file or connect a catalog endpoint, then refresh this workspace."
            tone="info"
          />
          )}
        </div>

        <DataSourceInspector
          open={inspectorOpen}
          metadata={metadata}
          preview={preview}
          message={message}
          selectedSourceId={selectedSourceId}
          selectedSourceTitle={selectedSourceTitle}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          onClose={closeInspector}
          onShowOnMap={onShowDataSourcePreviewOnMap}
          onUseInQuery={onUseDataSourceInQueryContext}
        />
      </div>
    </div>
  );
}


type DashboardApiError = {
  label: string;
  message: string;
};

type DashboardPayload = {
  health: unknown;
  runtimeSettings: unknown;
  requests: unknown[];
  projects: unknown[];
  uploads: unknown[];
  plugins: unknown[];
  weights: unknown[];
  errors: DashboardApiError[];
  lastUpdated: string;
};

function settledDashboardValue(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? result.value : null;
}

function dashboardSettledError(
  label: string,
  result: PromiseSettledResult<unknown>
): DashboardApiError | null {
  if (result.status === "fulfilled") return null;

  return {
    label,
    message:
      result.reason instanceof Error
        ? result.reason.message
        : "Backend request failed."
  };
}

function dashboardObjectSize(payload: unknown) {
  if (Array.isArray(payload)) return payload.length;
  if (isRecord(payload)) return Object.keys(payload).length;
  return payload ? 1 : 0;
}

function DashboardCards({ dashboard }: { dashboard: DashboardPayload }) {
  const healthStatus = dashboard.health
    ? readStatus(dashboard.health, "online")
    : "unavailable";

  const runtimeCount = dashboardObjectSize(dashboard.runtimeSettings);

  const cards: Array<{
    title: string;
    value: string;
    description: string;
    status?: string;
  }> = [
    {
      title: "Backend",
      value: healthStatus,
      description: readText(dashboard.health, ["service", "name"], "API health endpoint")
    },
    {
      title: "Projects",
      value: String(dashboard.projects.length),
      description: "Available geospatial projects"
    },
    {
      title: "Uploads",
      value: String(dashboard.uploads.length),
      description: "Uploaded raster/vector datasets"
    },
    {
      title: "Requests",
      value: String(dashboard.requests.length),
      description: "Analysis requests and results"
    },
    {
      title: "Plugins",
      value: String(dashboard.plugins.length),
      description: "Registered backend plugins"
    },
    {
      title: "Weights",
      value: String(dashboard.weights.length || runtimeCount || "—"),
      description: "Weights and scoring configuration"
    },
    {
      title: "Runtime",
      value: runtimeCount ? String(runtimeCount) : "—",
      description: "Runtime settings entries"
    },
    {
      title: "API Version",
      value: readText(dashboard.health, ["api_version", "version"], "—"),
      description: "Backend reported API version"
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Activity size={18} />
          </div>

          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {card.title}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-2">
            <div className="truncate text-2xl font-extrabold text-slate-900">
              {card.value}
            </div>

            {card.title === "Backend" && (
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                  statusClass(card.value)
                )}
              >
                {card.value}
              </span>
            )}
          </div>

          <div className="mt-1 truncate text-xs text-slate-500">
            {card.description}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSystemSummary({ dashboard }: { dashboard: DashboardPayload }) {
  const runtimeEntries = isRecord(dashboard.runtimeSettings)
    ? Object.entries(dashboard.runtimeSettings).slice(0, 6)
    : [];

  const healthRows = [
    ["Service", readText(dashboard.health, ["service", "name"], "—")],
    ["Status", dashboard.health ? readStatus(dashboard.health, "online") : "unavailable"],
    ["Version", readText(dashboard.health, ["version", "api_version"], "—")],
    ["CORS", readText(dashboard.health, ["cors"], "—")],
    ["Plugin Registry", readText(dashboard.health, ["plugin_registry"], "—")]
  ];

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-900">
            System Summary
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-500">
            Health
          </span>
        </div>

        <div className="space-y-2">
          {healthRows.map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="shrink-0 font-bold text-slate-500">{label}</span>
              <span className="truncate font-extrabold text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {dashboard.lastUpdated && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-400">
            Last updated: {dashboard.lastUpdated}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-900">
            Runtime Settings
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold uppercase text-blue-700">
            Read-only
          </span>
        </div>

        {runtimeEntries.length ? (
          <div className="space-y-2">
            {runtimeEntries.map(([key, value]) => (
              <div key={key} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                <span className="shrink-0 font-bold text-slate-500">{key}</span>
                <span className="truncate font-extrabold text-slate-800">
                  {typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="No runtime settings"
            message="The runtime settings endpoint returned no readable entries."
            tone="info"
          />
        )}
      </div>

      <div
        className={cx(
          "rounded-2xl border p-4 shadow-sm",
          dashboard.errors.length
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-100 bg-emerald-50"
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-900">
            API Coverage
          </div>
          <span
            className={cx(
              "rounded-full px-2 py-1 text-[10px] font-extrabold uppercase",
              dashboard.errors.length
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            )}
          >
            {dashboard.errors.length ? "Partial" : "OK"}
          </span>
        </div>

        {dashboard.errors.length ? (
          <div className="space-y-2">
            {dashboard.errors.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs"
              >
                <div className="font-extrabold text-amber-800">{item.label}</div>
                <div className="mt-1 leading-5 text-amber-700">{item.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-white/70 px-3 py-3 text-xs font-bold leading-5 text-emerald-700">
            Dashboard APIs responded successfully.
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActions({
  onNavigate,
  onClose
}: {
  onNavigate?: (view: NavView) => void;
  onClose: () => void;
}) {
  const actions: Array<{
    label: string;
    description: string;
    icon: ReactNode;
    onClick: () => void;
  }> = [
    {
      label: "Run AI Query",
      description: "Return to the map and natural language query workspace.",
      icon: <Activity size={17} />,
      onClick: onClose
    },
    {
      label: "Upload Data",
      description: "Upload vector or raster datasets for real analysis.",
      icon: <UploadCloud size={17} />,
      onClick: () => onNavigate?.("uploads")
    },
    {
      label: "Inspect Sources",
      description: "Review uploaded and connected backend data sources.",
      icon: <Database size={17} />,
      onClick: () => onNavigate?.("data-sources")
    },
    {
      label: "View Outputs",
      description: "Browse previous analysis requests and outputs.",
      icon: <Package size={17} />,
      onClick: () => onNavigate?.("outputs")
    }
  ];

  return (
    <div>
      <div className="mb-3 text-sm font-extrabold text-slate-900">
        Quick Actions
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-md"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              {action.icon}
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {action.label}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {action.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function layerTypeLabel(type: LayerItem["type"]) {
  if (type === "analysis") return "Analysis";
  if (type === "boundary") return "Boundary";
  if (type === "raster") return "Raster";
  return "Vector";
}

function layerTypeBadgeClass(type: LayerItem["type"]) {
  if (type === "analysis") return "bg-emerald-50 text-emerald-700";
  if (type === "boundary") return "bg-purple-50 text-purple-700";
  if (type === "raster") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function readLayerSource(layer: LayerItem) {
  const metadata = isRecord(layer.metadata) ? layer.metadata : {};
  const sourceKind = readText(metadata, ["sourceKind", "source_kind", "__source"], "");

  if (sourceKind === "data-source-preview") return "Data Source Preview";
  if (sourceKind === "backend") return "Backend";
  if (layer.sourceUrl) return "Remote Source";
  if (layer.geojson) return "Inline GeoJSON";

  return "Local / Mock";
}

function layerGeometryStatus(layer: LayerItem) {
  const geojson = extractGeoJson(layer.geojson);

  if (geojson) {
    return {
      label: "GeoJSON",
      detail: `${geojson.features.length} feature${geojson.features.length === 1 ? "" : "s"}`,
      className: "bg-emerald-50 text-emerald-700"
    };
  }

  if (layer.sourceUrl) {
    return {
      label: "Remote",
      detail: "Remote source URL",
      className: "bg-amber-50 text-amber-700"
    };
  }

  return {
    label: "No geometry",
    detail: "No renderable GeoJSON attached",
    className: "bg-slate-100 text-slate-500"
  };
}

function LiveMapLayerCard({
  layer,
  onToggleLayer,
  onZoomToLayer,
  onRemoveLayer
}: {
  layer: LayerItem;
  onToggleLayer?: (layerId: string) => void;
  onZoomToLayer?: (layerId: string) => void;
  onRemoveLayer?: (layerId: string) => void;
}) {
  const geometryStatus = layerGeometryStatus(layer);
  const source = readLayerSource(layer);
  const metadata = isRecord(layer.metadata) ? layer.metadata : {};
  const sourceId = readText(metadata, ["sourceId", "source_id", "requestId", "request_id"], "—");

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: layer.color }}
            />
            <div className="truncate text-sm font-extrabold text-slate-900">
              {layer.name}
            </div>
          </div>

          <div className="mt-1 truncate text-xs text-slate-500">
            {layer.id}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            layer.visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {layer.visible ? "Visible" : "Hidden"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Type
          </div>
          <div className="mt-1">
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                layerTypeBadgeClass(layer.type)
              )}
            >
              {layerTypeLabel(layer.type)}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Geometry
          </div>
          <div className="mt-1">
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                geometryStatus.className
              )}
            >
              {geometryStatus.label}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Source
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {source}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
        <FieldLine label="Geometry Detail" value={geometryStatus.detail} />
        <FieldLine label="Source ID" value={sourceId} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onToggleLayer?.(layer.id)}
            disabled={!onToggleLayer}
            className={cx(
              "h-8 rounded-lg px-3 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50",
              layer.visible
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            {layer.visible ? "Hide Layer" : "Show Layer"}
          </button>

          <button
            onClick={() => onZoomToLayer?.(layer.id)}
            disabled={!onZoomToLayer}
            className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            title="Zoom map to this layer"
          >
            Zoom To Layer
          </button>

          <button
            onClick={() => onRemoveLayer?.(layer.id)}
            disabled={!onRemoveLayer}
            className="h-8 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Remove this layer from the live map"
          >
            Remove
          </button>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
          Live map state
        </span>
      </div>
    </div>
  );
}


function readRequestTitle(item: unknown) {
  const requestId = readRequestId(item);

  return (
    readText(
      item,
      ["title", "name", "query", "prompt", "summary", "description"],
      ""
    ) || requestId || "Request"
  );
}

function readRequestMapLayerItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload)) return [];

  for (const key of ["layers", "map_layers", "mapLayers", "items", "data", "results", "features"]) {
    const value = payload[key];

    if (Array.isArray(value)) return value;
  }

  return [];
}

function requestMapLayerSummary(payload: unknown) {
  const layerItems = readRequestMapLayerItems(payload);
  const record = isRecord(payload) ? payload : {};
  const status = readText(record, ["status", "state"], "loaded");

  return {
    count: layerItems.length,
    status,
    hasPayload: Boolean(payload)
  };
}

function LiveMapLayersWorkspace({
  layers,
  requestItems,
  onToggleLayer,
  onShowAllLayers,
  onHideAllLayers,
  onZoomToLayer,
  onRemoveLayer,
  onOpenRequest,
  onClose
}: {
  layers: LayerItem[];
  requestItems: unknown[];
  onToggleLayer?: (layerId: string) => void;
  onShowAllLayers?: () => void;
  onHideAllLayers?: () => void;
  onZoomToLayer?: (layerId: string) => void;
  onRemoveLayer?: (layerId: string) => void;
  onOpenRequest?: (requestId: string) => void;
  onClose: () => void;
}) {
  const visibleCount = layers.filter((layer) => layer.visible).length;
  const geoJsonCount = layers.filter((layer) => Boolean(extractGeoJson(layer.geojson))).length;
  const dataSourcePreviewCount = layers.filter((layer) => {
    const metadata = isRecord(layer.metadata) ? layer.metadata : {};
    return readText(metadata, ["sourceKind", "source_kind"], "") === "data-source-preview";
  }).length;
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [requestMapLayers, setRequestMapLayers] = useState<unknown>(null);
  const [requestLayerState, setRequestLayerState] = useState<LoadState>("idle");
  const [requestLayerMessage, setRequestLayerMessage] = useState("");

  const requestLayerSummary = requestMapLayerSummary(requestMapLayers);
  const selectedRequest = requestItems.find((item) => readRequestId(item) === selectedRequestId);
  const selectedRequestTitle = selectedRequest ? readRequestTitle(selectedRequest) : "";

  async function loadSelectedRequestMapLayers() {
    if (!selectedRequestId) {
      setRequestLayerState("error");
      setRequestLayerMessage("Select a request_id before loading map layers.");
      return;
    }

    setRequestLayerState("loading");
    setRequestLayerMessage("");
    setRequestMapLayers(null);

    try {
      const result = await api.getRequestMapLayers(selectedRequestId);
      setRequestMapLayers(result);
      setRequestLayerState("success");
      setRequestLayerMessage(`Loaded request-scoped map layers for ${selectedRequestId}.`);
    } catch (error) {
      setRequestLayerState("error");
      setRequestLayerMessage(error instanceof Error ? error.message : "Could not load request map layers.");
    }
  }

  function openSelectedRequest() {
    if (!selectedRequestId || !onOpenRequest) return;

    onOpenRequest(selectedRequestId);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <div className="text-sm font-extrabold text-blue-950">
              Live map layers
            </div>
            <div className="mt-1 text-xs leading-5 text-blue-800">
              Manage the layers currently rendered on the Leaflet map, including backend analysis layers and data source preview layers.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onShowAllLayers}
              disabled={!onShowAllLayers || layers.length === 0}
              className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show All
            </button>

            <button
              onClick={onHideAllLayers}
              disabled={!onHideAllLayers || layers.length === 0}
              className="secondary-button h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hide All
            </button>

            <button
              onClick={onClose}
              className="primary-button h-8 px-3 text-xs"
            >
              Open Map
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
              Total Layers
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {layers.length}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
              Visible
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {visibleCount}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
              GeoJSON
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {geoJsonCount}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
              Data Source Previews
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {dataSourcePreviewCount}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Backend Request Map Layers
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Backend map layers are request-scoped. This uses GET /api/v1/requests and GET /api/v1/requests/:request_id/map-layers. There is no documented global /api/v1/map-layers endpoint.
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
            {requestItems.length} request{requestItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {requestItems.length ? (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <select
                value={selectedRequestId}
                onChange={(event) => {
                  setSelectedRequestId(event.target.value);
                  setRequestMapLayers(null);
                  setRequestLayerState("idle");
                  setRequestLayerMessage("");
                }}
                className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select request_id...</option>
                {requestItems.map((item, index) => {
                  const requestId = readRequestId(item);
                  const label = readRequestTitle(item);

                  return (
                    <option key={requestId || String(index)} value={requestId}>
                      {requestId ? `${label} — ${requestId}` : label}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={loadSelectedRequestMapLayers}
                disabled={!selectedRequestId || requestLayerState === "loading"}
                className="primary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="GET /api/v1/requests/{request_id}/map-layers"
              >
                {requestLayerState === "loading" && <Loader2 size={14} className="animate-spin" />}
                Load Map Layers
              </button>

              <button
                type="button"
                onClick={openSelectedRequest}
                disabled={!selectedRequestId || !onOpenRequest}
                className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="Open request outputs and map layers in the main app state"
              >
                Open Request Outputs/Layers
              </button>
            </div>

            {selectedRequestId && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                <div className="break-all font-extrabold text-slate-800">
                  {selectedRequestTitle || selectedRequestId}
                </div>
                <div className="break-all">
                  Request ID: {selectedRequestId}
                </div>
              </div>
            )}

            {requestLayerMessage && (
              <div
                className={cx(
                  "mt-3 rounded-xl border px-3 py-2 text-xs font-bold",
                  requestLayerState === "error"
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}
              >
                {requestLayerMessage}
              </div>
            )}

            {requestLayerState === "success" && (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Response Summary
                  </div>
                  <div className="mt-3 space-y-2">
                    <FieldLine label="Status" value={requestLayerSummary.status} />
                    <FieldLine label="Layer Items" value={String(requestLayerSummary.count)} />
                    <FieldLine label="Endpoint" value="/api/v1/requests/{request_id}/map-layers" />
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                  <div className="mb-2 text-xs font-extrabold text-slate-100">
                    Raw Map Layers Response
                  </div>
                  <pre className="max-h-[360px] overflow-auto text-[11px] leading-5 text-slate-100">
                    {JSON.stringify(requestMapLayers, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyPanel
            title="No persisted requests"
            message="GET /api/v1/requests returned no records. Run an analysis first, then load request-scoped map layers here."
            tone="info"
          />
        )}
      </div>

      {layers.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {layers.map((layer) => (
            <LiveMapLayerCard
              key={layer.id}
              layer={layer}
              onToggleLayer={onToggleLayer}
              onZoomToLayer={onZoomToLayer}
              onRemoveLayer={onRemoveLayer}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="No live map layers"
          message="Run an analysis or send a data source preview to the map to create live layers."
          tone="info"
        />
      )}
    </div>
  );
}

type ResultWorkspaceView = Extract<NavView, "map-layers" | "outputs" | "reports">;

function outputsWorkspaceCopy(view: ResultWorkspaceView) {
  if (view === "map-layers") {
    return {
      title: "Generated map layers",
      description:
        "Review analysis requests that may contain generated vector/raster layers, GeoJSON payloads, styling metadata and map-ready outputs.",
      badge: "Layer Catalog",
      empty: "No map layer requests were returned yet. Run an analysis with map layer generation enabled or open a completed request."
    };
  }

  if (view === "reports") {
    return {
      title: "Generated reports",
      description:
        "Browse analysis requests that may include generated PDF reports, audit files, summaries and downloadable artifacts.",
      badge: "Report Center",
      empty: "No report records were returned yet. Run an analysis with report generation enabled or open request outputs that include documents."
    };
  }

  return {
    title: "Analysis results",
    description:
      "Browse completed or running analysis requests and open their returned outputs in the right-side Request Details panel.",
    badge: "Result History",
    empty: "No analysis result records were returned yet. Run an analysis or refresh the backend request history."
  };
}

function countCollectionValue(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["items", "data", "results", "files", "documents", "layers", "outputs"]) {
      const nested = record[key];

      if (Array.isArray(nested)) {
        return nested.length;
      }
    }

    return Object.keys(record).length;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return 1;
}

function countArtifactItems(item: unknown, keys: string[]): number {
  if (!item || typeof item !== "object") {
    return 0;
  }

  const record = item as Record<string, unknown>;

  for (const key of keys) {
    if (key in record) {
      return countCollectionValue(record[key]);
    }
  }

  return 0;
}

function hasReportArtifactHint(item: unknown): boolean {
  if (!item || typeof item !== "object") {
    return false;
  }

  const record = item as Record<string, unknown>;
  const reportCount = countArtifactItems(record, [
    "reports",
    "report_files",
    "reportFiles",
    "documents",
    "document_files",
    "documentFiles"
  ]);

  if (reportCount > 0) {
    return true;
  }

  const filesValue = record.files || record.output_files || record.outputFiles;
  const serialized = JSON.stringify({
    title: readText(record, ["name", "title", "summary", "description", "message"], ""),
    files: filesValue
  }).toLowerCase();

  return (
    serialized.includes("report") ||
    serialized.includes("document") ||
    serialized.includes(".pdf") ||
    serialized.includes(".docx") ||
    serialized.includes(".doc")
  );
}

function artifactCounts(item: unknown) {
  return {
    outputs: countArtifactItems(item, ["outputs", "output", "manifest"]),
    files: countArtifactItems(item, ["files", "output_files", "outputFiles"]),
    reports: countArtifactItems(item, [
      "reports",
      "report_files",
      "reportFiles",
      "documents",
      "document_files",
      "documentFiles"
    ]),
    layers: countArtifactItems(item, ["layers", "map_layers", "mapLayers", "geojson", "features"]),
    rankingRows: countArtifactItems(item, ["ranking_table", "rankingTable", "ranking_rows", "rankingRows"])
  };
}

function formatArtifactSummary(item: unknown, view: ResultWorkspaceView) {
  const counts = artifactCounts(item);
  const parts: string[] = [];

  if (view === "map-layers") {
    parts.push(`${counts.layers} layer${counts.layers === 1 ? "" : "s"}`);
    parts.push(`${counts.outputs} output manifest${counts.outputs === 1 ? "" : "s"}`);
  } else if (view === "reports") {
    parts.push(`${counts.reports} report/document${counts.reports === 1 ? "" : "s"}`);
    parts.push(`${counts.files} file${counts.files === 1 ? "" : "s"}`);
  } else {
    parts.push(`${counts.outputs} output manifest${counts.outputs === 1 ? "" : "s"}`);
    parts.push(`${counts.files} file${counts.files === 1 ? "" : "s"}`);
    parts.push(`${counts.rankingRows} ranking row${counts.rankingRows === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}


function OutputsWorkspaceIntro({ view, count }: { view: ResultWorkspaceView; count: number }) {
  const copy = outputsWorkspaceCopy(view);

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-blue-950">
          {copy.title}
        </div>

        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm">
          {copy.badge}
        </span>
      </div>

      <div className="text-xs leading-5 text-blue-800">
        {copy.description}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-blue-700">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        {count} backend request record{count === 1 ? "" : "s"} loaded
      </div>
    </div>
  );
}

function AnalysisOutputCard({
  item,
  view,
  onOpenRequest
}: {
  item: unknown;
  view: ResultWorkspaceView;
  onOpenRequest: (requestId: string) => void;
}) {
  const requestId = readRequestId(item);
  const status = readStatus(item, "ready");
  const title =
    readText(item, ["name", "title", "project_name"], "") ||
    requestId ||
    "Analysis Request";

  const query = readText(
    item,
    ["query", "prompt", "description", "summary", "message"],
    "No query summary returned by backend."
  );

  const created = readText(item, ["created_at", "createdAt", "timestamp", "updated_at"], "—");
  const confidence = readText(item, ["confidence", "score", "quality"], "—");
  const executionTime = readText(
    item,
    ["execution_time", "execution_time_ms", "executionTimeMs", "duration"],
    "—"
  );

  const counts = artifactCounts(item);
  const artifactSummary = formatArtifactSummary(item, view);
  const reportHint = hasReportArtifactHint(item);

  const metricCards =
    view === "map-layers"
      ? [
          ["Layers", String(counts.layers)],
          ["Outputs", String(counts.outputs)],
          ["Files", String(counts.files)]
        ]
      : view === "reports"
        ? [
            ["Reports", String(counts.reports)],
            ["Files", String(counts.files)],
            ["Outputs", String(counts.outputs)]
          ]
        : [
            ["Outputs", String(counts.outputs)],
            ["Files", String(counts.files)],
            ["Ranking Rows", String(counts.rankingRows)]
          ];

  const copy = outputsWorkspaceCopy(view);

  const primaryLabel =
    view === "map-layers"
      ? "Open Request Layers"
      : view === "reports"
        ? "Open Report Outputs"
        : "Open Request Outputs";

  const artifactLabel =
    view === "map-layers"
      ? "Map layers / GeoJSON"
      : view === "reports"
        ? "Reports / documents"
        : "Result files / tables";

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {view === "reports" ? (
              <FileText size={16} className="shrink-0 text-purple-700" />
            ) : view === "map-layers" ? (
              <Database size={16} className="shrink-0 text-emerald-700" />
            ) : (
              <Package size={16} className="shrink-0 text-blue-700" />
            )}

            <div className="truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {query}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            statusClass(status)
          )}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Request ID
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {requestId || "—"}
          </div>
        </div>

        {metricCards.map(([label, value]) => {
          const numericValue = Number(value);
          const hasValue = Number.isFinite(numericValue) && numericValue > 0;

          return (
            <div
              key={label}
              className={cx(
                "rounded-xl p-3",
                hasValue ? "bg-emerald-50" : "bg-slate-50"
              )}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {label}
              </div>
              <div
                className={cx(
                  "mt-1 truncate text-xs font-extrabold",
                  hasValue ? "text-emerald-700" : "text-slate-800"
                )}
              >
                {value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
        <FieldLine label="Created" value={created} />
        <FieldLine label="Artifact Type" value={artifactLabel} />
        <FieldLine label="Artifact Summary" value={artifactSummary} />
        <FieldLine label="Confidence" value={confidence} />
        <FieldLine label="Runtime" value={executionTime} />
        {view === "reports" && (
          <FieldLine
            label="Report Hint"
            value={reportHint ? "Report/document artifact detected" : "No report hint in request list record"}
          />
        )}
        <FieldLine label="Workspace" value={copy.badge} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {requestId ? (
          <button
            onClick={() => onOpenRequest(requestId)}
            className="secondary-button h-8 px-3 text-xs"
          >
            {primaryLabel}
          </button>
        ) : (
          <button
            disabled
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-extrabold text-slate-400"
          >
            Missing Request ID
          </button>
        )}

        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            requestId ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {requestId ? "Backend request" : "Incomplete record"}
        </span>
      </div>
    </div>
  );
}

type RequestArtifactDownload = {
  name: string;
  label: string;
  kind: "output-file" | "document";
};

function readArtifactFilename(item: unknown) {
  if (typeof item === "string") return item;

  if (!isRecord(item)) return "";

  return readText(
    item,
    [
      "filename",
      "file_name",
      "name",
      "path",
      "relative_path",
      "document",
      "document_name",
      "report",
      "report_name"
    ],
    ""
  );
}

function collectArtifactDownloadsFromValue(
  value: unknown,
  kind: RequestArtifactDownload["kind"]
): RequestArtifactDownload[] {
  const records = Array.isArray(value) ? value : asArray(value);

  return records
    .map((item) => {
      const name = readArtifactFilename(item).trim();

      if (!name || name === "—") return null;

      const label =
        isRecord(item)
          ? readText(item, ["label", "title", "display_name", "description"], name)
          : name;

      return {
        name,
        label,
        kind
      };
    })
    .filter((item): item is RequestArtifactDownload => Boolean(item));
}

function dedupeArtifactDownloads(items: RequestArtifactDownload[]) {
  const seen = new Set<string>();
  const result: RequestArtifactDownload[] = [];

  for (const item of items) {
    const key = `${item.kind}:${item.name}`;

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

function collectOutputFileDownloads(payload: unknown): RequestArtifactDownload[] {
  const collected: RequestArtifactDownload[] = [];

  if (Array.isArray(payload)) {
    collected.push(...collectArtifactDownloadsFromValue(payload, "output-file"));
  }

  if (isRecord(payload)) {
    for (const key of ["files", "output_files", "outputFiles", "items", "data", "results"]) {
      if (key in payload) {
        collected.push(...collectArtifactDownloadsFromValue(payload[key], "output-file"));
      }
    }
  }

  return dedupeArtifactDownloads(collected);
}

function collectDocumentDownloads(payload: unknown): RequestArtifactDownload[] {
  const collected: RequestArtifactDownload[] = [];

  if (isRecord(payload)) {
    for (const key of [
      "documents",
      "document_files",
      "documentFiles",
      "reports",
      "report_files",
      "reportFiles",
      "pdfs",
      "html_reports"
    ]) {
      if (key in payload) {
        collected.push(...collectArtifactDownloadsFromValue(payload[key], "document"));
      }
    }
  }

  return dedupeArtifactDownloads(collected);
}

function OutputsWorkspace({
  view,
  items,
  onOpenRequest
}: {
  view: ResultWorkspaceView;
  items: unknown[];
  onOpenRequest: (requestId: string) => void;
}) {
  const copy = outputsWorkspaceCopy(view);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [artifactState, setArtifactState] = useState<LoadState>("idle");
  const [artifactMessage, setArtifactMessage] = useState("");
  const [outputsPayload, setOutputsPayload] = useState<unknown>(null);
  const [filesPayload, setFilesPayload] = useState<unknown>(null);
  const [savePayload, setSavePayload] = useState<unknown>(null);

  const visibleItems = useMemo(() => {
    if (view !== "reports") {
      return items;
    }

    return [...items].sort((left, right) => {
      const leftHasReport = hasReportArtifactHint(left) ? 1 : 0;
      const rightHasReport = hasReportArtifactHint(right) ? 1 : 0;

      return rightHasReport - leftHasReport;
    });
  }, [items, view]);

  const reportHintCount = useMemo(
    () => items.filter((item) => hasReportArtifactHint(item)).length,
    [items]
  );

  const selectedRequest = items.find((item) => readRequestId(item) === selectedRequestId);
  const selectedRequestTitle = selectedRequest
    ? readText(
        selectedRequest,
        ["name", "title", "query", "prompt", "summary", "description"],
        selectedRequestId
      )
    : "";

  const outputFileDownloads = useMemo(
    () =>
      dedupeArtifactDownloads([
        ...collectOutputFileDownloads(filesPayload),
        ...collectOutputFileDownloads(outputsPayload)
      ]),
    [filesPayload, outputsPayload]
  );

  const documentDownloads = useMemo(
    () => collectDocumentDownloads(outputsPayload),
    [outputsPayload]
  );

  async function loadSelectedOutputs() {
    if (!selectedRequestId) {
      setArtifactState("error");
      setArtifactMessage("Select a request_id before loading outputs.");
      return;
    }

    setArtifactState("loading");
    setArtifactMessage("");
    setOutputsPayload(null);

    try {
      const result = await api.getRequestOutputs(selectedRequestId);
      setOutputsPayload(result);
      setArtifactState("success");
      setArtifactMessage(`Loaded outputs for ${selectedRequestId}.`);
    } catch (error) {
      setArtifactState("error");
      setArtifactMessage(error instanceof Error ? error.message : "Could not load request outputs.");
    }
  }

  async function loadSelectedFiles() {
    if (!selectedRequestId) {
      setArtifactState("error");
      setArtifactMessage("Select a request_id before loading output files.");
      return;
    }

    setArtifactState("loading");
    setArtifactMessage("");
    setFilesPayload(null);

    try {
      const result = await api.listRequestOutputFiles(selectedRequestId);
      setFilesPayload(result);
      setArtifactState("success");
      setArtifactMessage(`Loaded output files for ${selectedRequestId}.`);
    } catch (error) {
      setArtifactState("error");
      setArtifactMessage(error instanceof Error ? error.message : "Could not load request output files.");
    }
  }

  async function loadSelectedArtifacts() {
    if (!selectedRequestId) {
      setArtifactState("error");
      setArtifactMessage("Select a request_id before loading artifacts.");
      return;
    }

    setArtifactState("loading");
    setArtifactMessage("");
    setOutputsPayload(null);
    setFilesPayload(null);

    try {
      const [outputsResult, filesResult] = await Promise.allSettled([
        api.getRequestOutputs(selectedRequestId),
        api.listRequestOutputFiles(selectedRequestId)
      ]);

      if (outputsResult.status === "fulfilled") {
        setOutputsPayload(outputsResult.value);
      }

      if (filesResult.status === "fulfilled") {
        setFilesPayload(filesResult.value);
      }

      const errors = [
        outputsResult.status === "rejected" ? outputsResult.reason : null,
        filesResult.status === "rejected" ? filesResult.reason : null
      ].filter(Boolean);

      if (errors.length === 2) {
        throw errors[0];
      }

      setArtifactState(errors.length ? "error" : "success");
      setArtifactMessage(
        errors.length
          ? "Some artifact endpoints failed. Inspect loaded payloads or retry individual actions."
          : `Loaded outputs and files for ${selectedRequestId}.`
      );
    } catch (error) {
      setArtifactState("error");
      setArtifactMessage(error instanceof Error ? error.message : "Could not load request artifacts.");
    }
  }

  async function saveSelectedOutputs() {
    if (!selectedRequestId) {
      setArtifactState("error");
      setArtifactMessage("Select a request_id before saving outputs.");
      return;
    }

    setArtifactState("loading");
    setArtifactMessage("");
    setSavePayload(null);

    try {
      const result = await api.saveRequestOutputs(selectedRequestId, {
        source: "frontend_outputs_workspace",
        requested_at: new Date().toISOString()
      });

      setSavePayload(result);
      setArtifactState("success");
      setArtifactMessage(`Save outputs requested for ${selectedRequestId}.`);
    } catch (error) {
      setArtifactState("error");
      setArtifactMessage(error instanceof Error ? error.message : "Could not save request outputs.");
    }
  }

  function resetSelectedRequest(nextRequestId: string) {
    setSelectedRequestId(nextRequestId);
    setArtifactState("idle");
    setArtifactMessage("");
    setOutputsPayload(null);
    setFilesPayload(null);
    setSavePayload(null);
  }

  return (
    <div className="space-y-5">
      <OutputsWorkspaceIntro view={view} count={items.length} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              Request Artifacts Loader
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Direct API QA for request-scoped artifacts: GET /api/v1/requests/:request_id/outputs, GET /api/v1/requests/:request_id/outputs/files and POST /api/v1/requests/:request_id/outputs/save.
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
            {items.length} request{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {items.length ? (
          <>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
              <select
                value={selectedRequestId}
                onChange={(event) => resetSelectedRequest(event.target.value)}
                className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select request_id...</option>
                {visibleItems.map((item, index) => {
                  const requestId = readRequestId(item);
                  const label =
                    readText(
                      item,
                      ["name", "title", "query", "prompt", "summary", "description"],
                      requestId || `Request ${index + 1}`
                    );

                  return (
                    <option key={requestId || String(index)} value={requestId}>
                      {requestId ? `${label} — ${requestId}` : label}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={loadSelectedArtifacts}
                disabled={!selectedRequestId || artifactState === "loading"}
                className="primary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {artifactState === "loading" && <Loader2 size={14} className="animate-spin" />}
                Load All
              </button>

              <button
                type="button"
                onClick={loadSelectedOutputs}
                disabled={!selectedRequestId || artifactState === "loading"}
                className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="GET /api/v1/requests/:request_id/outputs"
              >
                Load Outputs
              </button>

              <button
                type="button"
                onClick={loadSelectedFiles}
                disabled={!selectedRequestId || artifactState === "loading"}
                className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="GET /api/v1/requests/:request_id/outputs/files"
              >
                Load Files
              </button>

              <button
                type="button"
                onClick={saveSelectedOutputs}
                disabled={!selectedRequestId || artifactState === "loading"}
                className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="POST /api/v1/requests/:request_id/outputs/save"
              >
                Save Outputs
              </button>

              <button
                type="button"
                onClick={() => selectedRequestId && onOpenRequest(selectedRequestId)}
                disabled={!selectedRequestId}
                className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Request
              </button>
            </div>

            {selectedRequestId && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                <div className="break-all font-extrabold text-slate-800">
                  {selectedRequestTitle || selectedRequestId}
                </div>
                <div className="break-all">
                  Request ID: {selectedRequestId}
                </div>
              </div>
            )}

            {artifactMessage && (
              <div
                className={cx(
                  "mt-3 rounded-xl border px-3 py-2 text-xs font-bold",
                  artifactState === "error"
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}
              >
                {artifactMessage}
              </div>
            )}

            {(outputFileDownloads.length > 0 || documentDownloads.length > 0) && (
              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-extrabold text-slate-900">
                    Output File Downloads
                  </div>

                  {outputFileDownloads.length ? (
                    <div className="space-y-2">
                      {outputFileDownloads.map((file, index) => (
                        <a
                          key={`${file.kind}-${file.name}-${index}`}
                          href={api.downloadRequestOutputFileUrl(selectedRequestId, file.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                          title="GET /api/v1/requests/:request_id/outputs/files/:filename"
                        >
                          <span className="min-w-0 truncate">{file.label}</span>
                          <span className="shrink-0 text-[10px] uppercase text-slate-400">
                            Download
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      No output file filenames were detected yet.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-extrabold text-slate-900">
                    Document Downloads
                  </div>

                  {documentDownloads.length ? (
                    <div className="space-y-2">
                      {documentDownloads.map((file, index) => (
                        <a
                          key={`${file.kind}-${file.name}-${index}`}
                          href={api.downloadRequestDocumentUrl(selectedRequestId, file.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50"
                          title="GET /api/v1/requests/:request_id/documents/:filename"
                        >
                          <span className="min-w-0 truncate">{file.label}</span>
                          <span className="shrink-0 text-[10px] uppercase text-slate-400">
                            Download
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      No document/report filenames were detected yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {Boolean(outputsPayload || filesPayload || savePayload) && (
              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                {Boolean(outputsPayload) && (
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Raw Outputs
                    </div>
                    <pre className="max-h-[320px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(outputsPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {Boolean(filesPayload) && (
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Raw Files
                    </div>
                    <pre className="max-h-[320px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(filesPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {Boolean(savePayload) && (
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Raw Save Response
                    </div>
                    <pre className="max-h-[320px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(savePayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyPanel
            title="No persisted requests"
            message="GET /api/v1/requests returned no records. Run an analysis first, then load request outputs, files and reports here."
            tone="info"
          />
        )}
      </div>

      {view === "reports" && items.length > 0 && reportHintCount === 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          Backend request records were loaded, but the request list does not expose report/document
          artifacts directly. Use <span className="font-extrabold">Request Artifacts Loader</span> to load
          files and documents for a specific request.
        </div>
      )}

      {items.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleItems.map((item, index) => (
            <AnalysisOutputCard
              key={readRequestId(item) || readText(item, ["id", "request_id"], String(index))}
              item={item}
              view={view}
              onOpenRequest={onOpenRequest}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel message={copy.empty} />
      )}
    </div>
  );
}

type AdminWorkspaceView = Extract<NavView, "plugins" | "weights">;
type RuntimeWorkspaceView = Extract<NavView, "settings" | "system-health">;

function adminWorkspaceCopy(view: AdminWorkspaceView) {
  if (view === "plugins") {
    return {
      title: "Plugin registry",
      description:
        "Review backend plugins, registered capabilities and API-ready extension metadata.",
      badge: "Plugin Registry",
      empty:
        "No plugins were returned by the backend. Connect or enable plugin registry endpoints to populate this workspace."
    };
  }

  return {
    title: "Weights configuration",
    description:
      "Review ranking weights, scoring parameters and suitability configuration returned by the backend.",
    badge: "Weight Rules",
    empty:
      "No scoring weights were returned by the backend. Connect weights/configuration endpoints to populate this workspace."
  };
}

function AdminWorkspaceIntro({ view, count }: { view: AdminWorkspaceView; count: number }) {
  const copy = adminWorkspaceCopy(view);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">
            {copy.title}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {copy.description}
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-600 shadow-sm">
          {copy.badge}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        {count} backend record{count === 1 ? "" : "s"} loaded
      </div>
    </div>
  );
}

function AdminRecordCard({
  item,
  view
}: {
  item: unknown;
  view: AdminWorkspaceView;
}) {
  const id = readText(
    item,
    ["id", "plugin_id", "pluginId", "weight_id", "weightId", "key", "name"],
    "—"
  );
  const title =
    readText(item, ["name", "title", "label", "key"], "") ||
    (view === "plugins" ? `Plugin ${id}` : `Weight ${id}`);
  const status = readStatus(item, view === "plugins" ? "available" : "active");
  const version = readText(item, ["version", "api_version", "schema_version"], "—");
  const category = readText(item, ["category", "group", "type", "scope"], view === "plugins" ? "plugin" : "weight");
  const value = readText(item, ["value", "weight", "score", "coefficient"], "—");
  const description = readText(
    item,
    ["description", "summary", "message", "capability"],
    view === "plugins"
      ? "Backend plugin metadata is available for this registry item."
      : "Backend scoring metadata is available for this weight item."
  );

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {view === "plugins" ? (
              <Plug size={16} className="shrink-0 text-blue-700" />
            ) : (
              <Settings size={16} className="shrink-0 text-purple-700" />
            )}

            <div className="truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {description}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            statusClass(status)
          )}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            ID / Key
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {id}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {view === "plugins" ? "Version" : "Value"}
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {view === "plugins" ? version : value}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Category
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
            {category}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
        {view === "plugins"
          ? "API-ready plugin capability metadata"
          : "API-ready scoring and ranking configuration"}
      </div>
    </div>
  );
}

function readAdminRecordId(item: unknown, view: AdminWorkspaceView) {
  return readText(
    item,
    view === "plugins"
      ? ["plugin_id", "pluginId", "id", "name", "slug"]
      : ["id", "weight_id", "weightId", "key", "name"],
    ""
  );
}

function readAdminRecordTitle(item: unknown, view: AdminWorkspaceView) {
  const id = readAdminRecordId(item, view);

  return (
    readText(
      item,
      ["title", "label", "name", "display_name", "description", "summary"],
      ""
    ) ||
    id ||
    (view === "plugins" ? "Plugin" : "Weight")
  );
}

function readPluginEnabled(item: unknown): boolean | null {
  if (!isRecord(item)) return null;

  const enabled = item.enabled ?? item.active ?? item.is_enabled ?? item.isEnabled;

  if (typeof enabled === "boolean") return enabled;

  if (typeof enabled === "string") {
    const normalized = enabled.toLowerCase();

    if (["true", "enabled", "active", "yes", "1"].includes(normalized)) return true;
    if (["false", "disabled", "inactive", "no", "0"].includes(normalized)) return false;
  }

  return null;
}

type JsonPathPart = string | number;

function cloneJsonValue<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function readPluginCapabilities(item: unknown): unknown[] {
  if (!isRecord(item)) return [];

  return asArray(item.capabilities || item.capability_list || item.capabilityList);
}

function readPluginCapabilityCount(item: unknown): number {
  if (isRecord(item)) {
    const explicit =
      item.capability_count ??
      item.capabilityCount ??
      item.capabilities_count;

    if (typeof explicit === "number" && Number.isFinite(explicit)) {
      return explicit;
    }

    if (typeof explicit === "string" && explicit.trim()) {
      const parsed = Number(explicit);

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return readPluginCapabilities(item).length;
}

function readPluginConfigEditablePayload(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.parsed)) {
    return payload.parsed;
  }

  return isRecord(payload) ? payload : {};
}

function setJsonPathValue(
  rootValue: unknown,
  path: JsonPathPart[],
  nextValue: unknown
): unknown {
  if (!path.length) return nextValue;

  const root = Array.isArray(rootValue)
    ? [...rootValue]
    : isRecord(rootValue)
      ? { ...rootValue }
      : {};

  let cursor: unknown = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const nextKey = path[index + 1];

    if (Array.isArray(cursor)) {
      const child = cursor[Number(key)];
      const clonedChild = Array.isArray(child)
        ? [...child]
        : isRecord(child)
          ? { ...child }
          : typeof nextKey === "number"
            ? []
            : {};

      cursor[Number(key)] = clonedChild;
      cursor = clonedChild;
    } else if (isRecord(cursor)) {
      const child = cursor[String(key)];
      const clonedChild = Array.isArray(child)
        ? [...child]
        : isRecord(child)
          ? { ...child }
          : typeof nextKey === "number"
            ? []
            : {};

      cursor[String(key)] = clonedChild;
      cursor = clonedChild;
    }
  }

  const lastKey = path[path.length - 1];

  if (Array.isArray(cursor)) {
    cursor[Number(lastKey)] = nextValue;
  } else if (isRecord(cursor)) {
    cursor[String(lastKey)] = nextValue;
  }

  return root;
}

function formatConfigPath(path: JsonPathPart[]) {
  return path
    .map((part) => (typeof part === "number" ? `[${part}]` : part))
    .join(".");
}

function ConfigValueEditor({
  label,
  value,
  onChange
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </label>
        <select
          value={String(value)}
          onChange={(event) => onChange(event.target.value === "true")}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          <option value="true">Enabled / true</option>
          <option value="false">Disabled / false</option>
        </select>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </label>
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <input
        type="text"
        value={value === null || value === undefined ? "" : String(value)}
        placeholder={value === null ? "null" : ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function ConfigObjectEditor({
  value,
  onChange,
  path = []
}: {
  value: unknown;
  onChange: (path: JsonPathPart[], value: unknown) => void;
  path?: JsonPathPart[];
}) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
          Empty array: {formatConfigPath(path) || "root"}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((item, index) => {
          const nextPath = [...path, index];

          if (isRecord(item) || Array.isArray(item)) {
            return (
              <div key={formatConfigPath(nextPath)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[11px] font-extrabold text-slate-700">
                  {formatConfigPath(nextPath)}
                </div>
                <ConfigObjectEditor value={item} onChange={onChange} path={nextPath} />
              </div>
            );
          }

          return (
            <ConfigValueEditor
              key={formatConfigPath(nextPath)}
              label={formatConfigPath(nextPath)}
              value={item}
              onChange={(nextValue) => onChange(nextPath, nextValue)}
            />
          );
        })}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);

    if (!entries.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
          Empty object: {formatConfigPath(path) || "root"}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {entries.map(([key, item]) => {
          const nextPath = [...path, key];

          if (isRecord(item) || Array.isArray(item)) {
            return (
              <div key={formatConfigPath(nextPath)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-extrabold text-slate-700">
                    {formatConfigPath(nextPath)}
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    {Array.isArray(item) ? "array" : "group"}
                  </span>
                </div>
                <ConfigObjectEditor value={item} onChange={onChange} path={nextPath} />
              </div>
            );
          }

          return (
            <ConfigValueEditor
              key={formatConfigPath(nextPath)}
              label={formatConfigPath(nextPath)}
              value={item}
              onChange={(nextValue) => onChange(nextPath, nextValue)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <ConfigValueEditor
      label={formatConfigPath(path) || "value"}
      value={value}
      onChange={(nextValue) => onChange(path, nextValue)}
    />
  );
}

function PluginOperationsPanel({ items }: { items: unknown[] }) {
  const [selectedPluginId, setSelectedPluginId] = useState("");
  const [operationState, setOperationState] = useState<LoadState>("idle");
  const [operationMessage, setOperationMessage] = useState("");
  const [pluginDetails, setPluginDetails] = useState<unknown>(null);
  const [pluginConfig, setPluginConfig] = useState<unknown>(null);
  const [pluginPatchResponse, setPluginPatchResponse] = useState<unknown>(null);
  const [configSaveResponse, setConfigSaveResponse] = useState<unknown>(null);
  const [configDraft, setConfigDraft] = useState<unknown>(null);
  const [advancedJson, setAdvancedJson] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const pluginOptions = useMemo(
    () =>
      items
        .map((item, index) => ({
          item,
          index,
          id: readAdminRecordId(item, "plugins"),
          title: readAdminRecordTitle(item, "plugins"),
          enabled: readPluginEnabled(item),
          capabilityCount: readPluginCapabilityCount(item),
          configExists: isRecord(item) ? item.config_exists ?? item.configExists : undefined,
          configPath: readText(item, ["config_path", "configPath", "path"], "")
        }))
        .filter((entry) => entry.id && entry.id !== "—"),
    [items]
  );

  const selectedOption = pluginOptions.find((entry) => entry.id === selectedPluginId);
  const selectedPlugin = selectedOption?.item;
  const selectedTitle = selectedOption?.title || selectedPluginId;
  const selectedEnabled =
    readPluginEnabled(pluginDetails) ??
    readPluginEnabled(selectedPlugin);

  const detailsSource = pluginDetails || selectedPlugin;
  const capabilities = readPluginCapabilities(detailsSource);
  const capabilityCount = readPluginCapabilityCount(detailsSource);
  const configPath =
    readText(pluginConfig, ["path", "config_path", "configPath"], "") ||
    selectedOption?.configPath ||
    "—";

  function setDraft(nextDraft: unknown) {
    setConfigDraft(nextDraft);
    setAdvancedJson(JSON.stringify(nextDraft, null, 2));
  }

  function resetSelectedPlugin(nextPluginId: string) {
    setSelectedPluginId(nextPluginId);
    setOperationState("idle");
    setOperationMessage("");
    setPluginDetails(null);
    setPluginConfig(null);
    setPluginPatchResponse(null);
    setConfigSaveResponse(null);
    setConfigDraft(null);
    setAdvancedJson("");
    setAdvancedOpen(false);
  }

  async function loadPluginDetails() {
    if (!selectedPluginId) {
      setOperationState("error");
      setOperationMessage("Select a plugin_id before loading details.");
      return;
    }

    setOperationState("loading");
    setOperationMessage("");
    setPluginDetails(null);

    try {
      const result = await api.getPlugin(selectedPluginId);
      setPluginDetails(result);
      setOperationState("success");
      setOperationMessage(`Loaded plugin details for ${selectedPluginId}.`);
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not load plugin details.");
    }
  }

  async function loadPluginConfig() {
    if (!selectedPluginId) {
      setOperationState("error");
      setOperationMessage("Select a plugin_id before loading config.");
      return;
    }

    setOperationState("loading");
    setOperationMessage("");
    setPluginConfig(null);
    setConfigDraft(null);
    setAdvancedJson("");

    try {
      const result = await api.getPluginConfig(selectedPluginId);
      const editableConfig = readPluginConfigEditablePayload(result);

      setPluginConfig(result);
      setDraft(cloneJsonValue(editableConfig));
      setOperationState("success");
      setOperationMessage(`Loaded editable config for ${selectedPluginId}.`);
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not load plugin config.");
    }
  }

  async function loadPluginDetailsAndConfig() {
    if (!selectedPluginId) {
      setOperationState("error");
      setOperationMessage("Select a plugin_id before loading plugin data.");
      return;
    }

    setOperationState("loading");
    setOperationMessage("");
    setPluginDetails(null);
    setPluginConfig(null);
    setConfigDraft(null);
    setAdvancedJson("");

    try {
      const [detailsResult, configResult] = await Promise.allSettled([
        api.getPlugin(selectedPluginId),
        api.getPluginConfig(selectedPluginId)
      ]);

      if (detailsResult.status === "fulfilled") {
        setPluginDetails(detailsResult.value);
      }

      if (configResult.status === "fulfilled") {
        const editableConfig = readPluginConfigEditablePayload(configResult.value);

        setPluginConfig(configResult.value);
        setDraft(cloneJsonValue(editableConfig));
      }

      const errors = [
        detailsResult.status === "rejected" ? detailsResult.reason : null,
        configResult.status === "rejected" ? configResult.reason : null
      ].filter(Boolean);

      if (errors.length === 2) {
        throw errors[0];
      }

      setOperationState(errors.length ? "error" : "success");
      setOperationMessage(
        errors.length
          ? "Some plugin endpoints failed. Inspect loaded sections or retry individual actions."
          : `Loaded plugin details and editable config for ${selectedPluginId}.`
      );
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not load plugin data.");
    }
  }

  async function patchPluginEnabled() {
    if (!selectedPluginId) {
      setOperationState("error");
      setOperationMessage("Select a plugin_id before changing plugin state.");
      return;
    }

    const nextEnabled = selectedEnabled === true ? false : true;
    const confirmed = window.confirm(
      `${nextEnabled ? "Enable" : "Disable"} plugin "${selectedPluginId}"?\n\nThis will call PATCH /api/v1/plugins/${selectedPluginId}.`
    );

    if (!confirmed) return;

    setOperationState("loading");
    setOperationMessage("");
    setPluginPatchResponse(null);

    try {
      const result = await api.patchPlugin(selectedPluginId, {
        enabled: nextEnabled,
        source: "frontend_plugins_workspace",
        requested_at: new Date().toISOString()
      });

      setPluginPatchResponse(result);
      setOperationState("success");
      setOperationMessage(
        `Plugin state update requested. ${selectedPluginId} enabled=${String(nextEnabled)}. Refresh to confirm persisted state.`
      );
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not update plugin state.");
    }
  }

  async function savePluginConfig() {
    if (!selectedPluginId) {
      setOperationState("error");
      setOperationMessage("Select a plugin_id before saving config.");
      return;
    }

    if (!isRecord(configDraft)) {
      setOperationState("error");
      setOperationMessage("Load plugin config first. Config must be an object before saving.");
      return;
    }

    const confirmed = window.confirm(
      `Save edited config for "${selectedPluginId}"?\n\nThis will call PUT /api/v1/plugins/${selectedPluginId}/config.`
    );

    if (!confirmed) return;

    setOperationState("loading");
    setOperationMessage("");
    setConfigSaveResponse(null);

    try {
      const result = await api.putPluginConfig(selectedPluginId, configDraft);

      setConfigSaveResponse(result);
      setOperationState("success");
      setOperationMessage(`Saved plugin config for ${selectedPluginId}.`);
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not save plugin config.");
    }
  }

  function updateConfigDraft(path: JsonPathPart[], value: unknown) {
    const nextDraft = setJsonPathValue(configDraft || {}, path, value);
    setDraft(nextDraft);
  }

  function applyAdvancedJsonToForm() {
    try {
      const parsed = JSON.parse(advancedJson);

      if (!isRecord(parsed)) {
        setOperationState("error");
        setOperationMessage("Advanced JSON must be an object.");
        return;
      }

      setDraft(parsed);
      setOperationState("success");
      setOperationMessage("Advanced JSON applied to editable form.");
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
    }
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="text-sm font-extrabold text-blue-950">
            Plugin Manager
          </div>
          <div className="mt-1 text-xs leading-5 text-blue-800">
            Select a plugin, inspect capabilities, edit config through safe form controls, and use advanced raw JSON only when needed.
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm">
          {pluginOptions.length} plugin{pluginOptions.length === 1 ? "" : "s"}
        </span>
      </div>

      {pluginOptions.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-2xl border border-blue-100 bg-white p-3">
            <div className="mb-3 text-xs font-extrabold text-slate-900">
              Plugin Registry
            </div>

            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {pluginOptions.map((entry) => {
                const active = entry.id === selectedPluginId;

                return (
                  <button
                    key={`${entry.id}-${entry.index}`}
                    type="button"
                    onClick={() => resetSelectedPlugin(entry.id)}
                    className={cx(
                      "w-full rounded-xl border p-3 text-left transition",
                      active
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-blue-100 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold text-slate-900">
                          {entry.title}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-bold text-slate-500">
                          {entry.id}
                        </div>
                      </div>

                      <span
                        className={cx(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                          entry.enabled === false
                            ? "bg-red-50 text-red-700"
                            : entry.enabled === true
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {entry.enabled === null ? "unknown" : entry.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {entry.capabilityCount} capability{entry.capabilityCount === 1 ? "" : "ies"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        config {entry.configExists === false ? "missing" : "available"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4">
            {selectedPluginId ? (
              <>
                <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Plug size={17} className="shrink-0 text-blue-700" />
                      <div className="truncate text-sm font-extrabold text-slate-900">
                        {selectedTitle}
                      </div>
                    </div>
                    <div className="mt-1 break-all text-xs font-bold text-slate-500">
                      {selectedPluginId}
                    </div>
                  </div>

                  <span
                    className={cx(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                      selectedEnabled === false
                        ? "bg-red-50 text-red-700"
                        : selectedEnabled === true
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {selectedEnabled === null ? "state unknown" : selectedEnabled ? "enabled" : "disabled"}
                  </span>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Capabilities
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-slate-800">
                      {capabilityCount}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Config Path
                    </div>
                    <div className="mt-1 truncate text-xs font-extrabold text-slate-800">
                      {configPath}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      API Scope
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-slate-800">
                      Plugin Registry
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadPluginDetailsAndConfig}
                    disabled={operationState === "loading"}
                    className="primary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {operationState === "loading" && <Loader2 size={14} className="animate-spin" />}
                    Load Inspector
                  </button>

                  <button
                    type="button"
                    onClick={loadPluginDetails}
                    disabled={operationState === "loading"}
                    className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    title="GET /api/v1/plugins/:plugin_id"
                  >
                    Details
                  </button>

                  <button
                    type="button"
                    onClick={loadPluginConfig}
                    disabled={operationState === "loading"}
                    className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    title="GET /api/v1/plugins/:plugin_id/config"
                  >
                    Config
                  </button>

                  <button
                    type="button"
                    onClick={patchPluginEnabled}
                    disabled={operationState === "loading"}
                    className={cx(
                      "h-9 rounded-lg border px-4 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50",
                      selectedEnabled === false
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    )}
                    title="PATCH /api/v1/plugins/:plugin_id"
                  >
                    {selectedEnabled === false ? "Enable Plugin" : "Disable Plugin"}
                  </button>

                  <button
                    type="button"
                    onClick={savePluginConfig}
                    disabled={!isRecord(configDraft) || operationState === "loading"}
                    className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    title="PUT /api/v1/plugins/:plugin_id/config"
                  >
                    Save Config
                  </button>
                </div>

                {operationMessage && (
                  <div
                    className={cx(
                      "mb-4 rounded-xl border px-3 py-2 text-xs font-bold",
                      operationState === "error"
                        ? "border-red-100 bg-red-50 text-red-700"
                        : "border-emerald-100 bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {operationMessage}
                  </div>
                )}

                {capabilities.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-xs font-extrabold text-slate-900">
                      Capabilities
                    </div>
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {capabilities.slice(0, 8).map((capability, index) => {
                        const name = readText(capability, ["name", "id", "capability"], `Capability ${index + 1}`);
                        const outputKind = readText(capability, ["output_kind", "outputKind", "type"], "—");
                        const requiredInputs = isRecord(capability)
                          ? asArray(capability.required_inputs || capability.requiredInputs).join(", ")
                          : "";

                        return (
                          <div key={`${name}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="truncate text-xs font-extrabold text-slate-900">
                              {name}
                            </div>
                            <div className="mt-1 text-[11px] font-bold text-slate-500">
                              Output: {outputKind}
                            </div>
                            {requiredInputs && (
                              <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                                Required: {requiredInputs}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {capabilities.length > 8 && (
                      <div className="mt-2 text-[11px] font-bold text-slate-500">
                        Showing 8 of {capabilities.length} capabilities.
                      </div>
                    )}
                  </div>
                )}

                {isRecord(configDraft) ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          Config Editor
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-500">
                          Edit common plugin settings through fields. Raw JSON is hidden under Advanced.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={loadPluginConfig}
                        className="secondary-button h-8 px-3 text-xs"
                      >
                        Reload Config
                      </button>
                    </div>

                    <ConfigObjectEditor
                      value={configDraft}
                      onChange={updateConfigDraft}
                    />

                    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                      Changes are local until you click <span className="font-extrabold">Save Config</span>.
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((value) => !value)}
                        className="secondary-button h-8 px-3 text-xs"
                      >
                        {advancedOpen ? "Hide Advanced JSON" : "Show Advanced JSON"}
                      </button>

                      {advancedOpen && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-2 text-xs font-extrabold text-slate-900">
                            Advanced Raw JSON
                          </div>
                          <textarea
                            value={advancedJson}
                            onChange={(event) => setAdvancedJson(event.target.value)}
                            className="min-h-[240px] w-full rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                            spellCheck={false}
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={applyAdvancedJsonToForm}
                              className="secondary-button h-8 px-3 text-xs"
                            >
                              Apply JSON to Form
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdvancedJson(JSON.stringify(configDraft, null, 2))}
                              className="secondary-button h-8 px-3 text-xs"
                            >
                              Reset JSON
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                    Load plugin config to edit settings through a safe form.
                  </div>
                )}

                {(Boolean(pluginDetails) || Boolean(pluginConfig) || Boolean(pluginPatchResponse) || Boolean(configSaveResponse)) && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-xs font-extrabold text-slate-900">
                      API Responses
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {Boolean(pluginDetails) && (
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                          <div className="mb-2 text-xs font-extrabold text-slate-100">
                            Details Response
                          </div>
                          <pre className="max-h-[280px] overflow-auto text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(pluginDetails, null, 2)}
                          </pre>
                        </div>
                      )}

                      {Boolean(pluginConfig) && (
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                          <div className="mb-2 text-xs font-extrabold text-slate-100">
                            Config Response
                          </div>
                          <pre className="max-h-[280px] overflow-auto text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(pluginConfig, null, 2)}
                          </pre>
                        </div>
                      )}

                      {Boolean(pluginPatchResponse) && (
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                          <div className="mb-2 text-xs font-extrabold text-slate-100">
                            State Update Response
                          </div>
                          <pre className="max-h-[280px] overflow-auto text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(pluginPatchResponse, null, 2)}
                          </pre>
                        </div>
                      )}

                      {Boolean(configSaveResponse) && (
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                          <div className="mb-2 text-xs font-extrabold text-slate-100">
                            Config Save Response
                          </div>
                          <pre className="max-h-[280px] overflow-auto text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(configSaveResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyPanel
                title="Select a plugin"
                message="Choose a plugin from the registry list to inspect details, load config, edit settings or change enabled state."
                tone="info"
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="No plugins"
          message="GET /api/v1/plugins returned no plugin records. Enable the backend plugin registry or refresh after plugins are registered."
          tone="info"
        />
      )}
    </div>
  );
}

function readWeightsPayload(payload: unknown, items: unknown[]) {
  if (isRecord(payload)) return payload;

  if (items.length === 1 && isRecord(items[0])) {
    return items[0];
  }

  return {
    config: {},
    capability_weights: {},
    plugin_weights: {}
  };
}

function WeightsManagerPanel({
  payload,
  items
}: {
  payload: unknown;
  items: unknown[];
}) {
  const weightsPayload = useMemo(
    () => readWeightsPayload(payload, items),
    [payload, items]
  );

  const [operationState, setOperationState] = useState<LoadState>("idle");
  const [operationMessage, setOperationMessage] = useState("");
  const [draft, setDraft] = useState<unknown>(() => cloneJsonValue(weightsPayload));
  const [advancedJson, setAdvancedJson] = useState(() => JSON.stringify(weightsPayload, null, 2));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reloadResponse, setReloadResponse] = useState<unknown>(null);
  const [saveResponse, setSaveResponse] = useState<unknown>(null);
  const [proposalResponse, setProposalResponse] = useState<unknown>(null);
  const [proposalTarget, setProposalTarget] = useState<"capability_weights" | "plugin_weights" | "config">("capability_weights");
  const [proposalKey, setProposalKey] = useState("");
  const [proposalValue, setProposalValue] = useState("1");
  const [proposalReason, setProposalReason] = useState("Updated from frontend scoring manager");

  useEffect(() => {
    const nextDraft = cloneJsonValue(weightsPayload);
    setDraft(nextDraft);
    setAdvancedJson(JSON.stringify(nextDraft, null, 2));
    setOperationState("idle");
    setOperationMessage("");
    setReloadResponse(null);
    setSaveResponse(null);
    setProposalResponse(null);
  }, [weightsPayload]);

  const config = isRecord(draft) && isRecord(draft.config) ? draft.config : {};
  const capabilityWeights =
    isRecord(draft) && isRecord(draft.capability_weights)
      ? draft.capability_weights
      : isRecord(draft) && isRecord(draft.capabilityWeights)
        ? draft.capabilityWeights
        : {};
  const pluginWeights =
    isRecord(draft) && isRecord(draft.plugin_weights)
      ? draft.plugin_weights
      : isRecord(draft) && isRecord(draft.pluginWeights)
        ? draft.pluginWeights
        : {};

  const configCount = Object.keys(config).length;
  const capabilityCount = Object.keys(capabilityWeights).length;
  const pluginCount = Object.keys(pluginWeights).length;

  function setDraftValue(nextDraft: unknown) {
    setDraft(nextDraft);
    setAdvancedJson(JSON.stringify(nextDraft, null, 2));
  }

  function updateDraft(path: JsonPathPart[], value: unknown) {
    const nextDraft = setJsonPathValue(draft || {}, path, value);
    setDraftValue(nextDraft);
  }

  async function reloadWeights() {
    const confirmed = window.confirm(
      "Reload weights from backend configuration?\n\nThis will call POST /api/v1/weights/reload."
    );

    if (!confirmed) return;

    setOperationState("loading");
    setOperationMessage("");
    setReloadResponse(null);

    try {
      const result = await api.reloadWeights();
      setReloadResponse(result);
      setOperationState("success");
      setOperationMessage("Weights reload requested successfully. Use Refresh to load the latest persisted weights.");
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not reload weights.");
    }
  }

  async function saveWeights() {
    if (!isRecord(draft)) {
      setOperationState("error");
      setOperationMessage("Weights draft must be an object before saving.");
      return;
    }

    const confirmed = window.confirm(
      "Save edited scoring weights?\n\nThis will call POST /api/v1/weights/save and may update backend configuration."
    );

    if (!confirmed) return;

    setOperationState("loading");
    setOperationMessage("");
    setSaveResponse(null);

    try {
      const result = await api.saveWeights({
        ...draft,
        source: "frontend_scoring_workspace",
        requested_at: new Date().toISOString()
      });

      setSaveResponse(result);
      setOperationState("success");
      setOperationMessage("Weights save requested successfully. Refresh to confirm persisted state.");
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not save weights.");
    }
  }

  async function applyProposal() {
    const key = proposalKey.trim();
    const numericValue = Number(proposalValue);

    if (!key) {
      setOperationState("error");
      setOperationMessage("Enter a target key before applying a proposal.");
      return;
    }

    if (!Number.isFinite(numericValue)) {
      setOperationState("error");
      setOperationMessage("Proposal weight/value must be a valid number.");
      return;
    }

    const proposalPayload = {
      target: proposalTarget,
      key,
      value: numericValue,
      weight: numericValue,
      reason: proposalReason.trim() || "Updated from frontend scoring manager",
      source: "frontend_scoring_workspace",
      requested_at: new Date().toISOString()
    };

    const confirmed = window.confirm(
      `Apply weight proposal?\n\nTarget: ${proposalTarget}\nKey: ${key}\nValue: ${numericValue}\n\nThis will call POST /api/v1/weights/proposals/apply.`
    );

    if (!confirmed) return;

    setOperationState("loading");
    setOperationMessage("");
    setProposalResponse(null);

    try {
      const result = await api.applyWeightProposal(proposalPayload);

      setProposalResponse(result);
      setOperationState("success");
      setOperationMessage("Weight proposal submitted successfully. Refresh to confirm backend state.");
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? error.message : "Could not apply weight proposal.");
    }
  }

  function applyAdvancedJsonToForm() {
    try {
      const parsed = JSON.parse(advancedJson);

      if (!isRecord(parsed)) {
        setOperationState("error");
        setOperationMessage("Advanced weights JSON must be an object.");
        return;
      }

      setDraftValue(parsed);
      setOperationState("success");
      setOperationMessage("Advanced JSON applied to scoring form.");
    } catch (error) {
      setOperationState("error");
      setOperationMessage(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
    }
  }

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="text-sm font-extrabold text-purple-950">
            Weights Manager
          </div>
          <div className="mt-1 text-xs leading-5 text-purple-800">
            Manage scoring defaults, capability weights and plugin weights with safe form controls. Advanced JSON is available only when needed.
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-purple-700 shadow-sm">
          GET /api/v1/weights
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-purple-100 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Config Keys
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {configCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            default/min/max scoring settings
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Capability Weights
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {capabilityCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            capability-level scoring overrides
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Plugin Weights
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {pluginCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            plugin-level scoring overrides
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reloadWeights}
          disabled={operationState === "loading"}
          className="primary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="POST /api/v1/weights/reload"
        >
          {operationState === "loading" && <Loader2 size={14} className="animate-spin" />}
          Reload Weights
        </button>

        <button
          type="button"
          onClick={saveWeights}
          disabled={!isRecord(draft) || operationState === "loading"}
          className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="POST /api/v1/weights/save"
        >
          Save Weights
        </button>

        <button
          type="button"
          onClick={() => {
            const nextDraft = cloneJsonValue(weightsPayload);
            setDraftValue(nextDraft);
            setOperationState("idle");
            setOperationMessage("");
          }}
          disabled={operationState === "loading"}
          className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset Draft
        </button>
      </div>

      {operationMessage && (
        <div
          className={cx(
            "mb-4 rounded-xl border px-3 py-2 text-xs font-bold",
            operationState === "error"
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          )}
        >
          {operationMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-extrabold text-slate-900">
                General Weight Config
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                Controls default, minimum and maximum scoring weight values.
              </div>
            </div>

            {isRecord(config) && Object.keys(config).length ? (
              <ConfigObjectEditor
                value={config}
                onChange={(path, value) => updateDraft(["config", ...path], value)}
              />
            ) : (
              <EmptyPanel
                title="No config keys"
                message="The backend returned no general scoring config keys."
                tone="info"
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-extrabold text-slate-900">
                Capability Weights
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                Capability-level weights used by planner or scoring logic.
              </div>
            </div>

            {isRecord(capabilityWeights) && Object.keys(capabilityWeights).length ? (
              <ConfigObjectEditor
                value={capabilityWeights}
                onChange={(path, value) => updateDraft(["capability_weights", ...path], value)}
              />
            ) : (
              <EmptyPanel
                title="No capability weights"
                message="No capability-specific weights were returned. Use Apply Proposal if the backend supports adding one."
                tone="info"
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-extrabold text-slate-900">
                Plugin Weights
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                Plugin-level scoring overrides.
              </div>
            </div>

            {isRecord(pluginWeights) && Object.keys(pluginWeights).length ? (
              <ConfigObjectEditor
                value={pluginWeights}
                onChange={(path, value) => updateDraft(["plugin_weights", ...path], value)}
              />
            ) : (
              <EmptyPanel
                title="No plugin weights"
                message="No plugin-specific weights were returned. Use Apply Proposal if the backend supports adding one."
                tone="info"
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-extrabold text-slate-900">
                Apply Weight Proposal
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                Submit a structured proposal instead of editing raw JSON.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Target
                </label>
                <select
                  value={proposalTarget}
                  onChange={(event) =>
                    setProposalTarget(event.target.value as "capability_weights" | "plugin_weights" | "config")
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="capability_weights">Capability Weight</option>
                  <option value="plugin_weights">Plugin Weight</option>
                  <option value="config">Config Value</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Key
                </label>
                <input
                  value={proposalKey}
                  onChange={(event) => setProposalKey(event.target.value)}
                  placeholder="e.g. buffer_analysis or calculate_area"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Weight / Value
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={proposalValue}
                  onChange={(event) => setProposalValue(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Reason
                </label>
                <textarea
                  value={proposalReason}
                  onChange={(event) => setProposalReason(event.target.value)}
                  className="min-h-[82px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-700 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <button
                type="button"
                onClick={applyProposal}
                disabled={operationState === "loading"}
                className="secondary-button h-9 w-full px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                title="POST /api/v1/weights/proposals/apply"
              >
                Apply Proposal
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="secondary-button h-8 px-3 text-xs"
            >
              {advancedOpen ? "Hide Advanced JSON" : "Show Advanced JSON"}
            </button>

            {advancedOpen && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-extrabold text-slate-900">
                  Advanced Raw Weights JSON
                </div>
                <textarea
                  value={advancedJson}
                  onChange={(event) => setAdvancedJson(event.target.value)}
                  className="min-h-[260px] w-full rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                  spellCheck={false}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyAdvancedJsonToForm}
                    className="secondary-button h-8 px-3 text-xs"
                  >
                    Apply JSON to Form
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdvancedJson(JSON.stringify(draft, null, 2))}
                    className="secondary-button h-8 px-3 text-xs"
                  >
                    Reset JSON
                  </button>
                </div>
              </div>
            )}
          </div>

          {(Boolean(reloadResponse) || Boolean(saveResponse) || Boolean(proposalResponse)) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs font-extrabold text-slate-900">
                API Responses
              </div>

              <div className="space-y-3">
                {Boolean(reloadResponse) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Reload Response
                    </div>
                    <pre className="max-h-[240px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(reloadResponse, null, 2)}
                    </pre>
                  </div>
                )}

                {Boolean(saveResponse) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Save Response
                    </div>
                    <pre className="max-h-[240px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(saveResponse, null, 2)}
                    </pre>
                  </div>
                )}

                {Boolean(proposalResponse) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-extrabold text-slate-100">
                      Proposal Response
                    </div>
                    <pre className="max-h-[240px] overflow-auto text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(proposalResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
        Changes are local until you click <span className="font-extrabold">Save Weights</span>. Reload, Save and Apply Proposal use real backend POST endpoints and ask for confirmation.
      </div>
    </div>
  );
}

function AdminWorkspace({
  view,
  items,
  payload
}: {
  view: AdminWorkspaceView;
  items: unknown[];
  payload?: unknown;
}) {
  const copy = adminWorkspaceCopy(view);

  return (
    <div className="space-y-5">
      <AdminWorkspaceIntro view={view} count={items.length} />

      {view === "plugins" && (
        <PluginOperationsPanel items={items} />
      )}

      {view === "weights" && (
        <WeightsManagerPanel payload={payload} items={items} />
      )}

      {items.length ? (
        <div>
          {view === "weights" && (
            <div className="mb-3 text-sm font-extrabold text-slate-900">
              Weight Records
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {items.map((item, index) => (
              <AdminRecordCard
                key={readText(item, ["id", "plugin_id", "weight_id", "key", "name"], String(index))}
                item={item}
                view={view}
              />
            ))}
          </div>
        </div>
      ) : (
        view === "plugins" ? (
          <EmptyPanel message={copy.empty} />
        ) : null
      )}
    </div>
  );
}

function runtimeValue(payload: unknown, keys: string[], fallback = "—") {
  return readText(payload, keys, fallback);
}

function runtimeBooleanLabel(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function runtimeObject(payload: unknown, key: string) {
  if (!isRecord(payload)) return {};
  const value = payload[key];
  return isRecord(value) ? value : {};
}

function RuntimeMetricCard({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "blue" | "purple" | "amber" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-900"
      : tone === "blue"
        ? "border-blue-100 bg-blue-50 text-blue-900"
        : tone === "purple"
          ? "border-purple-100 bg-purple-50 text-purple-900"
          : tone === "amber"
            ? "border-amber-100 bg-amber-50 text-amber-900"
            : tone === "red"
              ? "border-red-100 bg-red-50 text-red-900"
              : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={cx("min-w-0 rounded-2xl border p-4 shadow-sm", toneClass)}>
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-60">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-extrabold">
        {value}
      </div>
    </div>
  );
}

function RuntimeInfoRow({
  label,
  value
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="min-w-0 break-all text-right text-xs font-bold text-slate-700">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </div>
    </div>
  );
}

function RuntimeListPanel({
  title,
  items,
  empty,
  tone = "slate",
  limit = 16
}: {
  title: string;
  items: unknown[];
  empty: string;
  tone?: "slate" | "blue" | "purple" | "amber" | "red";
  limit?: number;
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-800"
      : tone === "purple"
        ? "border-purple-100 bg-purple-50 text-purple-800"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-800"
          : tone === "red"
            ? "border-red-100 bg-red-50 text-red-800"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold text-slate-900">
          {title}
        </div>
        <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-extrabold", toneClass)}>
          {items.length}
        </span>
      </div>

      {items.length ? (
        <div className="flex max-h-[260px] flex-wrap gap-2 overflow-auto pr-1">
          {items.slice(0, limit).map((item, index) => (
            <span
              key={`${String(item)}-${index}`}
              className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              title={String(item)}
            >
              {String(item)}
            </span>
          ))}

          {items.length > limit && (
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
              +{items.length - limit} more
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {empty}
        </div>
      )}
    </div>
  );
}

function RuntimePathsPanel({ paths }: { paths: Record<string, unknown> }) {
  const entries = Object.entries(paths);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-xs font-extrabold text-slate-900">
        Runtime Paths
      </div>

      {entries.length ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {entries.map(([key, value]) => (
            <RuntimeInfoRow key={key} label={key} value={value} />
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="No runtime paths"
          message="The backend did not return runtime_paths."
          tone="info"
        />
      )}
    </div>
  );
}

function SkippedPluginsPanel({ items }: { items: unknown[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="text-xs font-extrabold text-emerald-900">
          No skipped plugins
        </div>
        <div className="mt-1 text-[11px] leading-5 text-emerald-700">
          Runtime settings did not report skipped plugin imports.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-amber-950">
            Skipped Plugins
          </div>
          <div className="mt-1 text-[11px] leading-5 text-amber-800">
            These plugins were registered as skipped or failed during import.
          </div>
        </div>

        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-amber-700 shadow-sm">
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const moduleName = readText(item, ["module", "name", "id"], `Skipped plugin ${index + 1}`);
          const error = readText(item, ["error", "message"], "No error message returned.");
          const code = isRecord(item) && isRecord(item.structured_error)
            ? readText(item.structured_error, ["code", "category"], "")
            : "";

          return (
            <div key={`${moduleName}-${index}`} className="rounded-xl border border-amber-100 bg-white p-3">
              <div className="break-all text-xs font-extrabold text-slate-900">
                {moduleName}
              </div>
              {code && (
                <div className="mt-1 text-[11px] font-bold text-amber-700">
                  {code}
                </div>
              )}
              <div className="mt-1 break-all text-[11px] leading-5 text-slate-600">
                {error}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvancedRuntimeJson({
  payload,
  title = "Advanced Raw JSON"
}: {
  payload: unknown;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="secondary-button h-8 px-3 text-xs"
      >
        {open ? "Hide Raw JSON" : "Show Raw JSON"}
      </button>

      {open && (
        <div className="mt-3">
          <div className="mb-2 text-xs font-extrabold text-slate-900">
            {title}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
            <pre className="max-h-[560px] overflow-auto text-xs leading-6 text-slate-100">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsWorkspaceManager({ payload }: { payload: unknown }) {
  const llm = runtimeObject(payload, "llm");
  const plugins = runtimeObject(payload, "plugins");
  const runtime = runtimeObject(payload, "runtime");
  const runtimePaths = runtimeObject(payload, "runtime_paths");

  const provider = readText(llm, ["provider"], "—");
  const baseUrl = readText(llm, ["base_url", "baseUrl"], "—");
  const fastModel = readText(llm, ["fast_model", "fastModel"], "—");
  const strongModel = readText(llm, ["strong_model", "strongModel"], "—");
  const defaultModel = readText(llm, ["default_model", "defaultModel"], fastModel);
  const temperature = readText(llm, ["temperature"], "—");
  const timeout = readText(llm, ["timeout_seconds", "timeoutSeconds"], "—");
  const apiKeyConfigured = isRecord(llm) ? llm.api_key_configured ?? llm.apiKeyConfigured : undefined;

  const pluginIds = asArray(plugins.plugin_ids || plugins.pluginIds);
  const moduleNames = asArray(plugins.module_names || plugins.moduleNames);
  const capabilities = asArray(plugins.capabilities);
  const enabledCapabilities = asArray(plugins.enabled_capabilities || plugins.enabledCapabilities);
  const disabledPluginIds = asArray(plugins.disabled_plugin_ids || plugins.disabledPluginIds);
  const skippedPlugins = asArray(plugins.skipped_plugins || plugins.skippedPlugins);

  const capabilityCount = readText(
    plugins,
    ["capability_count", "capabilityCount"],
    String(capabilities.length || "—")
  );
  const enabledCapabilityCount = readText(
    plugins,
    ["enabled_capability_count", "enabledCapabilityCount"],
    String(enabledCapabilities.length || "—")
  );

  const [smokeState, setSmokeState] = useState<LoadState>("idle");
  const [smokeMessage, setSmokeMessage] = useState("");
  const [smokeResponse, setSmokeResponse] = useState<unknown>(null);

  async function runLlmSmokeTest() {
    const confirmed = window.confirm(
      "Run LLM smoke test?\n\nThis calls POST /api/v1/settings/llm/smoke-test. It may use the configured LLM provider/API key."
    );

    if (!confirmed) return;

    setSmokeState("loading");
    setSmokeMessage("");
    setSmokeResponse(null);

    try {
      const result = await api.llmSmokeTest({
        source: "frontend_settings_workspace",
        prompt: "Return the word ok if the LLM integration is reachable.",
        requested_at: new Date().toISOString()
      });

      setSmokeResponse(result);
      setSmokeState("success");
      setSmokeMessage("LLM smoke test completed. Inspect the response below.");
    } catch (error) {
      setSmokeState("error");
      setSmokeMessage(error instanceof Error ? error.message : "LLM smoke test failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-blue-950">
              Settings Manager
            </div>
            <div className="mt-1 text-xs leading-5 text-blue-800">
              Inspect runtime settings, LLM configuration, plugin registry status and backend paths without relying on raw JSON.
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm">
            GET /api/v1/settings/runtime
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RuntimeMetricCard label="LLM Provider" value={provider} tone="blue" />
        <RuntimeMetricCard label="API Key" value={runtimeBooleanLabel(apiKeyConfigured)} tone={apiKeyConfigured ? "emerald" : "red"} />
        <RuntimeMetricCard label="Plugins" value={String(pluginIds.length || "—")} tone="purple" />
        <RuntimeMetricCard label="Capabilities" value={`${enabledCapabilityCount}/${capabilityCount}`} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-900">
                  LLM Runtime Configuration
                </div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                  Read-only runtime values returned by the backend. This does not enable or change LLM settings.
                </div>
              </div>

              <span
                className={cx(
                  "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                  apiKeyConfigured ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}
              >
                {apiKeyConfigured ? "configured" : "not configured"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <RuntimeInfoRow label="Provider" value={provider} />
              <RuntimeInfoRow label="Base URL" value={baseUrl} />
              <RuntimeInfoRow label="Default Model" value={defaultModel} />
              <RuntimeInfoRow label="Fast Model" value={fastModel} />
              <RuntimeInfoRow label="Strong Model" value={strongModel} />
              <RuntimeInfoRow label="Temperature" value={temperature} />
              <RuntimeInfoRow label="Timeout" value={`${timeout}s`} />
              <RuntimeInfoRow label="API Key Configured" value={runtimeBooleanLabel(apiKeyConfigured)} />
            </div>

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
              LLM and Planner are not force-enabled from this UI. Smoke Test is optional and asks for confirmation.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-extrabold text-slate-900">
              Existing LLM Settings Card
            </div>
            <LlmSettingsCard />
          </div>

          <RuntimePathsPanel paths={runtimePaths} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-extrabold text-slate-900">
              Runtime Flags
            </div>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {Object.entries(runtime).length ? (
                Object.entries(runtime).map(([key, value]) => (
                  <RuntimeInfoRow key={key} label={key} value={runtimeBooleanLabel(value)} />
                ))
              ) : (
                <div className="text-xs text-slate-500">
                  No runtime flags returned.
                </div>
              )}
            </div>
          </div>

          <SkippedPluginsPanel items={skippedPlugins} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="mb-3">
              <div className="text-xs font-extrabold text-slate-900">
                LLM Smoke Test
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                Optional connectivity check for the configured LLM provider.
              </div>
            </div>

            <button
              type="button"
              onClick={runLlmSmokeTest}
              disabled={smokeState === "loading"}
              className="primary-button h-9 w-full px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              title="POST /api/v1/settings/llm/smoke-test"
            >
              {smokeState === "loading" && <Loader2 size={14} className="animate-spin" />}
              Run Smoke Test
            </button>

            {smokeMessage && (
              <div
                className={cx(
                  "mt-3 rounded-xl border px-3 py-2 text-xs font-bold",
                  smokeState === "error"
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}
              >
                {smokeMessage}
              </div>
            )}

            {Boolean(smokeResponse) && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                <div className="mb-2 text-xs font-extrabold text-slate-100">
                  Smoke Test Response
                </div>
                <pre className="max-h-[320px] overflow-auto text-[11px] leading-5 text-slate-100">
                  {JSON.stringify(smokeResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <RuntimeListPanel
            title="Plugin IDs"
            items={pluginIds}
            empty="No plugin IDs returned."
            tone="purple"
            limit={18}
          />

          <RuntimeListPanel
            title="Enabled Capabilities"
            items={enabledCapabilities}
            empty="No enabled capabilities returned."
            tone="blue"
            limit={18}
          />

          <RuntimeListPanel
            title="Disabled Plugins"
            items={disabledPluginIds}
            empty="No disabled plugins reported."
            tone={disabledPluginIds.length ? "red" : "slate"}
            limit={10}
          />

          <RuntimeListPanel
            title="Plugin Modules"
            items={moduleNames}
            empty="No plugin modules returned."
            tone="slate"
            limit={12}
          />
        </div>
      </div>

      <AdvancedRuntimeJson payload={payload} title="Advanced Raw Runtime Settings JSON" />
    </div>
  );
}

function SystemHealthWorkspaceManager({ payload }: { payload: unknown }) {
  const status = runtimeValue(payload, ["status", "state", "health"], "unknown");
  const service = runtimeValue(payload, ["service", "name", "app"], "Smart Spatial Backend");
  const pluginModules = isRecord(payload) ? asArray(payload.plugin_modules || payload.pluginModules) : [];
  const runtimePaths = runtimeObject(payload, "runtime_paths");
  const weights = runtimeObject(payload, "weights");

  const useWeightedRouter = isRecord(payload) ? payload.use_weighted_router ?? payload.useWeightedRouter : undefined;
  const weightsPersistenceExists = isRecord(payload)
    ? payload.weights_persistence_exists ?? payload.weightsPersistenceExists
    : undefined;
  const historySize = runtimeValue(payload, ["history_size", "historySize"], "—");

  const weightsConfig = runtimeObject(weights, "config");
  const capabilityWeights = runtimeObject(weights, "capability_weights");
  const pluginWeights = runtimeObject(weights, "plugin_weights");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-emerald-950">
              Backend Health Diagnostics
            </div>
            <div className="mt-1 text-xs leading-5 text-emerald-800">
              Inspect live backend status, service metadata, weighted router state and runtime diagnostics.
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
              statusClass(status)
            )}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RuntimeMetricCard label="Service" value={service} tone="emerald" />
        <RuntimeMetricCard label="Plugin Modules" value={String(pluginModules.length || "—")} tone="purple" />
        <RuntimeMetricCard label="Weighted Router" value={runtimeBooleanLabel(useWeightedRouter)} tone={useWeightedRouter ? "emerald" : "amber"} />
        <RuntimeMetricCard label="History Size" value={historySize} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-extrabold text-slate-900">
              Health Flags
            </div>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <RuntimeInfoRow label="Status" value={status} />
              <RuntimeInfoRow label="Service" value={service} />
              <RuntimeInfoRow label="Use Weighted Router" value={runtimeBooleanLabel(useWeightedRouter)} />
              <RuntimeInfoRow label="Weights Persistence Exists" value={runtimeBooleanLabel(weightsPersistenceExists)} />
              <RuntimeInfoRow label="History Size" value={historySize} />
            </div>
          </div>

          <RuntimePathsPanel paths={runtimePaths} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-extrabold text-slate-900">
              Weights Snapshot
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <RuntimeMetricCard label="Config Keys" value={String(Object.keys(weightsConfig).length)} tone="purple" />
              <RuntimeMetricCard label="Capability Weights" value={String(Object.keys(capabilityWeights).length)} tone="blue" />
              <RuntimeMetricCard label="Plugin Weights" value={String(Object.keys(pluginWeights).length)} tone="blue" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
              {Object.entries(weightsConfig).length ? (
                Object.entries(weightsConfig).map(([key, value]) => (
                  <RuntimeInfoRow key={key} label={key} value={value} />
                ))
              ) : (
                <div className="text-xs text-slate-500">
                  No weight config returned.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <RuntimeListPanel
            title="Plugin Modules"
            items={pluginModules}
            empty="No plugin modules returned by health endpoint."
            tone="purple"
            limit={24}
          />

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs font-extrabold text-blue-950">
              Endpoint
            </div>
            <div className="mt-1 break-all text-[11px] leading-5 text-blue-800">
              GET /api/v1/health
            </div>
          </div>
        </div>
      </div>

      <AdvancedRuntimeJson payload={payload} title="Advanced Raw Health JSON" />
    </div>
  );
}

function RuntimeWorkspace({
  view,
  payload
}: {
  view: RuntimeWorkspaceView;
  payload: unknown;
}) {
  if (view === "system-health") {
    return <SystemHealthWorkspaceManager payload={payload} />;
  }

  return <SettingsWorkspaceManager payload={payload} />;
}

function formatBytes(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 0) return "—";

  if (numeric < 1024) return `${numeric} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = numeric / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function readUploadId(item: unknown) {
  return readText(item, ["upload_id", "uploadId", "id"], "");
}

function readUploadTitle(item: unknown) {
  return (
    readText(
      item,
      [
        "original_filename",
        "originalFilename",
        "filename",
        "file_name",
        "name",
        "title"
      ],
      ""
    ) || `Upload ${readUploadId(item) || "—"}`
  );
}

function readUploadBooleanLabel(item: unknown, key: string) {
  if (!isRecord(item)) return "—";

  const value = item[key];

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";

  return String(value);
}

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function UploadCard({ item }: { item: unknown }) {
  const uploadId = readUploadId(item);
  const title = readUploadTitle(item);
  const kind = readText(item, ["kind", "type"], "upload");
  const extension = readText(item, ["extension", "file_extension"], "—");
  const contentType = readText(item, ["content_type", "media_type", "mime_type"], "—");
  const sizeBytes = isRecord(item) ? item.size_bytes ?? item.size ?? item.file_size : undefined;
  const storedAt = readText(item, ["stored_at", "created_at", "uploaded_at"], "—");
  const sha256 = readText(item, ["sha256", "hash"], "");
  const parsedAvailable = readUploadBooleanLabel(item, "parsed_json_available");
  const parsedError = readText(item, ["parsed_json_error"], "");
  const userSource = isRecord(item) && isRecord(item.user_context)
    ? readText(item.user_context, ["source"], "")
    : "";

  const [metadata, setMetadata] = useState<unknown>(null);
  const [metadataState, setMetadataState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [metadataError, setMetadataError] = useState("");

  const downloadUrl = uploadId ? api.getUploadFileUrl(uploadId) : "";

  async function openMetadata() {
    if (!uploadId) return;

    setMetadataState("loading");
    setMetadataError("");

    try {
      const detail = await api.getUpload(uploadId);
      setMetadata(detail);
      setMetadataState("success");
    } catch (error) {
      setMetadata(null);
      setMetadataError(error instanceof Error ? error.message : "Could not load upload metadata.");
      setMetadataState("error");
    }
  }

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <UploadCloud size={16} className="shrink-0 text-blue-700" />
            <div className="truncate text-sm font-extrabold text-slate-900">
              {title}
            </div>
          </div>

          <div className="mt-1 break-all text-[11px] font-semibold text-slate-400">
            {uploadId || "No upload_id returned"}
          </div>
        </div>

        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
            kind.toLowerCase().includes("raster")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-blue-50 text-blue-700"
          )}
        >
          {kind}
        </span>
      </div>

      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] leading-5 text-blue-800">
        Uploads are global backend records from <span className="font-extrabold">GET /api/v1/uploads</span>.
        They are not project-attached sources unless the Projects API attaches them to a project.
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <FieldLine label="Filename" value={readText(item, ["filename"], title)} />
        <FieldLine label="Original Name" value={readText(item, ["original_filename", "originalFilename"], title)} />
        <FieldLine label="Extension" value={extension} />
        <FieldLine label="Content Type" value={contentType} />
        <FieldLine label="Size" value={formatBytes(sizeBytes)} />
        <FieldLine label="Stored At" value={storedAt} />
        <FieldLine label="Parsed JSON" value={parsedAvailable} />
        <FieldLine label="Source" value={userSource || "—"} />
        <FieldLine label="SHA-256" value={sha256 ? shortHash(sha256) : "—"} />
      </div>

      {parsedError && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Parsed JSON error: {parsedError}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openMetadata}
          disabled={!uploadId || metadataState === "loading"}
          className="secondary-button h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          title="Load metadata with GET /api/v1/uploads/{upload_id}"
        >
          {metadataState === "loading" && <Loader2 size={14} className="animate-spin" />}
          Metadata
        </button>

        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="secondary-button h-9 px-3 text-xs"
            title="Download with GET /api/v1/uploads/{upload_id}/file"
          >
            Download File
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="secondary-button h-9 px-3 text-xs opacity-50"
          >
            Download File
          </button>
        )}
      </div>

      {metadataState === "error" && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {metadataError}
        </div>
      )}

      {metadataState === "success" && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-950 p-3">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
            Upload Metadata — GET /api/v1/uploads/{uploadId}
          </div>
          <pre className="max-h-72 overflow-auto text-xs leading-6 text-slate-100">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


function UploadSection({ onUploaded }: { onUploaded: () => void }) {
  const [vectorFile, setVectorFile] = useState<File | null>(null);
  const [rasterFile, setRasterFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<"vector" | "raster" | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  async function uploadVector() {
    if (!vectorFile) return;

    setUploading("vector");
    setMessage("");
    setMessageTone("info");

    try {
      await api.uploadVector(vectorFile);
      setMessage("Vector uploaded successfully. Refreshing upload records...");
      setMessageTone("success");
      setVectorFile(null);
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vector upload failed.");
      setMessageTone("error");
    } finally {
      setUploading(null);
    }
  }

  async function uploadRaster() {
    if (!rasterFile) return;

    setUploading("raster");
    setMessage("");
    setMessageTone("info");

    try {
      await api.uploadRaster(rasterFile);
      setMessage("Raster uploaded successfully. Refreshing upload records...");
      setMessageTone("success");
      setRasterFile(null);
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Raster upload failed.");
      setMessageTone("error");
    } finally {
      setUploading(null);
    }
  }

  const messageClass =
    messageTone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : messageTone === "error"
        ? "border-red-100 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="mb-1 text-sm font-extrabold text-blue-950">
          Upload real spatial datasets
        </div>
        <div className="text-xs leading-5 text-blue-800">
          Send vectors and rasters to the backend using POST /api/v1/uploads/vector and POST /api/v1/uploads/raster. After upload, the workspace refreshes the global upload inventory from GET /api/v1/uploads.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <UploadCloud size={17} className="text-blue-700" />
            Upload Vector
          </div>

          <div className="mb-3 text-xs leading-5 text-slate-500">
            Supported examples: GeoJSON, Shapefile ZIP, GPKG, KML.
          </div>

          <input
            type="file"
            accept=".geojson,.json,.zip,.gpkg,.kml"
            onChange={(event) => setVectorFile(event.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700"
          />

          <button
            onClick={uploadVector}
            disabled={!vectorFile || uploading !== null}
            className="primary-button mt-4 h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading === "vector" && <Loader2 size={14} className="animate-spin" />}
            Upload Vector
          </button>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Database size={17} className="text-emerald-700" />
            Upload Raster
          </div>

          <div className="mb-3 text-xs leading-5 text-slate-500">
            Supported examples: GeoTIFF, DEM, NDVI raster, slope raster.
          </div>

          <input
            type="file"
            accept=".tif,.tiff,.geotiff"
            onChange={(event) => setRasterFile(event.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700"
          />

          <button
            onClick={uploadRaster}
            disabled={!rasterFile || uploading !== null}
            className="primary-button mt-4 h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading === "raster" && <Loader2 size={14} className="animate-spin" />}
            Upload Raster
          </button>
        </div>
      </div>

      {message && (
        <div className={cx("rounded-xl border px-4 py-3 text-xs font-bold", messageClass)}>
          {message}
        </div>
      )}
    </div>
  );
}


export function WorkspacePanel({
  activeView,
  onClose,
  onOpenRequest,
  onNavigate,
  onShowDataSourcePreviewOnMap,
  onUseDataSourceInQueryContext,
  mapLayers = [],
  onToggleMapLayer,
  onShowAllMapLayers,
  onHideAllMapLayers,
  onZoomToMapLayer,
  onRemoveMapLayer
}: WorkspacePanelProps) {
  const [state, setState] = useState<LoadState>("idle");
  const [payload, setPayload] = useState<unknown>(null);
  const [dashboardPayload, setDashboardPayload] = useState<DashboardPayload>({
    health: null,
    runtimeSettings: null,
    requests: [],
    projects: [],
    uploads: [],
    plugins: [],
    weights: [],
    errors: [],
    lastUpdated: ""
  });
  const [error, setError] = useState("");

  const title = titleForView(activeView);

  const items = useMemo(() => asArray(payload), [payload]);

  async function loadData() {
    setState("loading");
    setError("");

    try {
      if (activeView === "dashboard") {
        const [
          healthResult,
          projectsResult,
          uploadsResult,
          requestsResult,
          pluginsResult,
          weightsResult,
          runtimeResult
        ] = await Promise.allSettled([
          api.health(),
          api.listProjects(),
          api.listUploads(),
          api.listRequests(),
          api.listPlugins(),
          api.listWeights(),
          api.getRuntimeSettings()
        ]);

        const errors = [
          dashboardSettledError("Health", healthResult),
          dashboardSettledError("Projects", projectsResult),
          dashboardSettledError("Uploads", uploadsResult),
          dashboardSettledError("Requests", requestsResult),
          dashboardSettledError("Plugins", pluginsResult),
          dashboardSettledError("Weights", weightsResult),
          dashboardSettledError("Runtime Settings", runtimeResult)
        ].filter((item): item is DashboardApiError => Boolean(item));

        const health = settledDashboardValue(healthResult);
        const runtimeSettings = settledDashboardValue(runtimeResult);

        setDashboardPayload({
          health,
          runtimeSettings,
          projects: asArray(settledDashboardValue(projectsResult)),
          uploads: asArray(settledDashboardValue(uploadsResult)),
          requests: asArray(settledDashboardValue(requestsResult)),
          plugins: asArray(settledDashboardValue(pluginsResult)),
          weights: asArray(settledDashboardValue(weightsResult)),
          errors,
          lastUpdated: new Date().toLocaleString()
        });

        setPayload(null);
      } else if (activeView === "projects") {
        setPayload(await api.listProjects());
      } else if (activeView === "uploads" || activeView === "data-sources") {
        setPayload(await api.listUploads());
      } else if (activeView === "map-layers") {
        setPayload(await api.listRequests());
      } else if (activeView === "plugins") {
        setPayload(await api.listPlugins());
      } else if (activeView === "weights") {
        setPayload(await api.listWeights());
      } else if (activeView === "settings") {
        setPayload(await api.getRuntimeSettings());
      } else if (activeView === "system-health") {
        setPayload(await api.health());
      } else {
        setPayload(await api.listRequests());
      }

      setState("success");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load data.");
      setState("error");
    }
  }

  useEffect(() => {
    if (activeView !== "ai-query") {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  return (
    <div className="absolute inset-x-2 bottom-2 top-2 z-20 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/96 shadow-2xl shadow-slate-900/18 backdrop-blur sm:inset-4 sm:rounded-3xl xl:inset-5">
      <div className="flex h-14 min-w-0 items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            {iconForView(activeView)}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-900">{title}</div>
            <div className="truncate text-xs text-slate-500">Connected workspace module</div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <button onClick={loadData} className="secondary-button h-9 px-3 text-xs">
            <RefreshCw size={14} />
            Refresh
          </button>

          <button onClick={onClose} className="icon-button h-9 w-9" title="Close workspace">
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-56px)] overflow-y-auto p-4 sm:p-5">
        {state === "loading" && <LoadingPanel title={title} />}

        {state === "error" && (
          <ErrorPanel title={title} message={error} onRetry={loadData} />
        )}

        {state === "success" && activeView === "dashboard" && (
          <div className="space-y-5">
            <DashboardCards dashboard={dashboardPayload} />

            <DashboardSystemSummary dashboard={dashboardPayload} />

            <QuickActions onNavigate={onNavigate} onClose={onClose} />

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">
                  Recent Requests
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-500">
                  {dashboardPayload.requests.length} total
                </span>
              </div>

              {dashboardPayload.requests.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {dashboardPayload.requests.slice(0, 6).map((item, index) => (
                    <RecordCard
                      key={readRequestId(item) || index}
                      item={item}
                      onOpenRequest={onOpenRequest}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No recent requests"
                  message="Run an AI Query or refresh after backend analysis requests are available."
                  actionLabel="Open AI Query"
                  onAction={onClose}
                  tone="info"
                />
              )}
            </div>
          </div>
        )}

        {state === "success" && activeView === "projects" && (
          <ProjectsWorkspace items={items} onRefresh={loadData} />
        )}

        {state === "success" && activeView === "uploads" && (
          <div className="space-y-5">
            <UploadSection onUploaded={loadData} />

            <div>
              <div className="mb-1 text-sm font-extrabold text-slate-900">Global Upload Inventory</div>
              <div className="mb-3 text-xs leading-5 text-slate-500">
                Loaded from GET /api/v1/uploads. These records are global uploads, not project-scoped data sources.
              </div>
              {items.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {items.map((item, index) => (
                    <UploadCard key={readUploadId(item) || String(index)} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No uploads yet"
                  message="Upload vector or raster data to make datasets available for analysis."
                  tone="info"
                />
              )}
            </div>
          </div>
        )}

        {state === "success" && activeView === "data-sources" && (
          <DataSourcesWorkspace
            items={items}
            onRefresh={loadData}
            onShowDataSourcePreviewOnMap={onShowDataSourcePreviewOnMap}
            onUseDataSourceInQueryContext={onUseDataSourceInQueryContext}
          />
        )}

        {state === "success" && activeView === "map-layers" && (
          <LiveMapLayersWorkspace
            layers={mapLayers}
            requestItems={items}
            onToggleLayer={onToggleMapLayer}
            onShowAllLayers={onShowAllMapLayers}
            onHideAllLayers={onHideAllMapLayers}
            onZoomToLayer={onZoomToMapLayer}
            onRemoveLayer={onRemoveMapLayer}
            onOpenRequest={onOpenRequest}
            onClose={onClose}
          />
        )}

        {state === "success" &&
          (activeView === "outputs" || activeView === "reports") && (
            <OutputsWorkspace
              view={activeView as ResultWorkspaceView}
              items={items}
              onOpenRequest={onOpenRequest}
            />
          )}

        {state === "success" &&
          (activeView === "plugins" || activeView === "weights") && (
            <AdminWorkspace
              view={activeView as AdminWorkspaceView}
              items={items}
              payload={payload}
            />
          )}

        {state === "success" &&
          activeView !== "dashboard" &&
          activeView !== "projects" &&
          activeView !== "uploads" &&
          activeView !== "data-sources" &&
          activeView !== "map-layers" &&
          activeView !== "outputs" &&
          activeView !== "reports" &&
          activeView !== "plugins" &&
          activeView !== "weights" &&
          activeView !== "settings" &&
          activeView !== "system-health" && (
            <>
              {items.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {items.map((item, index) => (
                    <RecordCard
                      key={readRequestId(item) || readText(item, ["id", "upload_id"], String(index))}
                      item={item}
                      onOpenRequest={undefined}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No records returned"
                  message={`Refresh ${title} or check whether the backend has records for this workspace.`}
                  actionLabel="Refresh"
                  onAction={loadData}
                />
              )}
            </>
          )}

        {state === "success" && (activeView === "settings" || activeView === "system-health") && (
          <RuntimeWorkspace
            view={activeView as RuntimeWorkspaceView}
            payload={payload}
          />
        )}
      </div>
    </div>
  );
}
