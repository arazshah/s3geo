import { useCallback, useEffect, useMemo, useState } from "react";

import { BottomDrawer } from "./components/layout/BottomDrawer";
import { Header } from "./components/layout/Header";
import { LeftSidebar } from "./components/layout/LeftSidebar";
import { MapView } from "./components/layout/MapView";
import { RightPanel } from "./components/layout/RightPanel";
import { TopQueryPanel } from "./components/layout/TopQueryPanel";
import {
  ToastContainer,
  type AppToast,
  type ToastType
} from "./components/ui/ToastContainer";

import { usePersistedState } from "./hooks/usePersistedState";
import { api } from "./lib/api";

import {
  analysisSummary as mockAnalysisSummary,
  datasets,
  defaultQuery,
  files as mockFiles,
  layers as mockLayers,
  rankingRows as mockRankingRows,
  selectedProject,
  type LayerItem,
  type OutputFile,
  type RankingRow
} from "./data/mockSpatialData";

import type {
  AnalysisStatus,
  AnalysisSummaryState
} from "./types/ui";

import {
  normalizeFiles,
  normalizeLayers,
  normalizeRankingRows
} from "./utils/normalizers";

function createToastId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function encodeFilePath(filename: string) {
  return filename
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export default function App() {
  const [leftCollapsed, setLeftCollapsed] = usePersistedState(
    "smart-spatial:left-collapsed",
    false
  );

  const [topCollapsed, setTopCollapsed] = usePersistedState(
    "smart-spatial:top-query-collapsed",
    false
  );

  const [rightCollapsed, setRightCollapsed] = usePersistedState(
    "smart-spatial:right-panel-collapsed",
    false
  );

  const [bottomCollapsed, setBottomCollapsed] = usePersistedState(
    "smart-spatial:bottom-drawer-collapsed",
    false
  );

  const [query, setQuery] = useState(defaultQuery);
  const [layerItems, setLayerItems] = useState<LayerItem[]>(mockLayers);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>(mockRankingRows);
  const [files, setFiles] = useState<OutputFile[]>(mockFiles);

  const [summary, setSummary] =
    useState<AnalysisSummaryState>(mockAnalysisSummary);

  const [apiHealthText, setApiHealthText] = useState("Checking");
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisStatus>("checking");

  const [message, setMessage] = useState("Checking backend connection...");
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const selectedDatasets = useMemo(() => datasets, []);

  const isMapLoading =
    analysisStatus === "running" || analysisStatus === "previewing";

  const addToast = useCallback(
    (type: ToastType, title: string, toastMessage?: string) => {
      const id = createToastId();

      setToasts((current) => [
        {
          id,
          type,
          title,
          message: toastMessage
        },
        ...current.slice(0, 3)
      ]);

      if (type !== "loading") {
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4200);
      }

      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const health = await api.health();

        if (!mounted) return;

        const healthMessage = String(
          health.status || health.service || health.version || "Backend online"
        );

        setApiHealthText("Online");
        setAnalysisStatus("idle");
        setMessage(healthMessage);

        addToast(
          "success",
          "Backend connected",
          `API is available at ${api.baseUrl}`
        );
      } catch {
        if (!mounted) return;

        setApiHealthText("Offline");
        setAnalysisStatus("idle");
        setMessage("Backend unavailable. Using mock data.");

        addToast(
          "warning",
          "Backend unavailable",
          "The interface is running with mock data until the API is available."
        );
      }
    }

    checkHealth();

    return () => {
      mounted = false;
    };
  }, [addToast]);

  function maximizeMap() {
    setLeftCollapsed(true);
    setTopCollapsed(true);
    setRightCollapsed(true);
    setBottomCollapsed(true);

    addToast(
      "info",
      "Map maximized",
      "All collapsible panels were minimized to prioritize the map workspace."
    );
  }

  function toggleLayer(layerId: string) {
    setLayerItems((current) =>
      current.map((layer) =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
  }

  function handleDownloadFile(file: OutputFile) {
    const directUrl = file.downloadUrl || file.url;

    if (directUrl) {
      window.open(api.downloadUrl(directUrl), "_blank", "noopener,noreferrer");

      addToast(
        "info",
        "Download started",
        file.name
      );

      return;
    }

    if (summary.requestId && summary.requestId.startsWith("req-")) {
      const encodedFilename = encodeFilePath(file.name);
      const path = `/api/v1/requests/${summary.requestId}/outputs/files/${encodedFilename}`;

      window.open(api.downloadUrl(path), "_blank", "noopener,noreferrer");

      addToast(
        "info",
        "Download requested",
        file.name
      );

      return;
    }

    addToast(
      "warning",
      "File endpoint unavailable",
      "Run a real analysis first so the backend can provide request-specific file URLs."
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

      addToast(
        "success",
        "Plan preview ready",
        "The AI execution plan was generated successfully."
      );
    } catch {
      setAnalysisStatus("error");
      setMessage("Preview endpoint unavailable. Showing mock AI plan.");

      addToast(
        "warning",
        "Preview fallback",
        "Preview API is unavailable. Mock planning steps are displayed."
      );
    }
  }

  async function handleRunAnalysis() {
    setAnalysisStatus("running");
    setMessage("Running spatial analysis...");

    addToast(
      "info",
      "Analysis started",
      "Spatial analysis is running. Map and output panels will update after completion."
    );

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
        requestId:
          response.request_id ||
          response.requestId ||
          response.id ||
          mockAnalysisSummary.requestId,
        confidence:
          typeof response.confidence === "number"
            ? `${Math.round(response.confidence * 100)}%`
            : String(response.confidence || mockAnalysisSummary.confidence),
        executionTime:
          typeof response.execution_time_ms === "number"
            ? `${(response.execution_time_ms / 1000).toFixed(1)}s`
            : typeof response.executionTimeMs === "number"
              ? `${(response.executionTimeMs / 1000).toFixed(1)}s`
              : mockAnalysisSummary.executionTime,
        text:
          response.summary ||
          response.message ||
          mockAnalysisSummary.text
      });

      setAnalysisStatus("success");
      setMessage("Analysis completed successfully.");
      setRightCollapsed(false);
      setBottomCollapsed(false);

      addToast(
        "success",
        "Analysis completed",
        "Ranking table, map layers, files and report outputs are ready."
      );
    } catch {
      setAnalysisStatus("error");
      setMessage("API run failed. Keeping mock analysis output.");
      setRightCollapsed(false);
      setBottomCollapsed(false);

      addToast(
        "error",
        "Analysis API failed",
        "The API request failed. The interface kept the mock analysis output visible."
      );
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
              <MapView
                layers={layerItems}
                isLoading={isMapLoading}
                loadingMessage={message}
              />
            </div>

            <BottomDrawer
              collapsed={bottomCollapsed}
              onToggle={() => setBottomCollapsed((value) => !value)}
              rankingRows={rankingRows}
              files={files}
              requestId={summary.requestId}
              onDownloadFile={handleDownloadFile}
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

      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
}
