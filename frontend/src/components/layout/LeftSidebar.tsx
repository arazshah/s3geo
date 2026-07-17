import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Home,
  Layers,
  Package,
  Plug,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  UploadCloud
} from "lucide-react";

import { api } from "../../lib/api";
import type { NavView } from "../../types/ui";
import { cx } from "../../utils/cx";

const sidebarBrand = {
  logo: "S³",
  name: "S³Geo",
  domain: "s3geo.com",
  tagline: "Smart Spatial System",
  workspace: "GeoAI Operational Workspace",
  credit: "Built by Araz Shahkarami",
  creatorUrl: "araz.me"
};

type SidebarNavItem = {
  label: string;
  view: NavView;
  icon: LucideIcon;
  description: string;
  badge?: "API" | "Beta" | "New";
};

type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
};

const navSections: SidebarNavSection[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Dashboard",
        view: "dashboard",
        icon: Home,
        description: "Operational overview"
      },
      {
        label: "AI Query",
        view: "ai-query",
        icon: Bot,
        description: "Natural language analysis",
        badge: "API"
      },
      {
        label: "Projects",
        view: "projects",
        icon: FolderOpen,
        description: "Manage spatial projects"
      }
    ]
  },
  {
    title: "Data Operations",
    items: [
      {
        label: "Uploads",
        view: "uploads",
        icon: UploadCloud,
        description: "Upload vectors and rasters",
        badge: "API"
      },
      {
        label: "Data Sources",
        view: "data-sources",
        icon: Database,
        description: "Connected datasets"
      },
      {
        label: "Map Layers",
        view: "map-layers",
        icon: Layers,
        description: "Layer catalog and visibility"
      }
    ]
  },
  {
    title: "Outputs",
    items: [
      {
        label: "Results",
        view: "outputs",
        icon: Package,
        description: "Analysis results"
      },
      {
        label: "Reports",
        view: "reports",
        icon: FileText,
        description: "Generated reports and files"
      }
    ]
  },
  {
    title: "Administration",
    items: [
      {
        label: "Plugins",
        view: "plugins",
        icon: Plug,
        description: "Plugin registry"
      },
      {
        label: "Scoring",
        view: "weights",
        icon: SlidersHorizontal,
        description: "Weights and ranking"
      },
      {
        label: "Settings",
        view: "settings",
        icon: Settings,
        description: "Frontend preferences"
      },
      {
        label: "System Health",
        view: "system-health",
        icon: Activity,
        description: "Backend diagnostics"
      }
    ]
  }
];

type LeftSidebarProps = {
  collapsed: boolean;
  activeView: NavView;
  onToggle: () => void;
  onNavigate: (view: NavView) => void;
};

function badgeClass(badge: SidebarNavItem["badge"]) {
  if (badge === "API") {
    return "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20";
  }

  if (badge === "New") {
    return "bg-blue-400/15 text-blue-200 ring-1 ring-blue-300/20";
  }

  if (badge === "Beta") {
    return "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/20";
  }

  return "";
}

function normalizeSidebarStatusValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || "—";
}

function isSidebarStatusPositive(value: unknown) {
  const text = normalizeSidebarStatusValue(value).toLowerCase();

  return [
    "active",
    "enabled",
    "ok",
    "online",
    "operational",
    "ready",
    "true",
    "yes"
  ].some((token) => text.includes(token));
}

function isSidebarStatusNegative(value: unknown) {
  const text = normalizeSidebarStatusValue(value).toLowerCase();

  return [
    "disabled",
    "down",
    "error",
    "failed",
    "false",
    "offline",
    "unavailable"
  ].some((token) => text.includes(token));
}

function sidebarStatusValueClass(value: unknown) {
  if (isSidebarStatusPositive(value)) return "text-emerald-300";
  if (isSidebarStatusNegative(value)) return "text-red-300";
  return "text-amber-200";
}

function sidebarStatusDotClass(value: unknown) {
  if (isSidebarStatusPositive(value)) {
    return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]";
  }

  if (isSidebarStatusNegative(value)) {
    return "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]";
  }

  return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]";
}

function SidebarStatusRow({
  label,
  value
}: {
  label: string;
  value: unknown;
}) {
  const normalizedValue = normalizeSidebarStatusValue(value);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
      <span className="min-w-0 truncate text-[11px] font-bold text-slate-400">
        {label}
      </span>

      <span className={cx("flex shrink-0 items-center gap-1.5 text-[11px] font-extrabold", sidebarStatusValueClass(value))}>
        <span className={cx("h-1.5 w-1.5 rounded-full", sidebarStatusDotClass(value))} />
        {normalizedValue}
      </span>
    </div>
  );
}



type SidebarLiveHealth = {
  state: "checking" | "online" | "offline";
  label: string;
  backend: string;
  service: string;
  apiVersion: string;
  cors: string;
  pluginRegistry: string;
  pluginCount: string;
  weightedRouter: string;
  lastChecked: string;
  error: string;
};

function readSidebarText(payload: unknown, keys: string[], fallback = "—") {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function readSidebarArrayLength(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object") return 0;

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) return value.length;
  }

  return 0;
}

function readSidebarBoolean(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object") return undefined;

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") return value;
  }

  return undefined;
}

function createSidebarOfflineHealth(error = ""): SidebarLiveHealth {
  return {
    state: "offline",
    label: "System Unavailable",
    backend: "Offline",
    service: "Backend unreachable",
    apiVersion: "—",
    cors: "Unknown",
    pluginRegistry: "Unavailable",
    pluginCount: "0",
    weightedRouter: "Unknown",
    lastChecked: new Date().toLocaleTimeString(),
    error
  };
}

function createSidebarCheckingHealth(): SidebarLiveHealth {
  return {
    state: "checking",
    label: "Checking System Health",
    backend: "Checking",
    service: "Loading backend status",
    apiVersion: "—",
    cors: "Unknown",
    pluginRegistry: "Checking",
    pluginCount: "—",
    weightedRouter: "Unknown",
    lastChecked: "",
    error: ""
  };
}

function createSidebarOnlineHealth(payload: unknown): SidebarLiveHealth {
  const status = readSidebarText(payload, ["status", "state", "health"], "ok");
  const service = readSidebarText(payload, ["service", "name", "app"], "Backend reachable");
  const version = readSidebarText(payload, ["version", "api_version", "apiVersion"], "—");
  const cors = readSidebarText(payload, ["cors", "cors_enabled", "corsEnabled"], "Unknown");
  const pluginCount = readSidebarArrayLength(payload, ["plugin_modules", "pluginModules", "plugins"]);
  const weightedRouter = readSidebarBoolean(payload, ["use_weighted_router", "useWeightedRouter"]);

  return {
    state: "online",
    label:
      status.toLowerCase() === "ok"
        ? "Backend Operational"
        : status.toLowerCase() === "online"
          ? "Backend Reachable"
          : status,
    backend: "Online",
    service,
    apiVersion: version,
    cors,
    pluginRegistry: pluginCount > 0 ? "Active" : "Unknown",
    pluginCount: pluginCount ? String(pluginCount) : "—",
    weightedRouter:
      weightedRouter === undefined ? "Unknown" : weightedRouter ? "Enabled" : "Disabled",
    lastChecked: new Date().toLocaleTimeString(),
    error: ""
  };
}

export function LeftSidebar({
  collapsed,
  activeView,
  onToggle,
  onNavigate
}: LeftSidebarProps) {
  const [liveHealth, setLiveHealth] = useState<SidebarLiveHealth>(() => createSidebarCheckingHealth());
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [statusCardExpanded, setStatusCardExpanded] = useState(() => {
    if (typeof window === "undefined") return false;

    try {
      return window.localStorage.getItem("smart-spatial-sidebar-system-status-expanded") === "true";
    } catch {
      return false;
    }
  });

  async function refreshSidebarHealth() {
    setStatusRefreshing(true);

    try {
      const payload = await api.health();
      setLiveHealth(createSidebarOnlineHealth(payload));
    } catch (error) {
      setLiveHealth(
        createSidebarOfflineHealth(
          error instanceof Error
            ? error.message
            : "Could not reach backend health endpoint."
        )
      );
    } finally {
      setStatusRefreshing(false);
    }
  }

  function toggleStatusCardExpanded() {
    setStatusCardExpanded((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          "smart-spatial-sidebar-system-status-expanded",
          String(next)
        );
      } catch {
        // localStorage may be unavailable.
      }

      return next;
    });
  }

  useEffect(() => {
    void refreshSidebarHealth();

    const interval = window.setInterval(() => {
      void refreshSidebarHealth();
    }, 30000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <aside
      className={cx(
        "sidebar-dark flex h-screen shrink-0 flex-col border-r border-white/10 text-white transition-all duration-300",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
    >
      <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <a
          href="https://s3geo.com"
          target="_blank"
          rel="noreferrer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 text-base font-black tracking-tight text-slate-950 shadow-lg shadow-blue-950/30 transition hover:scale-[1.03]"
          title="S³Geo — s3geo.com"
          aria-label="Open S3Geo website"
        >
          {sidebarBrand.logo}
        </a>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <a
                href="https://s3geo.com"
                target="_blank"
                rel="noreferrer"
                className="truncate text-[15px] font-black leading-5 text-white transition hover:text-cyan-200"
                title="S³Geo — s3geo.com"
              >
                {sidebarBrand.name}
              </a>
              <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">
                GeoAI
              </span>
            </div>

            <div className="mt-0.5 truncate text-[11px] font-extrabold text-slate-400">
              {sidebarBrand.tagline}
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/90 transition hover:bg-white/15"
          title={collapsed ? "Expand main menu" : "Collapse main menu"}
          aria-label={collapsed ? "Expand main menu" : "Collapse main menu"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  {section.title}
                </div>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.view;

                  return (
                    <button
                      key={item.view}
                      title={`${item.label} — ${item.description}`}
                      onClick={() => onNavigate(item.view)}
                      className={cx(
                        "group flex h-11 w-full items-center rounded-xl text-sm font-semibold transition",
                        collapsed ? "justify-center px-0" : "gap-3 px-3",
                        active
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon size={18} className="shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate">
                              {item.label}
                            </span>
                            <span
                              className={cx(
                                "block truncate text-[10px] font-bold",
                                active
                                  ? "text-blue-100"
                                  : "text-slate-500 group-hover:text-slate-300"
                              )}
                            >
                              {item.description}
                            </span>
                          </span>

                          {item.badge && (
                            <span
                              className={cx(
                                "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold",
                                badgeClass(item.badge)
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {!collapsed && (
        <div
          className={cx(
            "m-3 shrink-0 overflow-hidden rounded-2xl border p-3 shadow-xl shadow-black/10",
            liveHealth.state === "online"
              ? "border-emerald-300/20 bg-emerald-400/[0.075]"
              : liveHealth.state === "offline"
                ? "border-red-300/20 bg-red-400/[0.075]"
                : "border-amber-300/20 bg-amber-400/[0.075]"
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                System Status
              </div>
              <div className="mt-1 truncate text-xs font-extrabold text-white">
                Live backend health
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={cx(
                  "rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                  liveHealth.state === "online"
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300"
                    : liveHealth.state === "offline"
                      ? "border-red-300/20 bg-red-400/10 text-red-300"
                      : "border-amber-300/20 bg-amber-400/10 text-amber-200"
                )}
              >
                {liveHealth.state === "online" ? "Live" : liveHealth.state === "offline" ? "Offline" : "Checking"}
              </span>

              <button
                type="button"
                onClick={refreshSidebarHealth}
                disabled={statusRefreshing}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-200 hover:bg-white/15 disabled:opacity-50"
                title="Refresh backend health"
                aria-label="Refresh backend health"
              >
                <RefreshCw
                  size={12}
                  className={statusRefreshing ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cx(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  liveHealth.state === "online"
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]"
                    : liveHealth.state === "offline"
                      ? "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]"
                      : "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]"
                )}
              />
              <span
                className={cx(
                  "min-w-0 truncate text-sm font-black",
                  liveHealth.state === "online"
                    ? "text-emerald-300"
                    : liveHealth.state === "offline"
                      ? "text-red-300"
                      : "text-amber-200"
                )}
              >
                {liveHealth.label}
              </span>
            </div>

            <div className="mt-1 truncate text-[11px] leading-4 text-slate-400">
              {liveHealth.service}
            </div>

            {liveHealth.lastChecked && (
              <div className="mt-1 text-[10px] font-bold text-slate-500">
                Last checked: {liveHealth.lastChecked}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleStatusCardExpanded}
              className="flex h-8 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 text-[11px] font-extrabold text-white transition hover:bg-white/15"
              title={statusCardExpanded ? "Hide system status details" : "Show system status details"}
              aria-expanded={statusCardExpanded}
              aria-label={statusCardExpanded ? "Hide system status details" : "Show system status details"}
            >
              {statusCardExpanded ? "Hide Details" : "Details"}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("system-health")}
              className={cx(
                "flex h-8 items-center justify-center rounded-xl px-3 text-[11px] font-extrabold text-white transition",
                activeView === "system-health"
                  ? "bg-blue-600 shadow-lg shadow-blue-950/30"
                  : "border border-white/10 bg-white/10 hover:bg-white/15"
              )}
              title="Open the System Health workspace"
              aria-label="Open System Health workspace"
            >
              {activeView === "system-health" ? "Open" : "Health"}
            </button>
          </div>

          {statusCardExpanded && (
            <div className="mt-3 space-y-1.5">
              <SidebarStatusRow label="Backend" value={liveHealth.backend} />
              <SidebarStatusRow label="API Version" value={liveHealth.apiVersion} />
              <SidebarStatusRow label="CORS" value={liveHealth.cors} />
              <SidebarStatusRow label="Plugin Registry" value={liveHealth.pluginRegistry} />
              <SidebarStatusRow label="Plugins" value={liveHealth.pluginCount} />
              <SidebarStatusRow label="Weighted Router" value={liveHealth.weightedRouter} />

              {liveHealth.error && (
                <div className="rounded-xl border border-red-300/20 bg-red-950/20 px-3 py-2 text-[11px] font-bold leading-4 text-red-200">
                  {liveHealth.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!collapsed && (
        <footer className="mx-3 mb-3 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-cyan-400/[0.06] px-3 py-3 shadow-inner shadow-white/[0.03]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-[11px] font-black text-cyan-100">
              {sidebarBrand.logo}
            </div>

            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/90">
                {sidebarBrand.workspace}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                {sidebarBrand.name} · {sidebarBrand.tagline}
              </div>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] font-bold text-slate-400">
            <a
              href="https://s3geo.com"
              target="_blank"
              rel="noreferrer"
              className="truncate underline-offset-2 transition hover:text-cyan-200 hover:underline"
              title="s3geo.com"
            >
              {sidebarBrand.domain}
            </a>

            <span className="shrink-0 text-slate-600">·</span>

            <a
              href="https://araz.me"
              target="_blank"
              rel="noreferrer"
              className="truncate underline-offset-2 transition hover:text-cyan-200 hover:underline"
              title="Araz Shahkarami — araz.me"
            >
              Araz Shahkarami
            </a>
          </div>
        </footer>
      )}

    </aside>
  );
}
