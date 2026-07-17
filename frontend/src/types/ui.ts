export type AnalysisStatus =
  | "idle"
  | "checking"
  | "previewing"
  | "running"
  | "success"
  | "error";

export type AnalysisSummaryState = {
  requestId: string;
  confidence: string;
  executionTime: string;
  text: string;
};

export type NavView =
  | "dashboard"
  | "ai-query"
  | "projects"
  | "uploads"
  | "data-sources"
  | "map-layers"
  | "outputs"
  | "reports"
  | "plugins"
  | "weights"
  | "settings"
  | "system-health";

export type SelectedMapFeature = {
  id: string;
  layerId: string;
  layerName: string;
  geometryType?: string;
  properties: Record<string, unknown>;
};
