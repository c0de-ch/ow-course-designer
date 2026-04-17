"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/store/chatStore";
import { t } from "@/lib/i18n";
import { HelpChat } from "./HelpChat";
import { HelpSettings } from "./HelpSettings";

export function HelpWidget() {
  const {
    isOpen,
    toggleOpen,
    setOpen,
    showSettings,
    setShowSettings,
    settings,
    clearMessages,
  } = useChatStore();
  const pathname = usePathname();
  const setCurrentPathname = useChatStore((s) => s.setCurrentPathname);
  const lang = settings.language;

  useEffect(() => {
    setCurrentPathname(pathname);
  }, [pathname, setCurrentPathname]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, setOpen]);

  return (
    <>
      {/* Floating help button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          title={t("help", lang)}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      )}

      {/* Chat modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative w-[90vw] max-w-5xl h-[85vh] bg-gray-900/95 rounded-2xl shadow-2xl ring-1 ring-white/15 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">
                  {t("help", lang)}
                </h2>
                {!showSettings && (
                  <button
                    onClick={clearMessages}
                    className="btn btn-xs btn-ghost text-white/40 hover:text-white/70"
                    title={t("clearChat", lang)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Settings toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`btn btn-sm btn-ghost btn-circle ${
                    showSettings
                      ? "text-blue-400"
                      : "text-white/50 hover:text-white"
                  }`}
                  title={
                    showSettings
                      ? t("back", lang)
                      : t("settings", lang)
                  }
                >
                  {showSettings ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>

                {/* Close button */}
                <button
                  onClick={() => setOpen(false)}
                  className="btn btn-sm btn-ghost btn-circle text-white/50 hover:text-white"
                  title={t("close", lang)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {showSettings ? <HelpSettings /> : <HelpChat />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
