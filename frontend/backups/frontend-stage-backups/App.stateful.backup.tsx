import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  Download,
  Eye,
  FileText,
  FolderOpen,
  HeartPulse,
  Home,
  Layers,
  MapPinned,
  Menu,
  Package,
  Play,
  Plug,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  User,
  Zap
} from "lucide-react";

import { api, type GeoQueryResponse } from "./lib/api";
import {
  analysisSummary as mockAnalysisSummary,
  datasets,
  defaultQuery,
  files as mockFiles,
  layers as mockLayers,
  navItems,
  outputBuckets,
  planSteps,
  rankingRows as mockRankingRows,
  selectedProject,
  systemStatus,
  type LayerItem,
  type NavItem,
  type OutputFile,
  type RankingRow
} from "./data/mockSpatialData";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AnalysisStatus = "idle" | "checking" | "previewing" | "running" | "success" | "error";

type AnalysisSummaryState = {
  requestId: string;
  confidence: string;
  executionTime: string;
  text: string;
};

const iconMap: Record<NavItem["iconKey"], LucideIcon> = {
  home: Home,
  bot: Bot,
  folder: FolderOpen,
  upload: UploadCloud,
  database: Database,
  layers: Layers,
  package: Package,
  fileText: FileText,
  plug: Plug,
  sliders: SlidersHorizontal,
  settings: Settings,
  activity: Activity
};

function getFileType(fileName: string): OutputFile["type"] {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".geojson")) return "geojson";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".zip")) return "zip";

  return "json";
}

function normalizeFiles(response: GeoQueryResponse): OutputFile[] | null {
  if (!response.files?.length) return null;

  return response.files.map((file) => ({
    name: file.name,
    size: file.size || "—",
    type: getFileType(file.name)
  }));
}

function normalizeRankingRows(response: GeoQueryResponse): RankingRow[] | null {
  if (!response.ranking_table?.length) return null;

  return response.ranking_table.map((row, index) => {
    const scoreValue =
      row.suitabilityScore ??
      row.suitability_score ??
      row.score ??
      row.final_score ??
      0;

    const score = Number(scoreValue);

    return {
      rank: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1),
      parcelId: String(
        row.parcelId ??
          row.parcel_id ??
          row.id ??
          row.object_id ??
          `PC-${String(index + 1).padStart(4, "0")}`
      ),
      suitabilityScore: Number.isFinite(score) ? score : 0,
      distanceToMetro: String(row.distanceToMetro ?? row.distance_to_metro ?? row.metro_distance ?? "—"),
      distanceToShoppingCenter: String(
        row.distanceToShoppingCenter ??
          row.distance_to_shopping_center ??
          row.shopping_distance ??
          "—"
      ),
      meanNdvi: String(row.meanNdvi ?? row.mean_ndvi ?? row.ndvi ?? "—"),
      meanSlope: String(row.meanSlope ?? row.mean_slope ?? row.slope ?? "—"),
      area: String(row.area ?? row.area_m2 ?? "—"),
      recommendation: String(row.recommendation ?? row.label ?? "Candidate")
    };
  });
}

function normalizeLayers(response: GeoQueryResponse): LayerItem[] | null {
  if (!response.layers?.length) return null;

  return response.layers.map((layer, index) => ({
    id: layer.id || `layer-${index + 1}`,
    name: layer.name,
    type:
      layer.type === "raster" || layer.type === "boundary" || layer.type === "analysis"
        ? layer.type
        : "vector",
    visible: layer.visible ?? true,
    color: index % 2 === 0 ? "#22c55e" : "#2563eb"
  }));
}

function LeftSidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cx(
        "sidebar-dark flex h-screen shrink-0 flex-col border-r border-white/10 text-white transition-all duration-300",
        collapsed ? "w-[76px]" : "w-[260px]"
      )}
    >
      <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/30">
          <MapPinned size={20} />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold">Smart Spatial System</div>
          </div>
        )}

        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/90 hover:bg-white/15"
          title={collapsed ? "Expand main menu" : "Collapse main menu"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = iconMap[item.iconKey];

            return (
              <button
                key={item.label}
                title={item.label}
                className={cx(
                  "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                  collapsed && "justify-center px-0",
                  item.active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {!collapsed && (
        <div className="m-3 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-4">
          <div className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-300">
            System Status
          </div>

          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-green-300">
            <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
            {systemStatus.label}
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Backend</span>
              <span className="text-green-300">{systemStatus.backend}</span>
            </div>
            <div className="flex justify-between">
              <span>API Version</span>
              <span>{systemStatus.apiVersion}</span>
            </div>
            <div className="flex justify-between">
              <span>CORS</span>
              <span>{systemStatus.cors}</span>
            </div>
            <div className="flex justify-between">
              <span>Plugin Registry</span>
              <span className="text-green-300">{systemStatus.pluginRegistry}</span>
            </div>
          </div>

          <button className="mt-4 h-9 w-full rounded-lg bg-white/10 text-xs font-bold text-white hover:bg-white/15">
            View System Health
          </button>
        </div>
      )}
    </aside>
  );
}

function Header({
  onToggleLeft,
  onMaximizeMap,
  apiHealthText,
  analysisStatus
}: {
  onToggleLeft: () => void;
  onMaximizeMap: () => void;
  apiHealthText: string;
  analysisStatus: AnalysisStatus;
}) {
  const statusLabel =
    analysisStatus === "running"
      ? "Running"
      : analysisStatus === "previewing"
        ? "Previewing"
        : analysisStatus === "success"
          ? "Ready"
          : analysisStatus === "error"
            ? "Check API"
            : "Ready";

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <button
        onClick={onToggleLeft}
        className="icon-button h-9 w-9"
        title="Toggle main menu"
      >
        <Menu size={18} />
      </button>

      <div className="flex h-10 w-[460px] max-w-[38vw] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
        <Search size={17} className="text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="Search projects, layers, reports..."
        />
        <span className="text-xs font-bold text-slate-400">⌘ K</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={cx(
            "status-pill",
            apiHealthText === "Online" ? "text-emerald-700" : "text-amber-700"
          )}
        >
          <Database size={14} />
          {apiHealthText === "Online" ? "Local Backend" : "Mock Mode"}
        </span>

        <span className="status-pill text-blue-700">
          <Zap size={14} />
          API v1
        </span>

        <span
          className={cx(
            "status-pill",
            analysisStatus === "error" ? "text-amber-700" : "text-emerald-700"
          )}
        >
          <HeartPulse size={14} />
          {statusLabel}
        </span>

        <button
          onClick={onMaximizeMap}
          className="secondary-button h-9 px-3 text-xs"
          title="Collapse panels and maximize map"
        >
          Maximize Map
        </button>

        <button className="icon-button relative h-9 w-9">
          <Bell size={17} />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            3
          </span>
        </button>

        <button className="icon-button h-9 w-9">
          <Settings size={17} />
        </button>

        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
            <User size={16} />
          </div>
          <ChevronDown size={15} className="text-slate-500" />
        </button>
      </div>
    </header>
  );
}

function TopQueryPanel({
  collapsed,
  onToggle,
  query,
  onQueryChange,
  status,
  message,
  onPreviewPlan,
  onRunAnalysis
}: {
  collapsed: boolean;
  onToggle: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  status: AnalysisStatus;
  message: string;
  onPreviewPlan: () => void;
  onRunAnalysis: () => void;
}) {
  const isBusy = status === "running" || status === "previewing";

  if (collapsed) {
    return (
      <section className="shrink-0 border-b border-slate-200 bg-white px-5 py-2">
        <div className="flex h-10 items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-900">
            <Bot size={17} className="shrink-0 text-blue-700" />
            <span className="truncate">Natural Language Geospatial Query</span>
            <span className="ml-2 truncate text-xs font-semibold text-slate-500">{message}</span>
          </div>

          <button onClick={onToggle} className="secondary-button h-8 px-3 text-xs">
            <ChevronDown size={15} />
            Show Query
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
      <div className="grid grid-cols-[1.35fr_0.95fr] gap-4">
        <div className="card rounded-xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              Natural Language Geospatial Query
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">
                ?
              </span>
            </div>

            <button
              onClick={onToggle}
              className="icon-button h-8 px-3 text-xs font-bold"
              title="Collapse Natural Language Query"
            >
              <ChevronUp size={15} />
              Hide
            </button>
          </div>

          <textarea
            className="h-[94px] w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />

          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <div className="font-bold text-slate-600">Project:</div>
            <select className="h-8 w-[260px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none">
              <option>{selectedProject}</option>
            </select>

            <div className="font-bold text-slate-600">Datasets:</div>
            <div className="flex flex-wrap gap-2">
              {datasets.map((item) => (
                <span
                  key={item}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700"
                >
                  {item}
                </span>
              ))}
              <button className="rounded-lg border border-slate-200 px-2.5 py-1 font-bold text-slate-700">
                + Add
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onPreviewPlan}
              disabled={isBusy}
              className="secondary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye size={15} />
              {status === "previewing" ? "Previewing..." : "Preview Plan"}
            </button>

            <button
              onClick={onRunAnalysis}
              disabled={isBusy || !query.trim()}
              className="primary-button h-9 px-5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={15} />
              {status === "running" ? "Running..." : "Run Analysis"}
            </button>

            <button className="secondary-button h-9 px-4 text-xs">
              <Save size={15} />
              Save Workflow
            </button>

            <div
              className={cx(
                "ml-auto rounded-lg px-3 py-2 text-xs font-bold",
                status === "error"
                  ? "bg-amber-50 text-amber-700"
                  : status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-50 text-slate-600"
              )}
            >
              {message}
            </div>
          </div>
        </div>

        <div className="card rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">AI Planning Preview</div>
            <span
              className={cx(
                "rounded-full px-2.5 py-1 text-xs font-extrabold",
                status === "running" || status === "previewing"
                  ? "bg-blue-50 text-blue-700"
                  : status === "error"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
              )}
            >
              {status === "running" || status === "previewing"
                ? "Processing"
                : status === "error"
                  ? "Mock Fallback"
                  : "Ready"}
            </span>
          </div>

          <div className="space-y-1.5">
            {planSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-2 text-xs leading-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-extrabold text-emerald-700">
                  {index + 1}
                </span>
                <span className="text-slate-700">{step}</span>
              </div>
            ))}
          </div>

          <button className="mt-3 h-8 w-full rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50">
            View Full Plan
          </button>
        </div>
      </div>
    </section>
  );
}

function MapView({ layers }: { layers: LayerItem[] }) {
  const visibleLayerCount = layers.filter((layer) => layer.visible).length;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-100">
      <div className="absolute inset-0 map-surface" />

      <div className="road left-[3%] top-[19%] w-[96%] rotate-[3deg]" />
      <div className="road left-[2%] top-[42%] w-[92%] -rotate-[7deg]" />
      <div className="road left-[8%] top-[67%] w-[84%] rotate-[4deg]" />
      <div className="road left-[18%] top-[4%] w-[78%] rotate-[34deg]" />
      <div className="road left-[42%] top-[0%] w-[70%] rotate-[90deg]" />
      <div className="road-blue left-[20%] top-[51%] w-[62%] rotate-[-18deg]" />
      <div className="road-blue left-[44%] top-[13%] w-[54%] rotate-[58deg]" />
      <div className="road-dashed left-[8%] top-[14%] w-[80%] rotate-[7deg]" />
      <div className="road-dashed left-[15%] top-[78%] w-[78%] rotate-[-5deg]" />

      {Array.from({ length: 42 }).map((_, index) => {
        const left = 9 + ((index * 17) % 78);
        const top = 11 + ((index * 23) % 70);
        const colors = ["#7dd3fc", "#86efac", "#fde68a", "#fca5a5"];
        const color = colors[index % colors.length];

        return (
          <div
            key={index}
            className="parcel"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${34 + (index % 4) * 10}px`,
              height: `${24 + (index % 3) * 8}px`,
              transform: `rotate(${(index % 7) * 7 - 18}deg)`,
              backgroundColor: color
            }}
          />
        );
      })}

      {[
        "Azadi Square",
        "Mehr Clinic",
        "Imam Hospital",
        "Gisha",
        "Enghelab Sq.",
        "District 6",
        "District 11"
      ].map((label, index) => (
        <div
          key={label}
          className="map-label"
          style={{
            left: `${12 + index * 11}%`,
            top: `${12 + ((index * 17) % 70)}%`
          }}
        >
          {label}
        </div>
      ))}

      {[
        ["M", "18%", "25%"],
        ["M", "34%", "18%"],
        ["M", "58%", "22%"],
        ["M", "72%", "36%"],
        ["M", "45%", "67%"],
        ["M", "82%", "63%"]
      ].map(([text, left, top], index) => (
        <div
          key={index}
          className="absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-extrabold text-white shadow"
          style={{ left, top }}
        >
          {text}
        </div>
      ))}

      <div className="absolute left-[42%] top-[40%] flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-red-500 text-sm font-extrabold text-white shadow-xl">
        1
      </div>

      <div className="absolute left-[48%] top-[31%] w-[245px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
        <button className="absolute right-2 top-2 text-slate-400">×</button>
        <div className="font-extrabold text-slate-900">Rank: #1</div>
        <div className="mt-1 space-y-0.5 text-slate-700">
          <div>
            Suitability Score: <b>92</b>
          </div>
          <div>Distance to Metro: 420 m</div>
          <div>Distance to Shopping Center: 680 m</div>
          <div>Mean NDVI: 0.18</div>
          <div>Mean Slope: 4.7%</div>
          <div>Area: 3,250 m²</div>
        </div>
      </div>

      <div className="absolute left-4 top-4 w-[220px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold text-slate-900">Legend</div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            {visibleLayerCount} visible
          </span>
        </div>

        <div className="mb-2 text-xs font-bold text-slate-700">Suitability Score</div>

        {[
          ["80 - 100 (High)", "#22c55e"],
          ["60 - 80 (Good)", "#38bdf8"],
          ["40 - 60 (Moderate)", "#facc15"],
          ["20 - 40 (Low)", "#ef4444"]
        ].map(([label, color]) => (
          <div key={label} className="mb-1.5 flex items-center gap-2 text-xs text-slate-700">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}

        <div className="mt-3 space-y-1.5 text-xs text-slate-700">
          {layers.slice(0, 5).map((layer) => (
            <div key={layer.id} className={cx(!layer.visible && "opacity-40")}>
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: layer.color }} />
              {layer.name}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        {[
          [<Menu size={17} />, "Select"],
          [<Layers size={17} />, "Layers"],
          [<Eye size={17} />, "Visibility"],
          [<ShieldCheck size={17} />, "Fit"],
          [<Download size={17} />, "Export"]
        ].map(([icon, label], index) => (
          <button
            key={String(label)}
            className={cx(
              "flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-700",
              index !== 4 && "border-b border-slate-100"
            )}
            title={String(label)}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="absolute right-4 top-[245px] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <button className="flex h-10 w-10 items-center justify-center border-b border-slate-100 text-xl font-bold text-slate-700">
          +
        </button>
        <button className="flex h-10 w-10 items-center justify-center text-xl font-bold text-slate-700">
          −
        </button>
      </div>

      <div className="absolute bottom-4 left-4 h-2 w-[180px] rounded-full bg-slate-900/80">
        <div className="mt-3 flex justify-between text-[11px] font-bold text-slate-700">
          <span>0</span>
          <span>500</span>
          <span>1,000 m</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow">
        35.6992° N, 51.3886° E
      </div>
    </div>
  );
}

function RightPanel({
  collapsed,
  onToggle,
  layers,
  onToggleLayer,
  summary,
  apiHealthText
}: {
  collapsed: boolean;
  onToggle: () => void;
  layers: LayerItem[];
  onToggleLayer: (layerId: string) => void;
  summary: AnalysisSummaryState;
  apiHealthText: string;
}) {
  if (collapsed) {
    return (
      <aside className="flex h-full w-[52px] shrink-0 flex-col items-center border-l border-slate-200 bg-white">
        <button
          onClick={onToggle}
          className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
          title="Show analysis result"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="mt-5 flex rotate-90 items-center gap-2 whitespace-nowrap text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Analysis Result
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="text-sm font-extrabold text-slate-900">Analysis Result</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
            Success
          </span>
          <button onClick={onToggle} className="icon-button h-8 w-8" title="Hide analysis result">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="border-b border-slate-200 pb-4">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Request ID:</span>
              <span className="font-bold text-slate-700">{summary.requestId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Confidence:</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">
                {summary.confidence}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Execution Time:</span>
              <span className="font-bold text-slate-700">{summary.executionTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Backend:</span>
              <span
                className={cx(
                  "font-bold",
                  apiHealthText === "Online" ? "text-emerald-700" : "text-amber-700"
                )}
              >
                {apiHealthText}
              </span>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-2 text-sm font-extrabold text-slate-900">1. Summary</h3>
          <p className="text-xs leading-5 text-slate-700">{summary.text}</p>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">2. Output Buckets</h3>
          <div className="grid grid-cols-3 gap-2">
            {outputBuckets.map((bucket) => (
              <div key={bucket.label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-bold text-slate-500">{bucket.label}</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{bucket.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">3. Map Layers</h3>
          <div className="space-y-2">
            {layers.map((layer) => (
              <label key={layer.id} className="flex items-center justify-between gap-3 text-xs">
                <span
                  className={cx(
                    "flex items-center gap-2 font-semibold text-slate-700",
                    !layer.visible && "opacity-45"
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-sm border border-white shadow-sm"
                    style={{ backgroundColor: layer.color }}
                  />
                  {layer.name}
                </span>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => onToggleLayer(layer.id)}
                  className="accent-blue-600"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-2 text-sm font-extrabold text-slate-900">4. Warnings</h3>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={15} />
            No critical warnings
          </div>
        </section>

        <section className="py-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">5. Next Actions</h3>
          <div className="space-y-2">
            <button className="primary-button h-9 w-full text-xs">
              Open Full Report
            </button>
            <button className="secondary-button h-9 w-full text-xs">
              <Download size={15} />
              Download GeoJSON
            </button>
            <button className="secondary-button h-9 w-full text-xs">
              <FileText size={15} />
              Download PDF
            </button>
            <button className="secondary-button h-9 w-full text-xs">
              <Save size={15} />
              Save Outputs
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

function BottomDrawer({
  collapsed,
  onToggle,
  rankingRows,
  files
}: {
  collapsed: boolean;
  onToggle: () => void;
  rankingRows: RankingRow[];
  files: OutputFile[];
}) {
  return (
    <section
      className={cx(
        "shrink-0 border-t border-slate-200 bg-white transition-all duration-300",
        collapsed ? "h-[48px]" : "h-[230px]"
      )}
    >
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {["Outputs", "Ranking Table", "Files", "Reports", "Trace", "Metadata"].map((tab, index) => (
            <button
              key={tab}
              className={cx(
                "h-8 rounded-lg px-3 text-xs font-extrabold",
                index === 1
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!collapsed && (
            <button className="secondary-button h-8 px-3 text-xs">
              <Download size={14} />
              Export Table
            </button>
          )}

          <button
            onClick={onToggle}
            className="icon-button h-8 w-8"
            title={collapsed ? "Show outputs drawer" : "Hide outputs drawer"}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="grid h-[182px] grid-cols-[1fr_330px] gap-4 px-4 pb-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    "Rank",
                    "Parcel ID",
                    "Suitability Score",
                    "Distance to Metro",
                    "Distance to Shopping Center",
                    "Mean NDVI",
                    "Mean Slope",
                    "Area",
                    "Recommendation"
                  ].map((header) => (
                    <th key={header} className="px-3 py-3 text-left font-extrabold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rankingRows.map((row) => (
                  <tr key={`${row.rank}-${row.parcelId}`} className="border-t border-slate-200 text-slate-700">
                    <td className="px-3 py-3">{row.rank}</td>
                    <td className="px-3 py-3 font-extrabold text-slate-900">{row.parcelId}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 font-extrabold text-emerald-700">
                        {row.suitabilityScore}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.distanceToMetro}</td>
                    <td className="px-3 py-3">{row.distanceToShoppingCenter}</td>
                    <td className="px-3 py-3">{row.meanNdvi}</td>
                    <td className="px-3 py-3">{row.meanSlope}</td>
                    <td className="px-3 py-3">{row.area}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 font-extrabold text-blue-700">
                        {row.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
              Showing 1 to {rankingRows.length} of {Math.max(rankingRows.length, 12)} results
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3">
              <div className="text-xs font-extrabold text-slate-900">Files ({files.length})</div>
            </div>

            <div className="h-[140px] overflow-y-auto p-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="mb-1.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <span className="truncate font-semibold text-slate-700">{file.name}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{file.size}</span>
                  <Download size={13} className="ml-2 shrink-0 text-blue-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  const [query, setQuery] = useState(defaultQuery);
  const [layerItems, setLayerItems] = useState<LayerItem[]>(mockLayers);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>(mockRankingRows);
  const [files, setFiles] = useState<OutputFile[]>(mockFiles);
  const [summary, setSummary] = useState<AnalysisSummaryState>(mockAnalysisSummary);
  const [apiHealthText, setApiHealthText] = useState("Checking");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("checking");
  const [message, setMessage] = useState("Checking backend connection...");

  const selectedDatasets = useMemo(() => datasets, []);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const health = await api.health();

        if (!mounted) return;

        setApiHealthText("Online");
        setAnalysisStatus("idle");
        setMessage(
          String(health.status || health.service || health.version || "Backend online")
        );
      } catch {
        if (!mounted) return;

        setApiHealthText("Offline");
        setAnalysisStatus("idle");
        setMessage("Backend unavailable. Using mock data.");
      }
    }

    checkHealth();

    return () => {
      mounted = false;
    };
  }, []);

  function maximizeMap() {
    setLeftCollapsed(true);
    setTopCollapsed(true);
    setRightCollapsed(true);
    setBottomCollapsed(true);
  }

  function toggleLayer(layerId: string) {
    setLayerItems((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }

  async function handlePreviewPlan() {
    setAnalysisStatus("previewing");
    setMessage("Generating AI execution plan...");

    try {
      await api.previewPlan({
        project_id: selectedProject,
        query,
        datasets: selectedDatasets,
        options: {
          generate_report: true,
          generate_map_layers: true,
          return_geojson: true,
          return_ranking_table: true
        }
      });

      setAnalysisStatus("success");
      setMessage("AI plan preview is ready.");
    } catch {
      setAnalysisStatus("error");
      setMessage("Preview endpoint unavailable. Showing mock AI plan.");
    }
  }

  async function handleRunAnalysis() {
    setAnalysisStatus("running");
    setMessage("Running spatial analysis...");

    try {
      const response = await api.runGeoQuery({
        project_id: selectedProject,
        query,
        datasets: selectedDatasets,
        options: {
          generate_report: true,
          generate_map_layers: true,
          return_geojson: true,
          return_ranking_table: true
        }
      });

      const nextRows = normalizeRankingRows(response);
      const nextFiles = normalizeFiles(response);
      const nextLayers = normalizeLayers(response);

      if (nextRows) setRankingRows(nextRows);
      if (nextFiles) setFiles(nextFiles);
      if (nextLayers) setLayerItems(nextLayers);

      setSummary({
        requestId: response.request_id || mockAnalysisSummary.requestId,
        confidence:
          typeof response.confidence === "number"
            ? `${Math.round(response.confidence * 100)}%`
            : String(response.confidence || mockAnalysisSummary.confidence),
        executionTime:
          typeof response.execution_time_ms === "number"
            ? `${(response.execution_time_ms / 1000).toFixed(1)}s`
            : mockAnalysisSummary.executionTime,
        text: response.summary || mockAnalysisSummary.text
      });

      setAnalysisStatus("success");
      setMessage("Analysis completed successfully.");
      setRightCollapsed(false);
      setBottomCollapsed(false);
    } catch {
      setAnalysisStatus("error");
      setMessage("API run failed. Keeping mock analysis output.");
      setRightCollapsed(false);
      setBottomCollapsed(false);
    }
  }

  return (
    <div className="app-shell flex">
      <LeftSidebar
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed((value) => !value)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onToggleLeft={() => setLeftCollapsed((value) => !value)}
          onMaximizeMap={maximizeMap}
          apiHealthText={apiHealthText}
          analysisStatus={analysisStatus}
        />

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <TopQueryPanel
              collapsed={topCollapsed}
              onToggle={() => setTopCollapsed((value) => !value)}
              query={query}
              onQueryChange={setQuery}
              status={analysisStatus}
              message={message}
              onPreviewPlan={handlePreviewPlan}
              onRunAnalysis={handleRunAnalysis}
            />

            <div className="min-h-0 flex-1">
              <MapView layers={layerItems} />
            </div>

            <BottomDrawer
              collapsed={bottomCollapsed}
              onToggle={() => setBottomCollapsed((value) => !value)}
              rankingRows={rankingRows}
              files={files}
            />
          </main>

          <RightPanel
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((value) => !value)}
            layers={layerItems}
            onToggleLayer={toggleLayer}
            summary={summary}
            apiHealthText={apiHealthText}
          />
        </div>
      </div>
    </div>
  );
}
