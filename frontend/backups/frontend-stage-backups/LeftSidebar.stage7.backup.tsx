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
  MapPinned,
  Package,
  Plug,
  Settings,
  SlidersHorizontal,
  UploadCloud
} from "lucide-react";

import { navItems, systemStatus, type NavItem } from "../../data/mockSpatialData";
import { cx } from "../../utils/cx";

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

type LeftSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function LeftSidebar({ collapsed, onToggle }: LeftSidebarProps) {
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
