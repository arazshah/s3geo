export type FrontendLlmProvider =
  | "backend-default"
  | "openai-compatible"
  | "ollama"
  | "custom";

export type FrontendLlmCredentialMode =
  | "backend-managed"
  | "session-only";

export type FrontendLlmSettings = {
  enabled: boolean;
  provider: FrontendLlmProvider;
  model: string;
  baseUrl: string;
  credentialMode: FrontendLlmCredentialMode;
  apiKeyProvided: boolean;
  temperature: string;
  notes: string;
  updatedAt?: string;
};

export const FRONTEND_LLM_SETTINGS_STORAGE_KEY =
  "smart-spatial:frontend-llm-settings";

export const DEFAULT_FRONTEND_LLM_SETTINGS: FrontendLlmSettings = {
  enabled: true,
  provider: "backend-default",
  model: "backend-default",
  baseUrl: "",
  credentialMode: "backend-managed",
  apiKeyProvided: false,
  temperature: "",
  notes: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeProvider(value: unknown): FrontendLlmProvider {
  if (
    value === "backend-default" ||
    value === "openai-compatible" ||
    value === "ollama" ||
    value === "custom"
  ) {
    return value;
  }

  return "backend-default";
}

function normalizeCredentialMode(value: unknown): FrontendLlmCredentialMode {
  if (value === "backend-managed" || value === "session-only") {
    return value;
  }

  return "backend-managed";
}

export function normalizeFrontendLlmSettings(
  value: unknown
): FrontendLlmSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_FRONTEND_LLM_SETTINGS };
  }

  return {
    enabled: asBoolean(value.enabled, DEFAULT_FRONTEND_LLM_SETTINGS.enabled),
    provider: normalizeProvider(value.provider),
    model:
      asString(value.model, DEFAULT_FRONTEND_LLM_SETTINGS.model).trim() ||
      DEFAULT_FRONTEND_LLM_SETTINGS.model,
    baseUrl: asString(value.baseUrl ?? value.base_url, "").trim(),
    credentialMode: normalizeCredentialMode(
      value.credentialMode ?? value.credential_mode
    ),
    apiKeyProvided:
      normalizeCredentialMode(value.credentialMode ?? value.credential_mode) === "session-only"
        ? asBoolean(value.apiKeyProvided ?? value.api_key_provided, false)
        : false,
    temperature: asString(value.temperature, "").trim(),
    notes: asString(value.notes, "").trim(),
    updatedAt: asString(value.updatedAt ?? value.updated_at, "")
  };
}

export function readFrontendLlmSettings(): FrontendLlmSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FRONTEND_LLM_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(FRONTEND_LLM_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FRONTEND_LLM_SETTINGS };

    return normalizeFrontendLlmSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FRONTEND_LLM_SETTINGS };
  }
}

export function saveFrontendLlmSettings(settings: FrontendLlmSettings) {
  if (typeof window === "undefined") return;

  const safeSettings: FrontendLlmSettings = {
    ...normalizeFrontendLlmSettings(settings),
    // مهم: API key واقعی را در localStorage ذخیره نمی‌کنیم.
    apiKeyProvided: Boolean(settings.apiKeyProvided),
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(
    FRONTEND_LLM_SETTINGS_STORAGE_KEY,
    JSON.stringify(safeSettings)
  );
}

export function buildFrontendLlmRequestConfig(
  settings: FrontendLlmSettings = readFrontendLlmSettings()
): Record<string, unknown> {
  const normalized = normalizeFrontendLlmSettings(settings);

  const temperatureNumber =
    normalized.temperature.trim() === ""
      ? null
      : Number(normalized.temperature);

  return {
    enabled: normalized.enabled,
    provider: normalized.provider,
    model: normalized.model || "backend-default",
    mode: normalized.credentialMode,
    credential_mode: normalized.credentialMode,
    api_key_provided:
      normalized.credentialMode === "session-only"
        ? normalized.apiKeyProvided
        : false,
    source: "frontend-settings",
    ...(normalized.baseUrl ? { base_url: normalized.baseUrl } : {}),
    ...(temperatureNumber !== null && Number.isFinite(temperatureNumber)
      ? { temperature: temperatureNumber }
      : {})
  };
}
