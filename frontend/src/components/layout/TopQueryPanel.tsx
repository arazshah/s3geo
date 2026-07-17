import { useMemo, useState } from "react";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronUp,
  Database,
  Eye,
  FolderOpen,
  Info,
  Layers,
  Loader2,
  Play,
  Plus,
  Save,
  Sparkles,
  Wand2,
  X
} from "lucide-react";

import type { AnalysisStatus } from "../../types/ui";
import { cx } from "../../utils/cx";

type TopQueryDataSourceContext = {
  sourceId: string;
  title: string;
  featureCount?: number;
  geometryTypes?: string[];
};

type TopQueryPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  selectedProject: string;
  availableProjects: string[];
  projectLabels?: Record<string, string>;
  selectedDatasets: string[];
  availableDatasets: string[];
  datasetLabels?: Record<string, string>;
  onProjectChange: (projectId: string) => void;
  onAddDataset: (datasetId: string) => void;
  onRemoveDataset: (datasetId: string) => void;
  status: AnalysisStatus;
  message: string;
  planningPreviewSource?: "local-draft" | "backend" | "backend-failed" | "local-fallback";
  planningSteps?: string[];
  dataSourceContexts?: TopQueryDataSourceContext[];
  onRemoveDataSourceContext?: (sourceId: string) => void;
  onPreviewPlan: () => void;
  onRunAnalysis: () => void;
  onOpenRequestDetails?: () => void;
};

function getPlanningSourceMeta(
  status: AnalysisStatus,
  source: NonNullable<TopQueryPanelProps["planningPreviewSource"]>
) {
  if (status === "previewing") {
    return {
      label: "Planning",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      iconClassName: "text-blue-600",
      description: "The AI planner is preparing an execution plan."
    };
  }

  if (source === "backend") {
    return {
      label: "Backend Plan",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClassName: "text-emerald-600",
      description: "Planning steps were returned by the backend planner."
    };
  }

  if (source === "backend-failed") {
    return {
      label: "Planner Failed",
      className: "border-red-200 bg-red-50 text-red-700",
      iconClassName: "text-red-600",
      description: "The backend planner responded with a failure."
    };
  }

  if (source === "local-fallback") {
    return {
      label: "Local Fallback",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      iconClassName: "text-amber-600",
      description:
        "The backend planner is unavailable. These steps were generated locally from the current query context."
    };
  }

  return {
    label: "Local Draft",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    iconClassName: "text-slate-500",
    description:
      "These steps are a local draft generated from the current project, datasets, and query."
  };
}

function getStatusMessageClass(status: AnalysisStatus) {
  if (status === "error") return "border-red-200 bg-red-50 text-red-700";
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "running" || status === "previewing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getStepClass(
  status: AnalysisStatus,
  source: NonNullable<TopQueryPanelProps["planningPreviewSource"]>
) {
  if (status === "error" || source === "backend-failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (source === "local-fallback") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "previewing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function TopQueryPanel({
  collapsed,
  onToggle,
  query,
  onQueryChange,
  selectedProject,
  availableProjects,
  projectLabels = {},
  selectedDatasets,
  availableDatasets,
  datasetLabels = {},
  onProjectChange,
  onAddDataset,
  onRemoveDataset,
  status,
  message,
  planningPreviewSource = "local-draft",
  planningSteps = [],
  dataSourceContexts = [],
  onRemoveDataSourceContext,
  onPreviewPlan,
  onRunAnalysis,
  onOpenRequestDetails
}: TopQueryPanelProps) {
  const [datasetPickerOpen, setDatasetPickerOpen] = useState(false);

  const isBusy = status === "running" || status === "previewing";
  const isRunning = status === "running";
  const isPreviewing = status === "previewing";
  const hasQuery = Boolean(query.trim());
  const hasDataSourceContexts = dataSourceContexts.length > 0;

  const effectivePlanningSteps =
    planningSteps.length > 0
      ? planningSteps
      : [
          "Describe the analysis goal in natural language.",
          "Select a project and one or more data sources.",
          "Preview the execution plan before running the analysis."
        ];

  const projectOptions = useMemo(
    () => Array.from(new Set(availableProjects.filter(Boolean))),
    [availableProjects]
  );

  const projectLabelFor = (projectId: string) =>
    projectLabels[projectId] || projectId;

  const datasetLabelFor = (datasetId: string) =>
    datasetLabels[datasetId] || datasetId;

  const datasetOptionsToAdd = useMemo(
    () =>
      Array.from(new Set(availableDatasets.filter(Boolean))).filter(
        (datasetId) => !selectedDatasets.includes(datasetId)
      ),
    [availableDatasets, selectedDatasets]
  );

  const selectedProjectLabel = selectedProject
    ? projectLabelFor(selectedProject)
    : "No project selected";

  const planningMeta = getPlanningSourceMeta(status, planningPreviewSource);
  const totalSelectedContext =
    selectedDatasets.length + dataSourceContexts.length;

  if (collapsed) {
    return (
      <section className="relative z-40 shrink-0 border-b border-slate-200 bg-white/95 px-5 py-2.5 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Bot size={17} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-xs font-black uppercase tracking-wide text-slate-600">
                AI Query Workspace
              </div>
              <div className="truncate text-[11px] font-semibold text-slate-400">
                Query panel hidden · {selectedProjectLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            title="Show AI Query workspace"
          >
            <ChevronUp size={14} />
            Show Query
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-40 shrink-0 overflow-visible border-b border-slate-200 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/40 px-5 py-4 shadow-sm shadow-slate-200/50">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/60">
            <Bot size={20} />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-black text-slate-950">
                AI Query Command Workspace
              </h2>

              <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 md:inline-flex">
                GeoAI
              </span>
            </div>

            <p className="truncate text-xs font-semibold text-slate-500">
              Ask spatial questions, preview execution plans, and run backend GeoAI analysis.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          title="Collapse AI Query workspace"
        >
          <ChevronUp size={15} />
          Hide
        </button>
      </div>

      <div className="relative z-40 grid grid-cols-1 gap-4 overflow-visible xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
        <div className="relative overflow-visible rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <FolderOpen size={13} />
                Project Context
              </div>

              <div className="truncate text-sm font-black text-slate-900" title={selectedProject || selectedProjectLabel}>
                {selectedProjectLabel}
              </div>

              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                {projectOptions.length ? `${projectOptions.length} projects available` : "No projects loaded"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <Database size={13} />
                Data Context
              </div>

              <div className="text-sm font-black text-slate-900">
                {totalSelectedContext} selected
              </div>

              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                {availableDatasets.length} datasets available
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <Sparkles size={13} />
                Query State
              </div>

              <div className="text-sm font-black text-slate-900">
                {hasQuery ? `${query.trim().length} chars` : "Empty query"}
              </div>

              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                {isBusy ? "Processing request" : "Ready for planning"}
              </div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Wand2 size={16} className="text-blue-600" />
                Natural Language Geospatial Query
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Describe the goal, constraints, priorities, and expected outputs.
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500">
              <Info size={12} />
              Project → Data → Plan → Run
            </span>
          </div>

          <textarea
            className="h-[118px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Example: Find suitable parcels near metro stations with low slope, low vegetation, and area above 2000 square meters..."
            disabled={isBusy}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <FolderOpen size={13} />
                Active Project
              </label>

              <select
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-400"
                value={selectedProject}
                onChange={(event) => onProjectChange(event.target.value)}
                disabled={isBusy || projectOptions.length === 0}
                title="Select the project used for this AI query"
              >
                {projectOptions.length === 0 && (
                  <option value="">No projects loaded</option>
                )}

                {projectOptions.map((project) => (
                  <option
                    key={project}
                    value={project}
                    title={
                      projectLabelFor(project) !== project
                        ? `${projectLabelFor(project)} — ${project}`
                        : project
                    }
                  >
                    {projectLabelFor(project)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <Database size={13} />
                  Selected Datasets
                </label>

                <span className="text-[11px] font-bold text-slate-400">
                  {selectedDatasets.length} from selector
                </span>
              </div>

              <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                {selectedDatasets.length === 0 && (
                  <span className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-400">
                    No datasets selected from picker
                  </span>
                )}

                {selectedDatasets.map((item) => {
                  const label = datasetLabelFor(item);
                  const showsAlias = label !== item;

                  return (
                    <span
                      key={item}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-black text-blue-700 shadow-sm"
                      title={showsAlias ? `${label}\nID: ${item}` : item}
                    >
                      <span className="max-w-[240px] truncate">{label}</span>

                      {showsAlias && (
                        <span className="hidden rounded-lg bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-500 sm:inline">
                          source
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveDataset(item)}
                        disabled={isBusy}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Remove dataset"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}

                <div className="relative z-[9999]">
                  <button
                    type="button"
                    onClick={() => setDatasetPickerOpen((value) => !value)}
                    disabled={isBusy || datasetOptionsToAdd.length === 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      datasetOptionsToAdd.length
                        ? "Add a dataset to this AI query"
                        : "No more datasets available"
                    }
                  >
                    <Plus size={13} />
                    Add Dataset
                  </button>

                  {datasetPickerOpen && (
                    <div className="absolute left-0 top-10 z-[9999] w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/60">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Add dataset to query
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                          Showing readable names with source IDs when available.
                        </div>
                      </div>

                      <div className="max-h-64 overflow-auto p-1.5">
                        {datasetOptionsToAdd.map((dataset) => {
                          const label = datasetLabelFor(dataset);
                          const showsAlias = label !== dataset;

                          return (
                            <button
                              key={dataset}
                              type="button"
                              onClick={() => {
                                onAddDataset(dataset);
                                setDatasetPickerOpen(false);
                              }}
                              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                              title={showsAlias ? `${label}\nID: ${dataset}` : dataset}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-black">{label}</span>

                                {showsAlias && (
                                  <span className="mt-0.5 block truncate font-mono text-[10px] font-semibold text-slate-400">
                                    {dataset}
                                  </span>
                                )}
                              </span>

                              <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600">
                                Add
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasDataSourceContexts && (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-blue-700">
                  <Layers size={13} />
                  Data sources included from workspace context
                </div>

                <div className="text-[11px] font-bold text-blue-500">
                  Sent as data_source_ids
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {dataSourceContexts.map((source) => (
                  <span
                    key={source.sourceId}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-800 shadow-sm"
                    title={source.sourceId}
                  >
                    <span className="max-w-[260px] truncate">
                      {source.title || source.sourceId}
                    </span>

                    {typeof source.featureCount === "number" && (
                      <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                        {source.featureCount} features
                      </span>
                    )}

                    {source.geometryTypes?.length ? (
                      <span className="hidden rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-500 sm:inline-flex">
                        {source.geometryTypes.join(", ")}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onRemoveDataSourceContext?.(source.sourceId)}
                      disabled={!onRemoveDataSourceContext || isBusy}
                      className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-100 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Remove this data source from AI Query context"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPreviewPlan}
              disabled={isBusy || !hasQuery}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPreviewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              {isPreviewing ? "Previewing Plan..." : "Preview Plan"}
            </button>

            <button
              type="button"
              onClick={() => onRunAnalysis()}
              disabled={isBusy || !hasQuery}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-xs font-black text-white shadow-lg shadow-slate-300/70 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {isRunning ? "Running Analysis..." : "Run Analysis"}
            </button>

            <button
              type="button"
              disabled
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-400 shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
              title="Workflow saving will be connected in a later stage."
            >
              <Save size={15} />
              Save Workflow
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
                Soon
              </span>
            </button>

            <div
              className={cx(
                "ml-auto inline-flex min-h-10 max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold shadow-sm",
                getStatusMessageClass(status)
              )}
              title={message}
            >
              {status === "error" ? (
                <AlertTriangle size={14} />
              ) : status === "success" ? (
                <CheckCircle2 size={14} />
              ) : isBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Info size={14} />
              )}
              <span className="max-w-[360px] truncate">{message}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Sparkles size={16} className={planningMeta.iconClassName} />
                AI Planning Preview
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Execution steps generated from your current context.
              </p>
            </div>

            <span
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black",
                planningMeta.className
              )}
              title={planningMeta.description}
            >
              {isPreviewing && <Loader2 size={12} className="animate-spin" />}
              {planningMeta.label}
            </span>
          </div>

          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-semibold leading-5 text-slate-500">
            {planningMeta.description}
          </div>

          <div className="max-h-[250px] space-y-2 overflow-auto pr-1">
            {effectivePlanningSteps.map((step, index) => (
              <div
                key={`${index}-${step}`}
                className="group flex items-start gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm transition hover:border-blue-100 hover:bg-blue-50/30"
              >
                <span
                  className={cx(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black",
                    getStepClass(status, planningPreviewSource)
                  )}
                >
                  {index + 1}
                </span>

                <span className="text-xs font-semibold leading-5 text-slate-700">
                  {step}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenRequestDetails}
            disabled={!onOpenRequestDetails}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Open Request Details to inspect the submitted payload, planner response, outputs, and files."
          >
            <Eye size={14} />
            View Full Plan
          </button>
        </div>
      </div>
    </section>
  );
}
