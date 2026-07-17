export type GeoJsonObjectLike = GeoJSON.GeoJsonObject;

export type GeoJsonFeature = GeoJSON.Feature<
  GeoJSON.Geometry | null,
  GeoJSON.GeoJsonProperties
>;

export type GeoJsonFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry | null,
  GeoJSON.GeoJsonProperties
>;

const GEOJSON_TYPES = new Set([
  "FeatureCollection",
  "Feature",
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection"
]);

const GEOMETRY_TYPES = new Set([
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection"
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function looksLikeGeoJson(value: unknown): value is GeoJsonObjectLike {
  if (!isRecord(value)) return false;

  return GEOJSON_TYPES.has(String(value.type));
}

function looksLikeGeometry(value: unknown): value is GeoJSON.Geometry {
  if (!isRecord(value)) return false;

  return GEOMETRY_TYPES.has(String(value.type));
}

function normalizeFeature(value: unknown): GeoJsonFeature | null {
  if (!isRecord(value)) return null;

  if (value.type !== "Feature") return null;

  const geometry = value.geometry;

  if (geometry !== null && geometry !== undefined && !looksLikeGeometry(geometry)) {
    return null;
  }

  return {
    type: "Feature",
    properties: isRecord(value.properties) ? value.properties : {},
    geometry: geometry === undefined ? null : geometry as GeoJSON.Geometry | null
  };
}

export function normalizeGeoJson(
  value: unknown
): GeoJsonFeatureCollection | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    try {
      return normalizeGeoJson(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (!looksLikeGeoJson(value)) return null;

  if (value.type === "FeatureCollection") {
    const rawFeatures = Array.isArray((value as GeoJSON.FeatureCollection).features)
      ? (value as GeoJSON.FeatureCollection).features
      : [];

    const features = rawFeatures
      .map((feature) => normalizeFeature(feature))
      .filter((feature): feature is GeoJsonFeature => Boolean(feature));

    return {
      type: "FeatureCollection",
      features
    };
  }

  if (value.type === "Feature") {
    const feature = normalizeFeature(value);

    return {
      type: "FeatureCollection",
      features: feature ? [feature] : []
    };
  }

  if (looksLikeGeometry(value)) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: value
        }
      ]
    };
  }

  return null;
}

export function extractGeoJson(
  value: unknown,
  depth = 0
): GeoJsonFeatureCollection | null {
  if (!value || depth > 6) return null;

  const direct = normalizeGeoJson(value);

  if (direct) return direct;

  if (!isRecord(value)) return null;

  if (Array.isArray(value.features)) {
    const fromFeatures = normalizeGeoJson({
      type: "FeatureCollection",
      features: value.features
    });

    if (fromFeatures) return fromFeatures;
  }

  if (value.geometry) {
    const fromGeometry = normalizeGeoJson({
      type: "Feature",
      properties: isRecord(value.properties) ? value.properties : {},
      geometry: value.geometry
    });

    if (fromGeometry) return fromGeometry;
  }

  const candidateKeys = [
    "geojson",
    "geo_json",
    "geoJson",
    "feature_collection",
    "featureCollection",
    "data",
    "output",
    "outputs",
    "result",
    "map",
    "map_layer",
    "mapLayer",
    "payload"
  ];

  for (const key of candidateKeys) {
    const candidate = value[key];

    const extracted = extractGeoJson(candidate, depth + 1);

    if (extracted) return extracted;
  }

  return null;
}

export function countGeoJsonFeatures(value: unknown) {
  return extractGeoJson(value)?.features.length ?? 0;
}

export function hasGeoJson(value: unknown) {
  return Boolean(extractGeoJson(value));
}

export function hasGeoJsonFeatures(value: unknown) {
  return countGeoJsonFeatures(value) > 0;
}
