"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";

export function HtmlLangSync() {
  const language = useChatStore((s) => s.settings.language);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);
  return null;
}
