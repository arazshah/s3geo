export type NavItem = {
  label: string;
  iconKey:
    | "home"
    | "bot"
    | "folder"
    | "upload"
    | "database"
    | "layers"
    | "package"
    | "fileText"
    | "plug"
    | "sliders"
    | "settings"
    | "activity";
  active?: boolean;
};

export type LayerItem = {
  id: string;
  name: string;
  type: "vector" | "raster" | "boundary" | "analysis";
  visible: boolean;
  color: string;
  geojson?: unknown;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

export type RankingRow = {
  rank: string;
  parcelId: string;
  suitabilityScore: number;
  distanceToMetro: string;
  distanceToShoppingCenter: string;
  meanNdvi: string;
  meanSlope: string;
  area: string;
  recommendation: string;
};

export type OutputFile = {
  name: string;
  size: string;
  type: "json" | "geojson" | "pdf" | "csv" | "zip";
  url?: string;
  downloadUrl?: string;
};

export type OutputBucket = {
  label: string;
  value: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", iconKey: "home" },
  { label: "AI Query", iconKey: "bot", active: true },
  { label: "Projects", iconKey: "folder" },
  { label: "Uploads", iconKey: "upload" },
  { label: "Data Sources", iconKey: "database" },
  { label: "Map Layers", iconKey: "layers" },
  { label: "Outputs", iconKey: "package" },
  { label: "Reports", iconKey: "fileText" },
  { label: "Plugins", iconKey: "plug" },
  { label: "Weights", iconKey: "sliders" },
  { label: "Settings", iconKey: "settings" },
  { label: "System Health", iconKey: "activity" }
];

export const defaultQuery =
  "Find suitable land parcels in District 6 for a commercial complex. Prioritize parcels within 800m of metro stations, within 1km of shopping centers, with low vegetation, slope below 8%, and area above 2,000 square meters. Show results on the map, create a ranking table, and generate a PDF report.";

export const selectedProject = "Tehran Commercial Analysis";

export const datasets = [
  "PostGIS: parcels",
  "PostGIS: metro_stations",
  "PostGIS: shopping_centers",
  "Raster Upload: satellite_ndvi.tif",
  "Raster Upload: dem_slope.tif"
];

export const planSteps = [
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

export const layers: LayerItem[] = [
  {
    id: "ranked-commercial-sites",
    name: "Ranked Commercial Sites",
    type: "analysis",
    visible: true,
    color: "#22c55e"
  },
  {
    id: "metro-stations",
    name: "Metro Stations",
    type: "vector",
    visible: true,
    color: "#2563eb"
  },
  {
    id: "shopping-centers",
    name: "Shopping Centers",
    type: "vector",
    visible: true,
    color: "#f97316"
  },
  {
    id: "low-vegetation-mask",
    name: "Low Vegetation Mask",
    type: "raster",
    visible: true,
    color: "#84cc16"
  },
  {
    id: "slope-constraint",
    name: "Slope Constraint (< 8%)",
    type: "raster",
    visible: true,
    color: "#64748b"
  },
  {
    id: "district-6-boundary",
    name: "District 6 Boundary",
    type: "boundary",
    visible: true,
    color: "#9333ea"
  }
];

export const rankingRows: RankingRow[] = [
  {
    rank: "🥇",
    parcelId: "PC-2041",
    suitabilityScore: 92,
    distanceToMetro: "420 m",
    distanceToShoppingCenter: "680 m",
    meanNdvi: "0.18",
    meanSlope: "4.7%",
    area: "3,250 m²",
    recommendation: "Excellent"
  },
  {
    rank: "🥈",
    parcelId: "PC-1188",
    suitabilityScore: 88,
    distanceToMetro: "610 m",
    distanceToShoppingCenter: "740 m",
    meanNdvi: "0.21",
    meanSlope: "5.2%",
    area: "2,900 m²",
    recommendation: "Very Good"
  },
  {
    rank: "🥉",
    parcelId: "PC-3307",
    suitabilityScore: 84,
    distanceToMetro: "790 m",
    distanceToShoppingCenter: "850 m",
    meanNdvi: "0.24",
    meanSlope: "6.1%",
    area: "4,100 m²",
    recommendation: "Good"
  }
];

export const outputBuckets: OutputBucket[] = [
  { label: "Vectors", value: "2" },
  { label: "Rasters", value: "3" },
  { label: "Tables", value: "1" },
  { label: "Reports", value: "1" },
  { label: "Documents", value: "1" },
  { label: "Files", value: "8" },
  { label: "Artifacts", value: "4" }
];

export const files: OutputFile[] = [
  { name: "manifest.json", size: "2.1 KB", type: "json" },
  { name: "production_response.json", size: "18.7 KB", type: "json" },
  { name: "map_layers.json", size: "6.3 KB", type: "json" },
  { name: "output_contract.json", size: "3.2 KB", type: "json" },
  { name: "ranked_sites.geojson", size: "48.9 KB", type: "geojson" },
  { name: "suitability_report.pdf", size: "1.2 MB", type: "pdf" },
  { name: "outputs_summary.json", size: "7.6 KB", type: "json" },
  { name: "audit_record.json", size: "4.1 KB", type: "json" }
];


export const analysisSummary = {
  requestId: "req-commercial-site-001",
  confidence: "High",
  executionTime: "3.8s",
  text:
    "12 suitable parcels were identified. The top-ranked parcel satisfies all spatial constraints and has excellent accessibility."
};
