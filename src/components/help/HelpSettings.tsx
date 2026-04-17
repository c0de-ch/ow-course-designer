"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { t, LANGUAGES, type Language } from "@/lib/i18n";

type VerifyStatus = "idle" | "verifying" | "success" | "error";

export function HelpSettings() {
  const { settings, setSettings } = useChatStore();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState("");

  const lang = settings.language;

  const verifyConnection = async () => {
    setVerifyStatus("verifying");
    setVerifyMessage("");
    try {
      const res = await fetch("/api/chat/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          claudeApiKey: settings.claudeApiKey,
          claudeModel: settings.claudeModel,
          ollamaServerUrl: settings.ollamaServerUrl,
          ollamaModel: settings.ollamaModel,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setVerifyStatus("success");
        setVerifyMessage(t("connected", lang));
        // If Ollama returned models, populate the list
        if (data.models?.length) {
          setOllamaModels(data.models);
          if (!settings.ollamaModel) {
            setSettings({ ollamaModel: data.models[0] });
          }
        }
      } else {
        setVerifyStatus("error");
        setVerifyMessage(data.error || t("connectionFailed", lang));
      }
    } catch (err) {
      setVerifyStatus("error");
      setVerifyMessage((err as Error).message);
    }
    // Auto-clear after 5s
    setTimeout(() => {
      setVerifyStatus((s) => (s === "verifying" ? s : "idle"));
      setVerifyMessage("");
    }, 5000);
  };

  const fetchOllamaModels = async () => {
    setFetchingModels(true);
    setFetchError("");
    try {
      const res = await fetch("/api/chat/ollama-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: settings.ollamaServerUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || "Failed to fetch models");
        return;
      }
      setOllamaModels(data.models || []);
      if (data.models?.length && !settings.ollamaModel) {
        setSettings({ ollamaModel: data.models[0] });
      }
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setFetchingModels(false);
    }
  };

  const canVerify =
    settings.provider === "claude"
      ? !!settings.claudeApiKey
      : !!settings.ollamaServerUrl;

  return (
    <div className="p-4 overflow-y-auto h-full space-y-6">
      {/* Provider */}
      <div>
        <label className="text-sm font-medium text-white/70 block mb-2">
          {t("provider", lang)}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSettings({ provider: "claude" });
              setVerifyStatus("idle");
              setVerifyMessage("");
            }}
            className={`btn btn-sm flex-1 ${
              settings.provider === "claude"
                ? "btn-primary"
                : "btn-ghost border border-white/10 text-white/60"
            }`}
          >
            {t("claude", lang)}
          </button>
          <button
            onClick={() => {
              setSettings({ provider: "ollama" });
              setVerifyStatus("idle");
              setVerifyMessage("");
            }}
            className={`btn btn-sm flex-1 ${
              settings.provider === "ollama"
                ? "btn-primary"
                : "btn-ghost border border-white/10 text-white/60"
            }`}
          >
            {t("ollama", lang)}
          </button>
        </div>
      </div>

      {/* Claude settings */}
      {settings.provider === "claude" && (
        <>
          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">
              {t("apiKey", lang)}
            </label>
            <input
              type="password"
              value={settings.claudeApiKey}
              onChange={(e) => {
                setSettings({ claudeApiKey: e.target.value });
                setVerifyStatus("idle");
              }}
              placeholder="sk-ant-..."
              className="input input-sm input-bordered w-full bg-white/5 border-white/10 text-white placeholder:text-white/20"
            />
            <p className="text-xs text-white/30 mt-1">
              Get your key at console.anthropic.com
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">
              {t("claudeModel", lang)}
            </label>
            <select
              value={settings.claudeModel}
              onChange={(e) => setSettings({ claudeModel: e.target.value })}
              className="select select-sm select-bordered w-full bg-white/5 border-white/10 text-white"
            >
              <option value="claude-sonnet-4-6-20250514">
                Claude Sonnet 4.6
              </option>
              <option value="claude-haiku-4-5-20251001">
                Claude Haiku 4.5
              </option>
              <option value="claude-opus-4-6-20250514">
                Claude Opus 4.6
              </option>
            </select>
          </div>
        </>
      )}

      {/* Ollama settings */}
      {settings.provider === "ollama" && (
        <>
          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">
              {t("serverUrl", lang)}
            </label>
            <input
              type="text"
              value={settings.ollamaServerUrl}
              onChange={(e) => {
                setSettings({ ollamaServerUrl: e.target.value });
                setVerifyStatus("idle");
              }}
              placeholder="http://localhost:11434"
              className="input input-sm input-bordered w-full bg-white/5 border-white/10 text-white placeholder:text-white/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-1.5">
              {t("model", lang)}
            </label>
            <div className="flex gap-2">
              <select
                value={settings.ollamaModel}
                onChange={(e) =>
                  setSettings({ ollamaModel: e.target.value })
                }
                className="select select-sm select-bordered flex-1 bg-white/5 border-white/10 text-white"
              >
                <option value="">{t("selectModel", lang)}</option>
                {ollamaModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchOllamaModels}
                disabled={fetchingModels || !settings.ollamaServerUrl}
                className="btn btn-sm btn-outline border-white/10 text-white/60 hover:text-white shrink-0"
              >
                {fetchingModels ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  t("fetchModels", lang)
                )}
              </button>
            </div>
            {fetchError && (
              <p className="text-xs text-red-400 mt-1">{fetchError}</p>
            )}
          </div>
        </>
      )}

      {/* Verify connection button */}
      <div>
        <button
          onClick={verifyConnection}
          disabled={!canVerify || verifyStatus === "verifying"}
          className={`btn btn-sm w-full ${
            verifyStatus === "success"
              ? "btn-success"
              : verifyStatus === "error"
              ? "btn-error"
              : "btn-outline border-white/10 text-white/60 hover:text-white"
          }`}
        >
          {verifyStatus === "verifying" ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              {t("verifying", lang)}
            </>
          ) : verifyStatus === "success" ? (
            <>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t("connected", lang)}
            </>
          ) : verifyStatus === "error" ? (
            <>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {t("connectionFailed", lang)}
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {t("verify", lang)}
            </>
          )}
        </button>
        {verifyStatus === "error" && verifyMessage && (
          <p className="text-xs text-red-400 mt-1.5">{verifyMessage}</p>
        )}
      </div>

      <div className="border-t border-white/10 pt-4">
        {/* Language */}
        <div>
          <label className="text-sm font-medium text-white/70 block mb-1.5">
            {t("language", lang)}
          </label>
          <select
            value={settings.language}
            onChange={(e) =>
              setSettings({ language: e.target.value as Language })
            }
            className="select select-sm select-bordered w-full bg-white/5 border-white/10 text-white"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Read aloud toggle */}
        <div className="flex items-center justify-between mt-4">
          <label className="text-sm text-white/70">
            {t("readAloudToggle", lang)}
          </label>
          <input
            type="checkbox"
            checked={settings.readAloud}
            onChange={(e) => setSettings({ readAloud: e.target.checked })}
            className="toggle toggle-xs toggle-primary"
          />
        </div>
      </div>
    </div>
  );
}
