import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  Info,
  KeyRound,
  Save,
  ShieldCheck
} from "lucide-react";
import { api } from "../../lib/api";
import {
  buildFrontendLlmRequestConfig,
  DEFAULT_FRONTEND_LLM_SETTINGS,
  readFrontendLlmSettings,
  saveFrontendLlmSettings
} from "../../lib/llmSettings";
import type {
  FrontendLlmCredentialMode,
  FrontendLlmProvider,
  FrontendLlmSettings
} from "../../lib/llmSettings";

type SmokeState = {
  status: "idle" | "testing" | "success" | "error";
  message: string;
};

export function LlmSettingsCard() {
  const [settings, setSettings] = useState<FrontendLlmSettings>(() =>
    readFrontendLlmSettings()
  );
  const [sessionApiKey, setSessionApiKey] = useState("");
  const [smoke, setSmoke] = useState<SmokeState>({
    status: "idle",
    message: ""
  });

  const requestPreview = useMemo(
    () => buildFrontendLlmRequestConfig(settings),
    [settings]
  );

  function updateSettings(next: Partial<FrontendLlmSettings>) {
    const merged = {
      ...settings,
      ...next
    };

    setSettings(merged);
  }

  function handleSave() {
    saveFrontendLlmSettings(settings);
    setSmoke({
      status: "success",
      message: "LLM settings saved locally. API keys are not persisted."
    });
  }

  function handleReset() {
    setSettings({ ...DEFAULT_FRONTEND_LLM_SETTINGS });
    setSessionApiKey("");
    saveFrontendLlmSettings({ ...DEFAULT_FRONTEND_LLM_SETTINGS });
    setSmoke({
      status: "idle",
      message: "LLM settings reset to backend-managed defaults."
    });
  }

  async function handleSmokeTest() {
    if (!settings.enabled) {
      setSmoke({
        status: "idle",
        message:
          "LLM planning is disabled in frontend settings. Smoke test was skipped."
      });
      return;
    }

    setSmoke({
      status: "testing",
      message: "Testing LLM settings against backend..."
    });

    try {
      const payload: Record<string, unknown> = {
        llm: buildFrontendLlmRequestConfig(settings),
        source: "smart-spatial-frontend-settings"
      };

      if (
        settings.credentialMode === "session-only" &&
        sessionApiKey.trim()
      ) {
        payload.session_api_key = sessionApiKey.trim();
      }

      const response = await api.llmSmokeTest(payload);

      setSmoke({
        status: "success",
        message:
          typeof response === "string"
            ? response
            : "LLM smoke test request completed. Inspect raw backend settings/response if needed."
      });
    } catch (error) {
      setSmoke({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "LLM smoke test failed."
      });
    }
  }

  const providerOptions: Array<{
    value: FrontendLlmProvider;
    label: string;
    description: string;
  }> = [
    {
      value: "backend-default",
      label: "Backend Default",
      description: "Use the provider and API key configured on the backend."
    },
    {
      value: "openai-compatible",
      label: "OpenAI Compatible",
      description: "Use an OpenAI-compatible backend configuration."
    },
    {
      value: "ollama",
      label: "Local Ollama",
      description: "Use a local or LAN Ollama-compatible endpoint."
    },
    {
      value: "custom",
      label: "Custom",
      description: "Send a custom provider/model hint to the backend."
    }
  ];

  return (
    <section className="rounded-3xl border border-purple-100 bg-white/95 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-950">
              LLM Planning Settings
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Configure how AI Query should request LLM-assisted planning.
              API keys should normally be managed by the backend.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              updateSettings({ enabled: event.target.checked })
            }
          />
          Enabled
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-extrabold text-slate-600">
            Provider
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={settings.provider}
            onChange={(event) =>
              updateSettings({
                provider: event.target.value as FrontendLlmProvider
              })
            }
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-4 text-slate-400">
            {
              providerOptions.find(
                (option) => option.value === settings.provider
              )?.description
            }
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-extrabold text-slate-600">
            Model
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={settings.model}
            placeholder="backend-default, gpt-4o-mini, llama3.1..."
            onChange={(event) => updateSettings({ model: event.target.value })}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-extrabold text-slate-600">
            Base URL
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={settings.baseUrl}
            placeholder="Optional. Prefer backend-managed configuration."
            onChange={(event) =>
              updateSettings({ baseUrl: event.target.value })
            }
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-extrabold text-slate-600">
            Credential Mode
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={settings.credentialMode}
            onChange={(event) =>
              updateSettings({
                credentialMode: event.target
                  .value as FrontendLlmCredentialMode,
                apiKeyProvided:
                  event.target.value === "session-only" &&
                  Boolean(sessionApiKey.trim())
              })
            }
          >
            <option value="backend-managed">Backend managed</option>
            <option value="session-only">Session only smoke test</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-extrabold text-slate-600">
            Temperature
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={settings.temperature}
            placeholder="Optional, e.g. 0.2"
            onChange={(event) =>
              updateSettings({ temperature: event.target.value })
            }
          />
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-extrabold text-slate-600">
            <KeyRound size={13} />
            Session API Key
          </span>
          <input
            type="password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50"
            value={sessionApiKey}
            placeholder="Not saved. Only used for smoke test if needed."
            onChange={(event) => {
              setSessionApiKey(event.target.value);
              updateSettings({
                apiKeyProvided: Boolean(event.target.value.trim())
              });
            }}
          />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
        <div className="flex items-start gap-2 text-xs leading-5 text-blue-800">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-extrabold">Security note</div>
            <div>
              API keys are not persisted in localStorage. For production, use
              backend-managed credentials and store secrets only on the server.
            </div>
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-extrabold text-slate-600">
          Request payload preview
        </summary>
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
{JSON.stringify(requestPreview, null, 2)}
        </pre>
      </details>

      {smoke.message && (
        <div
          className={[
            "mt-4 flex items-start gap-2 rounded-2xl border p-3 text-xs leading-5",
            smoke.status === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : smoke.status === "error"
                ? "border-red-100 bg-red-50 text-red-800"
                : "border-slate-100 bg-slate-50 text-slate-700"
          ].join(" ")}
        >
          {smoke.status === "success" ? (
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          ) : smoke.status === "error" ? (
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={15} className="mt-0.5 shrink-0" />
          )}
          <span>{smoke.message}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-purple-800"
        >
          <Save size={14} />
          Save LLM Settings
        </button>

        <button
          type="button"
          onClick={handleSmokeTest}
          disabled={smoke.status === "testing" || !settings.enabled}
          className="inline-flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-extrabold text-purple-800 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FlaskConical size={14} />
          {!settings.enabled
            ? "Disabled"
            : smoke.status === "testing"
              ? "Testing..."
              : "Smoke Test"}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
