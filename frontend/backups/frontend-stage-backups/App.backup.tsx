import { useState } from "react";
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const navItems = [
  { label: "Dashboard", icon: Home },
  { label: "AI Query", icon: Bot, active: true },
  { label: "Projects", icon: FolderOpen },
  { label: "Uploads", icon: UploadCloud },
  { label: "Data Sources", icon: Database },
  { label: "Map Layers", icon: Layers },
  { label: "Outputs", icon: Package },
  { label: "Reports", icon: FileText },
  { label: "Plugins", icon: Plug },
  { label: "Weights", icon: SlidersHorizontal },
  { label: "Settings", icon: Settings },
  { label: "System Health", icon: Activity }
];

const planSteps = [
  "Resolve study area boundary",
  "Load parcels, metro stations, and shopping centers",
  "Calculate NDVI from satellite raster",
  "Generate low vegetation mask",
  "Calculate slope from DEM",
  "Filter parcels by constraints",
  "Compute distances to metro and shopping centers",
  "Score and rank candidate parcels",
  "Build map layers",
  "Generate PDF report"
];

const layers = [
  "Ranked Commercial Sites",
  "Metro Stations",
  "Shopping Centers",
  "Low Vegetation Mask",
  "Slope Constraint (< 8%)",
  "District 6 Boundary"
];

const rankingRows = [
  ["🥇", "PC-2041", "92", "420 m", "680 m", "0.18", "4.7%", "3,250 m²", "Excellent"],
  ["🥈", "PC-1188", "88", "610 m", "740 m", "0.21", "5.2%", "2,900 m²", "Very Good"],
  ["🥉", "PC-3307", "84", "790 m", "850 m", "0.24", "6.1%", "4,100 m²", "Good"]
];

const files = [
  ["manifest.json", "2.1 KB"],
  ["production_response.json", "18.7 KB"],
  ["map_layers.json", "6.3 KB"],
  ["output_contract.json", "3.2 KB"],
  ["ranked_sites.geojson", "48.9 KB"],
  ["suitability_report.pdf", "1.2 MB"],
  ["outputs_summary.json", "7.6 KB"],
  ["audit_record.json", "4.1 KB"]
];

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
            const Icon = item.icon;

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
            All Systems Operational
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Backend</span>
              <span className="text-green-300">Online</span>
            </div>
            <div className="flex justify-between">
              <span>API Version</span>
              <span>0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span>CORS</span>
              <span>Enabled</span>
            </div>
            <div className="flex justify-between">
              <span>Plugin Registry</span>
              <span className="text-green-300">Active</span>
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
  onMaximizeMap
}: {
  onToggleLeft: () => void;
  onMaximizeMap: () => void;
}) {
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
          placeholder="Ask a geospatial question..."
        />
        <span className="text-xs font-bold text-slate-400">⌘ K</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="status-pill text-emerald-700">
          <Database size={14} />
          Local Backend
        </span>

        <span className="status-pill text-blue-700">
          <Zap size={14} />
          API v1
        </span>

        <span className="status-pill text-emerald-700">
          <HeartPulse size={14} />
          Healthy
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
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <section className="shrink-0 border-b border-slate-200 bg-white px-5 py-2">
        <div className="flex h-10 items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Bot size={17} className="text-blue-700" />
            Natural Language Geospatial Query
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
            defaultValue="Find suitable land parcels in District 6 for a commercial complex. Prioritize parcels within 800m of metro stations, within 1km of shopping centers, with low vegetation, slope below 8%, and area above 2,000 square meters. Show results on the map, create a ranking table, and generate a PDF report."
          />

          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <div className="font-bold text-slate-600">Project:</div>
            <select className="h-8 w-[260px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none">
              <option>Tehran Commercial Analysis</option>
            </select>

            <div className="font-bold text-slate-600">Datasets:</div>
            <div className="flex flex-wrap gap-2">
              {[
                "PostGIS: parcels",
                "PostGIS: metro_stations",
                "PostGIS: shopping_centers",
                "Raster Upload: satellite_ndvi.tif",
                "Raster Upload: dem_slope.tif"
              ].map((item) => (
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

          <div className="mt-3 flex gap-2">
            <button className="secondary-button h-9 px-4 text-xs">
              <Eye size={15} />
              Preview Plan
            </button>
            <button className="primary-button h-9 px-5 text-xs">
              <Play size={15} />
              Run Analysis
            </button>
            <button className="secondary-button h-9 px-4 text-xs">
              <Save size={15} />
              Save Workflow
            </button>
          </div>
        </div>

        <div className="card rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">AI Planning Preview</div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
              Ready
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

function MapView() {
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

      {["Azadi Square", "Mehr Clinic", "Imam Hospital", "Gisha", "Enghelab Sq.", "District 6", "District 11"].map(
        (label, index) => (
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
        )
      )}

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
          <div>Suitability Score: <b>92</b></div>
          <div>Distance to Metro: 420 m</div>
          <div>Distance to Shopping Center: 680 m</div>
          <div>Mean NDVI: 0.18</div>
          <div>Mean Slope: 4.7%</div>
          <div>Area: 3,250 m²</div>
        </div>
      </div>

      <div className="absolute left-4 top-4 w-[210px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold text-slate-900">Legend</div>
          <ChevronUp size={14} className="text-slate-400" />
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
          <div>Ⓜ Metro Stations</div>
          <div>🛍 Shopping Centers</div>
          <div className="text-purple-700">□ District 6 Boundary</div>
          <div className="text-green-700">▧ Low Vegetation Mask</div>
          <div className="text-slate-600">▨ Slope &lt; 8%</div>
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
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
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
              <span className="font-bold text-slate-700">req-commercial-site-001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Confidence:</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">
                High
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Execution Time:</span>
              <span className="font-bold text-slate-700">3.8s</span>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-2 text-sm font-extrabold text-slate-900">1. Summary</h3>
          <p className="text-xs leading-5 text-slate-700">
            12 suitable parcels were identified. The top-ranked parcel satisfies all
            spatial constraints and has excellent accessibility.
          </p>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">2. Output Buckets</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Vectors", "2"],
              ["Rasters", "3"],
              ["Tables", "1"],
              ["Reports", "1"],
              ["Documents", "1"],
              ["Files", "8"],
              ["Artifacts", "4"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-bold text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 py-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">3. Map Layers</h3>
          <div className="space-y-2">
            {layers.map((layer) => (
              <label key={layer} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <span className="h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-50" />
                  {layer}
                </span>
                <input type="checkbox" defaultChecked className="accent-blue-600" />
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
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
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
                  <tr key={row[1]} className="border-t border-slate-200 text-slate-700">
                    {row.map((cell, index) => (
                      <td key={index} className="px-3 py-3">
                        {index === 2 ? (
                          <span className="rounded-lg bg-emerald-50 px-2 py-1 font-extrabold text-emerald-700">
                            {cell}
                          </span>
                        ) : index === 8 ? (
                          <span className="rounded-lg bg-blue-50 px-2 py-1 font-extrabold text-blue-700">
                            {cell}
                          </span>
                        ) : (
                          <span className={index === 1 ? "font-extrabold text-slate-900" : ""}>
                            {cell}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
              Showing 1 to 3 of 12 results
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3">
              <div className="text-xs font-extrabold text-slate-900">Files (8)</div>
            </div>

            <div className="h-[140px] overflow-y-auto p-2">
              {files.map(([file, size]) => (
                <div
                  key={file}
                  className="mb-1.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <span className="truncate font-semibold text-slate-700">{file}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{size}</span>
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

  function maximizeMap() {
    setLeftCollapsed(true);
    setTopCollapsed(true);
    setRightCollapsed(true);
    setBottomCollapsed(true);
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
        />

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <TopQueryPanel
              collapsed={topCollapsed}
              onToggle={() => setTopCollapsed((value) => !value)}
            />

            <div className="min-h-0 flex-1">
              <MapView />
            </div>

            <BottomDrawer
              collapsed={bottomCollapsed}
              onToggle={() => setBottomCollapsed((value) => !value)}
            />
          </main>

          <RightPanel
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}
