export type AiInputRole =
  | "source"
  | "target"
  | "candidate"
  | "reference"
  | "constraint"
  | "boundary"
  | "raster"
  | "mask"
  | "weight"
  | "context";

export type AiRoleDataset = {
  id: string;
  title?: string;
  addedFrom?: string;
  metadata?: unknown;
};

export type AiInputRoleBindingResult = {
  operation: string | null;
  inputs: Record<string, string>;
  inputRoles: Record<string, string>;
  dataSources: Array<{
    source_id: string;
    data_source_id: string;
    title: string;
    role: AiInputRole;
    input_role: AiInputRole;
    added_from: string;
  }>;
  metadata: {
    frontend_operation: string | null;
    frontend_input_roles: Record<string, { id: string; title: string }>;
    frontend_role_binding_strategy: string;
    frontend_role_binding_warnings: string[];
  };
  warnings: string[];
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_\-./]+/g, " ");
}

function scoreByKeywords(text: string, keywords: string[]) {
  const normalized = normalizeText(text);

  return keywords.reduce((score, keyword) => {
    return normalized.includes(keyword) ? score + 1 : score;
  }, 0);
}

function isProximityQuery(query: string, inferredIntent?: string, detectedCriteria: string[] = []) {
  const normalizedQuery = normalizeText(query);
  const normalizedIntent = normalizeText(inferredIntent || "");
  const normalizedCriteria = detectedCriteria.map(normalizeText).join(" ");

  const proximityTerms = [
    "nearest",
    "closest",
    "nearby",
    "near ",
    "proximity",
    "distance to",
    "distance from",
    "within distance",
    "rank by distance",
    "measure distance",
    "nearest neighbor",
    "نزدیک",
    "نزدیکی",
    "نزدیکترین",
    "نزدیک‌ترین",
    "فاصله",
    "مجاورت"
  ];

  return proximityTerms.some((term) => normalizedQuery.includes(term.trim())) ||
    normalizedIntent.includes("proximity") ||
    normalizedIntent.includes("nearest") ||
    normalizedIntent.includes("distance") ||
    normalizedCriteria.includes("proximity") ||
    normalizedCriteria.includes("nearest") ||
    normalizedCriteria.includes("distance");
}

function inferSourceTarget(datasets: AiRoleDataset[]): {
  source?: AiRoleDataset;
  target?: AiRoleDataset;
} {
  const sourceKeywords = [
    "candidate",
    "candidates",
    "area",
    "areas",
    "parcel",
    "parcels",
    "property",
    "properties",
    "site",
    "sites",
    "lot",
    "lots",
    "polygon",
    "polygons",
    "building",
    "buildings",
    "source",
    "rank",
    "suitability",
    "محدوده",
    "قطعه",
    "پلاک",
    "کاندید",
    "گزینه"
  ];

  const targetKeywords = [
    "target",
    "reference",
    "metro",
    "station",
    "stations",
    "bus",
    "stop",
    "stops",
    "school",
    "hospital",
    "mall",
    "shopping",
    "road",
    "roads",
    "poi",
    "amenity",
    "amenities",
    "rail",
    "ایستگاه",
    "مترو",
    "مدرسه",
    "بیمارستان",
    "مرکز خرید",
    "راه",
    "جاده"
  ];

  const scored = datasets.map((dataset, index) => {
    const label = `${dataset.title || ""} ${dataset.id}`;

    return {
      dataset,
      index,
      sourceScore: scoreByKeywords(label, sourceKeywords),
      targetScore: scoreByKeywords(label, targetKeywords)
    };
  });

  let source: AiRoleDataset | undefined = [...scored].sort((a, b) => {
    const scoreDelta =
      (b.sourceScore - b.targetScore) - (a.sourceScore - a.targetScore);

    if (scoreDelta !== 0) return scoreDelta;

    return a.index - b.index;
  })[0]?.dataset;

  let target: AiRoleDataset | undefined = [...scored]
    .filter((item) => item.dataset.id !== source?.id)
    .sort((a, b) => {
      const scoreDelta =
        (b.targetScore - b.sourceScore) - (a.targetScore - a.sourceScore);

      if (scoreDelta !== 0) return scoreDelta;

      return a.index - b.index;
    })[0]?.dataset;

  if (!source) {
    source = datasets[0];
  }

  if (!target) {
    target = datasets.find((item) => item.id !== source?.id);
  }

  return { source, target };
}

export function buildAiInputRoleBindings({
  query,
  inferredIntent,
  detectedCriteria = [],
  datasets
}: {
  query: string;
  inferredIntent?: string;
  detectedCriteria?: string[];
  datasets: AiRoleDataset[];
}): AiInputRoleBindingResult {
  const uniqueDatasets = Array.from(
    new Map(
      datasets
        .filter((item) => item.id)
        .map((item) => [
          item.id,
          {
            ...item,
            title: item.title || item.id,
            addedFrom: item.addedFrom || "ai_query_dataset_selector"
          }
        ])
    ).values()
  );

  const warnings: string[] = [];
  const proximity = isProximityQuery(query, inferredIntent, detectedCriteria);
  const operation = proximity ? "spatial_nearest" : null;

  const roleById = new Map<string, AiInputRole>();
  const inputs: Record<string, string> = {};
  const inputRoles: Record<string, string> = {};
  const frontendInputRoles: Record<string, { id: string; title: string }> = {};

  if (proximity && uniqueDatasets.length >= 2) {
    const { source, target } = inferSourceTarget(uniqueDatasets);

    if (source?.id && target?.id) {
      roleById.set(source.id, "source");
      roleById.set(target.id, "target");

      inputs.source = source.id;
      inputs.target = target.id;

      inputRoles.source = source.id;
      inputRoles.target = target.id;

      frontendInputRoles.source = {
        id: source.id,
        title: source.title || source.id
      };

      frontendInputRoles.target = {
        id: target.id,
        title: target.title || target.id
      };
    } else {
      warnings.push("Proximity query detected, but source/target roles could not be inferred.");
    }
  } else if (proximity && uniqueDatasets.length < 2) {
    warnings.push("Proximity query detected, but at least two selected datasets are required for source/target role binding.");
  }

  const dataSources = uniqueDatasets.map((dataset) => {
    const role = roleById.get(dataset.id) || "context";

    return {
      source_id: dataset.id,
      data_source_id: dataset.id,
      title: dataset.title || dataset.id,
      role,
      input_role: role,
      added_from: dataset.addedFrom || "ai_query_dataset_selector"
    };
  });

  return {
    operation,
    inputs,
    inputRoles,
    dataSources,
    metadata: {
      frontend_operation: operation,
      frontend_input_roles: frontendInputRoles,
      frontend_role_binding_strategy: proximity
        ? "heuristic_proximity_source_target"
        : "default_context_roles",
      frontend_role_binding_warnings: warnings
    },
    warnings
  };
}
