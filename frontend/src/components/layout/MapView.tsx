import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  Download,
  Eye,
  Layers,
  Loader2,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  ShieldCheck,
  X
} from "lucide-react";

import type { LayerItem } from "../../data/mockSpatialData";
import { api } from "../../lib/api";
import type { SelectedMapFeature } from "../../types/ui";
import { cx } from "../../utils/cx";
import { extractGeoJson as extractGeoJsonForMap } from "../../utils/geojson";

type MapViewProps = {
  layers: LayerItem[];
  onToggleLayer?: (layerId: string) => void;
  onShowAllLayers?: () => void;
  onHideAllLayers?: () => void;
  controlsSuppressed?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  selectedFeatureId?: string | null;
  selectedFeature?: SelectedMapFeature | null;
  zoomToLayerRequest?: string | null;
  onFeatureSelect?: (feature: SelectedMapFeature) => void;
  onClearSelection?: () => void;
};

type GeoJsonObjectLike = GeoJSON.GeoJsonObject;

type GeoJsonFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  GeoJSON.GeoJsonProperties
>;

const TEHRAN_CENTER: L.LatLngExpression = [35.6992, 51.3886];

const FEATURE_ID_KEYS = [
  "parcelId",
  "parcel_id",
  "id",
  "object_id",
  "feature_id",
  "gid",
  "rank",
  "name"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


function asProperties(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isMockLayer(layer: LayerItem) {
  const metadata = asProperties(layer.metadata);

  return metadata.__source !== "backend" && !layer.sourceUrl && !layer.geojson;
}

type LayerRenderStatus = {
  label: string;
  description: string;
  tone: "emerald" | "amber" | "red" | "slate" | "blue";
  renderable: boolean;
};

function isPathLayer(layer: L.Layer): layer is L.Path {
  return typeof (layer as L.Path).setStyle === "function";
}

function layerStatusClass(tone: LayerRenderStatus["tone"]) {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  if (tone === "red") return "bg-red-50 text-red-700";
  if (tone === "blue") return "bg-blue-50 text-blue-700";

  return "bg-slate-100 text-slate-500";
}

function getLayerRenderStatus(
  layer: LayerItem,
  fetchedGeoJson?: unknown,
  sourceFailed?: string
): LayerRenderStatus {
  if (!layer.visible) {
    return {
      label: "Hidden",
      description: "Layer is disabled.",
      tone: "slate",
      renderable: false
    };
  }

  if (extractGeoJsonForMap(layer.geojson)) {
    return {
      label: "Rendered",
      description: "Inline GeoJSON is available.",
      tone: "emerald",
      renderable: true
    };
  }

  if (extractGeoJsonForMap(fetchedGeoJson)) {
    return {
      label: "Rendered",
      description: "Remote GeoJSON was loaded successfully.",
      tone: "emerald",
      renderable: true
    };
  }

  if (isMockLayer(layer)) {
    return {
      label: "Preview",
      description: "Mock preview geometry is being displayed.",
      tone: "blue",
      renderable: true
    };
  }

  if (sourceFailed) {
    return {
      label: "Source failed",
      description: sourceFailed,
      tone: "red",
      renderable: false
    };
  }

  if (layer.sourceUrl) {
    return {
      label: "Remote",
      description: "Waiting for remote GeoJSON source.",
      tone: "amber",
      renderable: false
    };
  }

  return {
    label: "No geometry",
    description: "Layer metadata exists but no renderable GeoJSON was provided.",
    tone: "amber",
    renderable: false
  };
}

function getFeatureIdentity(properties: Record<string, unknown>, fallback: string) {
  for (const key of FEATURE_ID_KEYS) {
    const value = properties[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return fallback;
}

function getLayerStyle(
  layer: LayerItem,
  selected: boolean
): L.PathOptions {
  const base: L.PathOptions = {
    color: selected ? "#ef4444" : layer.color,
    weight: selected ? 5 : layer.type === "boundary" ? 3 : 2,
    opacity: selected ? 1 : 0.9,
    fillColor: selected ? "#ef4444" : layer.color,
    fillOpacity:
      selected
        ? 0.48
        : layer.type === "analysis"
          ? 0.38
          : layer.type === "boundary"
            ? 0.08
            : 0.22
  };

  if (layer.type === "raster") {
    return {
      ...base,
      opacity: selected ? 0.95 : 0.45,
      fillOpacity: selected ? 0.35 : 0.18,
      dashArray: selected ? undefined : "6 4"
    };
  }

  return base;
}

function popupHtml(layer: LayerItem, properties: Record<string, unknown>) {
  const rows = Object.entries(properties)
    .slice(0, 10)
    .map(
      ([key, value]) => `
        <div style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e2e8f0;padding:4px 0;">
          <span style="color:#64748b;font-weight:700;">${key}</span>
          <span style="color:#0f172a;font-weight:800;text-align:right;">${String(value)}</span>
        </div>
      `
    )
    .join("");

  return `
    <div style="min-width:230px;font-family:Inter,system-ui,sans-serif;">
      <div style="font-weight:900;color:#0f172a;margin-bottom:6px;">${layer.name}</div>
      ${
        rows ||
        `<div style="font-size:12px;color:#64748b;">No feature attributes available.</div>`
      }
    </div>
  `;
}

function createFallbackGeoJson(layer: LayerItem): GeoJsonFeatureCollection {
  if (layer.id.includes("metro") || layer.name.toLowerCase().includes("metro")) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Metro Station A", type: "metro" },
          geometry: { type: "Point", coordinates: [51.3905, 35.704] }
        },
        {
          type: "Feature",
          properties: { name: "Metro Station B", type: "metro" },
          geometry: { type: "Point", coordinates: [51.376, 35.697] }
        },
        {
          type: "Feature",
          properties: { name: "Metro Station C", type: "metro" },
          geometry: { type: "Point", coordinates: [51.405, 35.692] }
        }
      ]
    };
  }

  if (
    layer.id.includes("shopping") ||
    layer.name.toLowerCase().includes("shopping")
  ) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Shopping Center 1", type: "retail" },
          geometry: { type: "Point", coordinates: [51.398, 35.708] }
        },
        {
          type: "Feature",
          properties: { name: "Shopping Center 2", type: "retail" },
          geometry: { type: "Point", coordinates: [51.382, 35.689] }
        }
      ]
    };
  }

  if (
    layer.type === "boundary" ||
    layer.id.includes("district") ||
    layer.name.toLowerCase().includes("boundary")
  ) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "District Boundary", layer: layer.name },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [51.355, 35.682],
                [51.421, 35.684],
                [51.426, 35.721],
                [51.359, 35.724],
                [51.355, 35.682]
              ]
            ]
          }
        }
      ]
    };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          rank: 1,
          parcelId: "PC-2041",
          suitabilityScore: 92,
          recommendation: "Excellent"
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [51.386, 35.701],
              [51.392, 35.701],
              [51.392, 35.706],
              [51.386, 35.706],
              [51.386, 35.701]
            ]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          rank: 2,
          parcelId: "PC-1188",
          suitabilityScore: 88,
          recommendation: "Very Good"
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [51.374, 35.692],
              [51.381, 35.692],
              [51.381, 35.697],
              [51.374, 35.697],
              [51.374, 35.692]
            ]
          ]
        }
      },
      {
        type: "Feature",
        properties: {
          rank: 3,
          parcelId: "PC-3307",
          suitabilityScore: 84,
          recommendation: "Good"
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [51.402, 35.694],
              [51.409, 35.694],
              [51.409, 35.699],
              [51.402, 35.699],
              [51.402, 35.694]
            ]
          ]
        }
      }
    ]
  };
}

function getRenderableGeoJson(
  layer: LayerItem,
  fetchedGeoJson?: unknown
): GeoJsonObjectLike | null {
  const inlineGeoJson = extractGeoJsonForMap(layer.geojson);

  if (inlineGeoJson) {
    return inlineGeoJson;
  }

  const fetched = extractGeoJsonForMap(fetchedGeoJson);

  if (fetched) {
    return fetched;
  }

  if (isMockLayer(layer)) {
    return createFallbackGeoJson(layer) as GeoJsonObjectLike;
  }

  return null;
}

function readGeometryType(feature: GeoJSON.Feature) {
  return feature.geometry?.type || "Unknown";
}

function FeatureDetailsPanel({
  feature,
  onClose
}: {
  feature: SelectedMapFeature;
  onClose: () => void;
}) {
  const entries = Object.entries(feature.properties).slice(0, 14);

  return (
    <div className="absolute bottom-16 right-4 z-[520] w-[330px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex h-11 items-center justify-between border-b border-slate-200 px-4">
        <div className="min-w-0">
          <div className="truncate text-xs font-extrabold text-slate-900">
            Selected Feature
          </div>
          <div className="truncate text-[11px] text-slate-500">
            {feature.layerName}
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <X size={15} />
        </button>
      </div>

      <div className="max-h-[290px] overflow-y-auto p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-700">
            ID: {feature.id}
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-600">
            {feature.geometryType || "Feature"}
          </div>
        </div>

        {entries.length ? (
          <div className="space-y-1.5">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 text-xs"
              >
                <span className="shrink-0 font-bold text-slate-500">{key}</span>
                <span className="min-w-0 break-words text-right font-extrabold text-slate-800">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
            No attributes available for this feature.
          </div>
        )}
      </div>
    </div>
  );
}

export function MapView({
  layers,
  onToggleLayer,
  onShowAllLayers,
  onHideAllLayers,
  controlsSuppressed = false,
  isLoading = false,
  loadingMessage = "Processing spatial analysis...",
  selectedFeatureId,
  selectedFeature,
  zoomToLayerRequest,
  onFeatureSelect,
  onClearSelection
}: MapViewProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.FeatureGroup | null>(null);
  const lastAutoFitSignatureRef = useRef("");
  const [coordinates, setCoordinates] = useState("35.6992° N, 51.3886° E");
  const [fetchedGeoJsonByLayer, setFetchedGeoJsonByLayer] = useState<
    Record<string, unknown>
  >({});
  const [failedSourceByLayer, setFailedSourceByLayer] = useState<
    Record<string, string>
  >({});

  const visibleLayers = useMemo(
    () => layers.filter((layer) => layer.visible),
    [layers]
  );

  const visibleLayerCount = visibleLayers.length;
  const realGeoJsonCount = visibleLayers.filter((layer) =>
    Boolean(
      extractGeoJsonForMap(layer.geojson) ||
        extractGeoJsonForMap(fetchedGeoJsonByLayer[layer.id])
    )
  ).length;

  const layerDiagnostics = useMemo(
    () =>
      new Map(
        layers.map((layer) => [
          layer.id,
          getLayerRenderStatus(
            layer,
            fetchedGeoJsonByLayer[layer.id],
            failedSourceByLayer[layer.id]
          )
        ])
      ),
    [layers, fetchedGeoJsonByLayer, failedSourceByLayer]
  );

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, {
      center: TEHRAN_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    L.control
      .attribution({
        position: "bottomleft",
        prefix: false
      })
      .addAttribution("© OpenStreetMap")
      .addTo(map);

    L.control
      .scale({
        metric: true,
        imperial: false,
        position: "bottomleft"
      })
      .addTo(map);

    const group = L.featureGroup().addTo(map);
    layerGroupRef.current = group;

    map.on("mousemove", (event: L.LeafletMouseEvent) => {
      setCoordinates(
        `${event.latlng.lat.toFixed(5)}° N, ${event.latlng.lng.toFixed(5)}° E`
      );
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchLayerSources() {
      const candidates = visibleLayers.filter(
        (layer) =>
          layer.sourceUrl &&
          !extractGeoJsonForMap(layer.geojson) &&
          !fetchedGeoJsonByLayer[layer.id] &&
          !failedSourceByLayer[layer.id]
      );

      await Promise.all(
        candidates.map(async (layer) => {
          try {
            const response = await fetch(api.downloadUrl(layer.sourceUrl || ""));
            const data = await response.json();

            const normalizedGeoJson = extractGeoJsonForMap(data);

            if (!cancelled && normalizedGeoJson) {
              setFetchedGeoJsonByLayer((current) => ({
                ...current,
                [layer.id]: normalizedGeoJson
              }));

              setFailedSourceByLayer((current) => {
                const next = { ...current };
                delete next[layer.id];
                return next;
              });
            }
          } catch {
            if (!cancelled) {
              setFailedSourceByLayer((current) => ({
                ...current,
                [layer.id]: "Remote GeoJSON source could not be loaded."
              }));
            }
          }
        })
      );
    }

    fetchLayerSources();

    return () => {
      cancelled = true;
    };
  }, [visibleLayers, fetchedGeoJsonByLayer, failedSourceByLayer]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;

    if (!map || !group) return;

    group.clearLayers();

    visibleLayers.forEach((layer) => {
      const geojson = getRenderableGeoJson(
        layer,
        fetchedGeoJsonByLayer[layer.id]
      );

      if (!geojson) return;

      try {
        const leafletLayer = L.geoJSON(geojson, {
        style: (feature) => {
          const properties = asProperties(feature?.properties);
          const featureId = getFeatureIdentity(properties, `${layer.id}-feature`);

          return getLayerStyle(layer, selectedFeatureId === featureId);
        },
        pointToLayer: (feature, latlng) => {
          const properties = asProperties(feature.properties);
          const featureId = getFeatureIdentity(properties, `${layer.id}-point`);
          const selected = selectedFeatureId === featureId;

          return L.circleMarker(latlng, {
            radius: selected ? 10 : layer.type === "analysis" ? 8 : 6,
            color: selected ? "#ef4444" : "#ffffff",
            weight: selected ? 4 : 2,
            fillColor: selected ? "#ef4444" : layer.color,
            fillOpacity: 0.95
          });
        },
        onEachFeature: (feature, featureLayer) => {
          const properties = asProperties(feature.properties);
          const featureId = getFeatureIdentity(
            properties,
            `${layer.id}-${Math.random().toString(16).slice(2)}`
          );

          featureLayer.bindPopup(popupHtml(layer, properties), {
            maxWidth: 340,
            className: "smart-map-popup"
          });

          featureLayer.on({
            mouseover: () => {
              if (isPathLayer(featureLayer)) {
                featureLayer.setStyle({
                  ...getLayerStyle(layer, true),
                  weight: selectedFeatureId === featureId ? 5 : 4,
                  fillOpacity: selectedFeatureId === featureId ? 0.5 : 0.34
                });

                featureLayer.bringToFront();
              }
            },
            mouseout: () => {
              if (isPathLayer(featureLayer)) {
                featureLayer.setStyle(
                  getLayerStyle(layer, selectedFeatureId === featureId)
                );
              }
            },
            click: () => {
              onFeatureSelect?.({
                id: featureId,
                layerId: layer.id,
                layerName: layer.name,
                geometryType: readGeometryType(feature),
                properties
              });
            }
          });
        }
      });

        leafletLayer.addTo(group);
      } catch {
        // Skip invalid GeoJSON layer safely so one bad backend layer cannot break the map.
      }
    });

    const autoFitSignature = visibleLayers
      .map((layer) => {
        const renderable = Boolean(
          getRenderableGeoJson(layer, fetchedGeoJsonByLayer[layer.id])
        );

        return `${layer.id}:${layer.visible}:${renderable}`;
      })
      .join("|");

    if (
      autoFitSignature &&
      autoFitSignature !== lastAutoFitSignatureRef.current &&
      group.getLayers().length > 0
    ) {
      const bounds = group.getBounds();

      if (bounds.isValid()) {
        lastAutoFitSignatureRef.current = autoFitSignature;

        map.fitBounds(bounds.pad(0.18), {
          animate: true,
          duration: 0.4,
          maxZoom: 15
        });
      }
    }
  }, [
    visibleLayers,
    fetchedGeoJsonByLayer,
    selectedFeatureId,
    onFeatureSelect
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !zoomToLayerRequest) return;

    const [targetLayerId] = zoomToLayerRequest.split("::");
    const targetLayer = layers.find((layer) => layer.id === targetLayerId);

    if (!targetLayer) return;

    const geojson = getRenderableGeoJson(
      targetLayer,
      fetchedGeoJsonByLayer[targetLayer.id]
    );

    if (!geojson) return;

    try {
      const targetLeafletLayer = L.geoJSON(geojson);
      const bounds = targetLeafletLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18), {
          animate: true,
          duration: 0.45,
          maxZoom: 16
        });
      }
    } catch {
      // Ignore invalid target layer bounds safely.
    }
  }, [zoomToLayerRequest, layers, fetchedGeoJsonByLayer]);

  function zoomIn() {
    mapRef.current?.zoomIn();
  }

  function zoomOut() {
    mapRef.current?.zoomOut();
  }

  function fitToLayers() {
    const map = mapRef.current;
    const group = layerGroupRef.current;

    if (!map || !group) return;

    const bounds = group.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), {
        animate: true,
        duration: 0.45,
        maxZoom: 15
      });
    } else {
      map.setView(TEHRAN_CENTER, 13);
    }
  }

  function resetView() {
    mapRef.current?.setView(TEHRAN_CENTER, 13, {
      animate: true
    });
  }

  return (
    <div className="relative isolate z-0 h-full min-h-0 overflow-hidden bg-slate-100">
      <div ref={mapElementRef} className="absolute inset-0 z-0" />

      <div className={cx(
          "absolute left-4 top-4 z-[30] w-[260px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur transition-opacity duration-200",
          controlsSuppressed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold text-slate-900">Map Layers</div>

          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            {visibleLayerCount} visible
          </span>
        </div>

        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-500">GeoJSON Sources</span>
          <span
            className={cx(
              "rounded-full px-2 py-0.5 font-extrabold",
              realGeoJsonCount > 0
                ? "bg-emerald-50 text-emerald-700"
                : layers.length === 0
                  ? "bg-slate-100 text-slate-500"
                  : "bg-amber-50 text-amber-700"
            )}
          >
            {layers.length === 0 ? "none" : realGeoJsonCount > 0 ? `${realGeoJsonCount} real` : "no geojson"}
          </span>
        </div>

        {/* MapView Show all / Hide all */}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            onClick={onShowAllLayers}
            disabled={!layers.length || visibleLayerCount === layers.length}
            className="h-7 rounded-lg border border-slate-200 bg-white text-[10px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Show all
          </button>

          <button
            onClick={onHideAllLayers}
            disabled={!layers.length || visibleLayerCount === 0}
            className="h-7 rounded-lg border border-slate-200 bg-white text-[10px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hide all
          </button>
        </div>

        <div className="space-y-1.5 text-xs text-slate-700">
          {layers.length ? (
            layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => onToggleLayer?.(layer.id)}
                className={cx(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50",
                  !layer.visible && "opacity-45"
                )}
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{layer.name}</span>
                    <span
                      className={cx(
                        "mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                        layerStatusClass(
                          layerDiagnostics.get(layer.id)?.tone || "slate"
                        )
                      )}
                    >
                      {layerDiagnostics.get(layer.id)?.label || "Unknown"}
                    </span>
                  </span>
                </span>

                <span
                  className={cx(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                    layer.visible
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  {layer.visible ? "on" : "off"}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center">
              <div className="text-[11px] font-extrabold text-slate-700">
                No active layers
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">
                Run analysis or inspect request details to see why no map layers were returned.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={cx(
          "absolute right-4 top-4 z-[30] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-opacity duration-200",
          controlsSuppressed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
        {([
          [<LocateFixed size={17} />, "Reset View", resetView],
          [<Layers size={17} />, "Fit Layers", fitToLayers],
          [<Eye size={17} />, "Visibility controlled from right panel", undefined],
          [<ShieldCheck size={17} />, "Validate Layer Bounds", fitToLayers],
          [<Download size={17} />, "Export Map", undefined]
        ] as Array<[ReactNode, string, (() => void)?]>).map(
          ([icon, label, action], index) => (
            <button
              key={label}
              onClick={action}
              className={cx(
                "flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                index !== 4 && "border-b border-slate-100"
              )}
              title={label}
            >
              {icon}
            </button>
          )
        )}
      </div>

      <div className={cx(
          "absolute right-4 top-[245px] z-[30] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-opacity duration-200",
          controlsSuppressed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
        <button
          onClick={zoomIn}
          className="flex h-10 w-10 items-center justify-center border-b border-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
          title="Zoom in"
        >
          <Plus size={18} />
        </button>

        <button
          onClick={zoomOut}
          className="flex h-10 w-10 items-center justify-center text-slate-700 hover:bg-blue-50 hover:text-blue-700"
          title="Zoom out"
        >
          <Minus size={18} />
        </button>
      </div>

      <button
        onClick={fitToLayers}
        className={cx(
          "absolute bottom-4 left-4 z-[30] flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 shadow transition-opacity duration-200 hover:bg-slate-50",
          controlsSuppressed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <Maximize2 size={15} />
        Fit to layers
      </button>

      <div className={cx(
          "absolute bottom-4 right-4 z-[30] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow transition-opacity duration-200",
          controlsSuppressed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
        {coordinates}
      </div>

      {selectedFeature && (
        <FeatureDetailsPanel
          feature={selectedFeature}
          onClose={() => onClearSelection?.()}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 z-[700] flex items-center justify-center bg-slate-900/18 backdrop-blur-[1px]">
          <div className="w-[360px] rounded-2xl border border-white/70 bg-white/95 p-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Loader2 size={25} className="animate-spin" />
            </div>

            <div className="text-sm font-extrabold text-slate-900">
              Spatial Analysis Running
            </div>

            <div className="mt-2 text-xs leading-5 text-slate-600">
              {loadingMessage}
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
            </div>

            <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Processing layers, ranking parcels and preparing outputs
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
