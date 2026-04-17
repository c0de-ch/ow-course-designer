"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore, type ChatMessage } from "@/store/chatStore";
import { findCachedResponse } from "@/lib/help-manual";
import { t, SPEECH_LANG_MAP, type Language } from "@/lib/i18n";

export function HelpChat() {
  const {
    messages,
    settings,
    isLoading,
    currentPathname,
    addMessage,
    updateMessage,
    setLoading,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const lang = settings.language;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!settings.readAloud || typeof window === "undefined") return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LANG_MAP[lang] || "en-US";
      window.speechSynthesis.speak(utterance);
    },
    [settings.readAloud, lang]
  );

  const copyToClipboard = useCallback(
    async (text: string, id: string) => {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInput("");
      addMessage("user", trimmed);

      // Check for cached response first
      const cached = findCachedResponse(trimmed);
      if (cached) {
        addMessage("assistant", cached);
        speak(cached);
        return;
      }

      // Check if provider is configured
      const isConfigured =
        settings.provider === "claude"
          ? !!settings.claudeApiKey
          : !!settings.ollamaModel;

      if (!isConfigured) {
        addMessage("assistant", t("configureProvider", lang));
        return;
      }

      // Stream from API
      setLoading(true);
      const assistantId = addMessage("assistant", "");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Get conversation history (excluding the empty assistant message we just added)
        const allMessages = useChatStore.getState().messages;
        const conversationMessages = allMessages
          .filter((m) => m.id !== assistantId)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationMessages,
            settings: {
              provider: settings.provider,
              claudeApiKey: settings.claudeApiKey,
              claudeModel: settings.claudeModel,
              ollamaServerUrl: settings.ollamaServerUrl,
              ollamaModel: settings.ollamaModel,
              language: settings.language,
            },
            context: { pathname: currentPathname },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          updateMessage(assistantId, `Error: ${error}`);
          setLoading(false);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          updateMessage(assistantId, fullText);
        }

        if (settings.readAloud && fullText) {
          speak(fullText);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          updateMessage(assistantId, `Error: ${(err as Error).message}`);
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [
      isLoading,
      settings,
      currentPathname,
      lang,
      addMessage,
      updateMessage,
      setLoading,
      speak,
    ]
  );

  const stopAudioVisualization = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Average of lower frequencies for voice
        let sum = 0;
        const count = Math.min(32, dataArray.length);
        for (let i = 0; i < count; i++) sum += dataArray[i];
        setAudioLevel(sum / count / 255);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Microphone access denied — visualization just won't show
    }
  }, []);

  const startVoiceInput = useCallback(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!SR) {
      alert(t("voiceNotSupported", lang));
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = SPEECH_LANG_MAP[lang] || "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      startAudioVisualization();
    };
    recognition.onend = () => {
      setIsListening(false);
      stopAudioVisualization();
    };
    recognition.onerror = () => {
      setIsListening(false);
      stopAudioVisualization();
    };

    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognition.start();
  }, [lang, sendMessage, startAudioVisualization, stopAudioVisualization]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40 text-sm">
            <div className="text-center space-y-2">
              <svg
                viewBox="0 0 24 24"
                className="w-12 h-12 mx-auto opacity-30"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              <p className="text-base">{t("noMessages", lang)}</p>
              <p className="text-xs">{t("askAnything", lang)}</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              lang={lang}
              copiedId={copiedId}
              onCopy={copyToClipboard}
              onSpeak={speak}
            />
          ))
        )}
        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-2 text-white/50 text-sm pl-2">
              <span className="loading loading-dots loading-sm" />
              {t("thinking", lang)}
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 shrink-0">
            {/* Audio level bars — visible when listening */}
            {isListening && (
              <div className="flex items-end gap-[2px] h-6 mr-0.5">
                {[0, 1, 2, 3, 4].map((i) => {
                  const barLevel = Math.min(
                    1,
                    Math.max(0.15, audioLevel * (1.2 - Math.abs(i - 2) * 0.15))
                  );
                  return (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-green-400 transition-all duration-75"
                      style={{ height: `${barLevel * 100}%` }}
                    />
                  );
                })}
              </div>
            )}
            <button
              onClick={startVoiceInput}
              disabled={isListening || isLoading}
              className={`btn btn-sm btn-circle ${
                isListening
                  ? "bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30"
                  : "btn-ghost text-white/50 hover:text-white"
              }`}
              title={
                isListening ? t("listening", lang) : t("voiceInput", lang)
              }
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-4 h-4 ${isListening ? "animate-pulse" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("typePlaceholder", lang)}
            disabled={isLoading}
            className="input input-sm input-bordered flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="btn btn-sm btn-primary shrink-0"
          >
            {t("send", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  lang,
  copiedId,
  onCopy,
  onSpeak,
}: {
  message: ChatMessage;
  lang: Language;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onSpeak: (text: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600/80 text-white"
            : "bg-white/10 text-white/90"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <div
            className="
              leading-relaxed
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              [&_p]:mb-2
              [&_strong]:font-semibold
              [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-0.5
              [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-0.5
              [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_pre]:bg-white/10 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-2
              [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1
              [&_a]:text-blue-400 [&_a]:underline
              [&_hr]:border-white/10 [&_hr]:my-2
            "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : null}

        {/* Action buttons for assistant messages */}
        {!isUser && message.content && (
          <div className="flex gap-2 mt-1.5 -mb-0.5 border-t border-white/5 pt-1">
            <button
              onClick={() => onCopy(message.content, message.id)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              {copiedId === message.id
                ? t("copied", lang)
                : t("copy", lang)}
            </button>
            <button
              onClick={() => onSpeak(message.content)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              {t("readAloud", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
