import type { GeoQueryResponse } from "../lib/api";
import type { LayerItem, OutputFile, RankingRow } from "../data/mockSpatialData";
import { extractGeoJson } from "./geojson";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findArrayByKeys(
  payload: unknown,
  keys: string[],
  depth = 0
): unknown[] | null {
  if (depth > 6) return null;

  // Only a top-level array is itself the requested collection. During
  // recursive traversal an unrelated array (commonly outputs.files) must not
  // win before a later object containing the requested `rows`/`layers` key.
  if (Array.isArray(payload)) return depth === 0 ? payload : null;

  if (!isRecord(payload)) return null;

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) || isRecord(value)) {
      const found = findArrayByKeys(value, keys, depth + 1);

      if (found) return found;
    }
  }

  return null;
}

function getValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback: unknown = "—"
) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return fallback;
}


export function getFileType(fileName: string): OutputFile["type"] {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".geojson")) return "geojson";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".zip")) return "zip";

  return "json";
}

export function normalizeFiles(response: GeoQueryResponse): OutputFile[] | null {
  const array = Array.isArray(response.files)
    ? response.files
    : findArrayByKeys(response.files ?? response, [
        "files",
        "output_files",
        "outputFiles",
        "documents",
        "items"
      ]);

  if (!array?.length) return null;

  return array.map((item, index) => {
    if (typeof item === "string") {
      return {
        name: item,
        size: "—",
        type: getFileType(item)
      };
    }

    const record = isRecord(item) ? item : {};

    const name = String(
      getValue(
        record,
        ["name", "filename", "file_name", "path"],
        `file-${index + 1}`
      )
    );

    const urlValue = getValue(
      record,
      ["url", "href", "download_url", "downloadUrl", "path"],
      ""
    );

    const url =
      typeof urlValue === "string" && urlValue.trim()
        ? urlValue
        : undefined;

    return {
      name,
      size: String(getValue(record, ["size", "file_size", "bytes"], "—")),
      type: getFileType(name),
      url,
      downloadUrl: url
    };
  });
}

export function normalizeRankingRows(response: GeoQueryResponse): RankingRow[] | null {
  const explicitRows = Array.isArray(response.ranking_table) && response.ranking_table.length
    ? response.ranking_table
    : null;
  const responseRecord = isRecord(response) ? response : {};
  const outputsEnvelope = isRecord(responseRecord.outputs) ? responseRecord.outputs : {};
  const outputs = isRecord(outputsEnvelope.outputs)
    ? outputsEnvelope.outputs
    : outputsEnvelope;
  const tables = Array.isArray(outputs.tables) ? outputs.tables : [];
  let typedRows: unknown[] | null = null;

  for (const tableValue of tables) {
    if (!isRecord(tableValue)) continue;
    const data = isRecord(tableValue.data) ? tableValue.data : {};
    const nestedTable = isRecord(data.table) ? data.table : {};
    const candidates = [tableValue.rows, data.rows, nestedTable.rows];

    for (const candidate of candidates) {
      if (
        Array.isArray(candidate)
        && candidate.length
        && candidate.some(
          (row) => isRecord(row) && row.rank !== undefined && row.rank !== ""
        )
      ) {
        typedRows = candidate;
        break;
      }
    }

    if (typedRows) break;
  }

  if (!typedRows) {
    const queue: unknown[] = [response];
    const visited = new WeakSet<object>();

    while (queue.length) {
      const value = queue.shift();
      if (!isRecord(value) || visited.has(value)) continue;
      visited.add(value);

      const candidates = [
        value.rows,
        isRecord(value.data) ? value.data.rows : undefined,
        isRecord(value.data) && isRecord(value.data.table)
          ? value.data.table.rows
          : undefined
      ];

      for (const candidate of candidates) {
        if (
          Array.isArray(candidate)
          && candidate.some(
            (row) => isRecord(row) && row.rank !== undefined && row.rank !== ""
          )
        ) {
          typedRows = candidate.filter(
            (row) => isRecord(row) && row.rank !== undefined && row.rank !== ""
          );
          break;
        }
      }

      if (typedRows) break;

      for (const child of Object.values(value)) {
        if (isRecord(child)) queue.push(child);
        if (Array.isArray(child)) queue.push(...child.filter(isRecord));
      }
    }
  }

  const array = explicitRows || typedRows || findArrayByKeys(response, [
        "ranking_table",
        "rankingTable",
        "ranking",
        "rows",
        "table",
        "results",
        "candidates"
      ]);

  if (!array?.length) return null;

  const rows = array.filter(isRecord);

  if (!rows.length) return null;

  return rows.map((row, index) => {
    const scoreValue = getValue(
      row,
      [
        "suitabilityScore",
        "suitability_score",
        "score",
        "final_score",
        "rank_score",
        "priority_score",
        "investment_score",
        "annual_rate_mm",
        "value"
      ],
      0
    );

    const score = Number(scoreValue);

    return {
      rank: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1),
      parcelId: String(
        getValue(
          row,
          ["parcelId", "parcel_id", "id", "object_id", "feature_id", "gid"],
          `PC-${String(index + 1).padStart(4, "0")}`
        )
      ),
      suitabilityScore: Number.isFinite(score) ? score : 0,
      distanceToMetro: String(
        getValue(
          row,
          ["distanceToMetro", "distance_to_metro", "metro_distance", "dist_metro"],
          "—"
        )
      ),
      distanceToShoppingCenter: String(
        getValue(
          row,
          [
            "distanceToShoppingCenter",
            "distance_to_shopping_center",
            "shopping_distance",
            "dist_shopping"
          ],
          "—"
        )
      ),
      meanNdvi: String(
        getValue(row, ["meanNdvi", "mean_ndvi", "ndvi"], "—")
      ),
      meanSlope: String(
        getValue(row, ["meanSlope", "mean_slope", "slope"], "—")
      ),
      area: String(
        getValue(row, ["area", "_area", "area_m2", "parcel_area"], "—")
      ),
      recommendation: String(
        getValue(row, ["recommendation", "label", "class", "category"], "Candidate")
      )
    };
  });
}

export function normalizeLayers(response: GeoQueryResponse): LayerItem[] | null {
  const array = Array.isArray(response.layers)
    ? response.layers
    : findArrayByKeys(response.layers ?? response.map_layers ?? response, [
        "layers",
        "map_layers",
        "mapLayers",
        "items"
      ]);

  if (!array?.length) {
    const responseGeoJson = extractGeoJson(response);

    if (!responseGeoJson) return null;

    return [
      {
        id: "backend-geojson-result",
        name: "Backend GeoJSON Result",
        type: "analysis",
        visible: true,
        color: "#22c55e",
        geojson: responseGeoJson,
        metadata: {
          __source: "backend",
          responseType: "direct-geojson"
        }
      }
    ];
  }

  return array.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const properties = isRecord(record.properties) ? record.properties : {};

    const merged = {
      ...properties,
      ...record
    };

    const typeValue = String(
      getValue(merged, ["type", "layer_type", "geometry_type"], "vector")
    ).toLowerCase();

    const layerType: LayerItem["type"] =
      typeValue === "raster"
        ? "raster"
        : typeValue === "boundary"
          ? "boundary"
          : typeValue === "analysis"
            ? "analysis"
            : "vector";

    const sourceUrlValue = getValue(
      merged,
      ["url", "source_url", "sourceUrl", "href", "path"],
      ""
    );

    return {
      id: String(
        getValue(
          merged,
          ["id", "layer_id", "name"],
          `layer-${index + 1}`
        )
      ),
      name: String(
        getValue(
          merged,
          ["name", "title", "layer_name", "label"],
          `Layer ${index + 1}`
        )
      ),
      type: layerType,
      visible:
        typeof merged.visible === "boolean"
          ? merged.visible
          : true,
      color:
        typeof merged.color === "string"
          ? merged.color
          : index % 2 === 0
            ? "#22c55e"
            : "#2563eb",
      geojson: extractGeoJson(merged),
      sourceUrl:
        typeof sourceUrlValue === "string" && sourceUrlValue.trim()
          ? sourceUrlValue
          : undefined,
      metadata: {
        __source: "backend",
        ...merged
      }
    };
  });
}
