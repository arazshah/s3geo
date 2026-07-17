import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Database,
  FileText,
  FolderOpen,
  HeartPulse,
  Home,
  Layers,
  Maximize2,
  Menu,
  Package,
  Search,
  Server,
  Settings,
  SlidersHorizontal,
  UploadCloud,
  Zap
} from "lucide-react";

import type { AnalysisStatus, NavView } from "../../types/ui";
import { cx } from "../../utils/cx";

type HeaderProps = {
  activeView: NavView;
  onToggleLeft: () => void;
  onMaximizeMap: () => void;
  apiHealthText: string;
  analysisStatus: AnalysisStatus;
};

const workspaceCopy: Record<NavView, { title: string; subtitle: string; icon: LucideIcon }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Operational overview and recent spatial activity",
    icon: Home
  },
  "ai-query": {
    title: "AI Query",
    subtitle: "Natural language geospatial analysis workspace",
    icon: Bot
  },
  projects: {
    title: "Projects",
    subtitle: "Manage study areas, project context, and spatial datasets",
    icon: FolderOpen
  },
  uploads: {
    title: "Uploads",
    subtitle: "Upload vector, raster, and supporting geospatial files",
    icon: UploadCloud
  },
  "data-sources": {
    title: "Data Sources",
    subtitle: "Inspect backend data sources and project-ready datasets",
    icon: Database
  },
  "map-layers": {
    title: "Map Layers",
    subtitle: "Review generated map layers and spatial visualization outputs",
    icon: Layers
  },
  outputs: {
    title: "Outputs",
    subtitle: "Browse analysis outputs, rankings, and generated artifacts",
    icon: BarChart3
  },
  reports: {
    title: "Reports",
    subtitle: "Access generated reports and export-ready deliverables",
    icon: FileText
  },
  plugins: {
    title: "Plugins",
    subtitle: "Manage GeoAI processing plugins and operational extensions",
    icon: Package
  },
  weights: {
    title: "Weights",
    subtitle: "Tune suitability weights, criteria, and ranking configuration",
    icon: SlidersHorizontal
  },
  settings: {
    title: "Settings",
    subtitle: "Configure application preferences and integration options",
    icon: Settings
  },
  "system-health": {
    title: "System Health",
    subtitle: "Monitor backend availability, capabilities, and API readiness",
    icon: HeartPulse
  }
};

function getAnalysisStatusLabel(status: AnalysisStatus) {
  if (status === "running") return "Analysis Running";
  if (status === "previewing") return "Plan Previewing";
  if (status === "success") return "Workspace Ready";
  if (status === "error") return "Action Required";

  return "Workspace Ready";
}

function getAnalysisStatusTone(status: AnalysisStatus) {
  if (status === "running" || status === "previewing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "error") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getBackendStatus(apiHealthText: string) {
  const normalized = apiHealthText.trim().toLowerCase();

  if (normalized === "online") {
    return {
      label: "Backend Online",
      detail: "API Connected",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]"
    };
  }

  if (normalized === "offline") {
    return {
      label: "Backend Offline",
      detail: "API Unreachable",
      tone: "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]"
    };
  }

  return {
    label: "Checking Backend",
    detail: "API Checking",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.55)]"
  };
}

export function Header({
  activeView,
  onToggleLeft,
  onMaximizeMap,
  apiHealthText,
  analysisStatus
}: HeaderProps) {
  const workspace = workspaceCopy[activeView] ?? workspaceCopy.dashboard;
  const WorkspaceIcon = workspace.icon;
  const backendStatus = getBackendStatus(apiHealthText);
  const analysisLabel = getAnalysisStatusLabel(analysisStatus);
  const analysisTone = getAnalysisStatusTone(analysisStatus);

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/95 px-4 shadow-sm shadow-slate-200/40 backdrop-blur">
      <button
        type="button"
        onClick={onToggleLeft}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        title="Toggle main menu"
        aria-label="Toggle main menu"
      >
        <Menu size={18} />
      </button>

      <div className="min-w-[180px] max-w-[320px]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <WorkspaceIcon size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-black leading-5 text-slate-950">
              {workspace.title}
            </h1>
            <p className="truncate text-[11px] font-semibold leading-4 text-slate-500">
              {workspace.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="hidden h-10 min-w-[260px] max-w-[34vw] flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 shadow-inner shadow-white lg:flex">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
          placeholder="Search projects, layers, reports..."
          aria-label="Search projects, layers, reports"
        />
        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-400">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span
          className={cx(
            "hidden h-9 items-center gap-2 rounded-2xl border px-3 text-xs font-black shadow-sm xl:flex",
            backendStatus.tone
          )}
          title={`${backendStatus.label} · ${backendStatus.detail}`}
        >
          <span className={cx("h-2 w-2 rounded-full", backendStatus.dot)} />
          <Server size={14} />
          {backendStatus.label}
        </span>

        <span
          className={cx(
            "flex h-9 items-center gap-2 rounded-2xl border px-3 text-xs font-black shadow-sm",
            backendStatus.tone
          )}
          title={backendStatus.detail}
        >
          <Database size={14} />
          <span className="hidden sm:inline">{backendStatus.detail}</span>
          <span className="sm:hidden">API</span>
        </span>

        <span
          className={cx(
            "hidden h-9 items-center gap-2 rounded-2xl border px-3 text-xs font-black shadow-sm lg:flex",
            analysisTone
          )}
          title={analysisLabel}
        >
          <HeartPulse size={14} />
          {analysisLabel}
        </span>

        <button
          type="button"
          onClick={onMaximizeMap}
          className="flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          title="Collapse panels and maximize map"
          aria-label="Collapse panels and maximize map"
        >
          <Maximize2 size={14} />
          <span className="hidden md:inline">Maximize Map</span>
        </button>

        <span className="hidden h-9 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 shadow-sm 2xl:flex">
          <Zap size={14} />
          Operational
        </span>
      </div>
    </header>
  );
}
