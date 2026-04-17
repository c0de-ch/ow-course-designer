import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSettings {
  provider: "claude" | "ollama";
  claudeApiKey: string;
  claudeModel: string;
  ollamaServerUrl: string;
  ollamaModel: string;
  readAloud: boolean;
  language: Language;
}

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  settings: ChatSettings;
  isLoading: boolean;
  showSettings: boolean;
  currentPathname: string;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addMessage: (role: "user" | "assistant", content: string) => string;
  updateMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  setSettings: (settings: Partial<ChatSettings>) => void;
  setLoading: (loading: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setCurrentPathname: (pathname: string) => void;
}

const defaultSettings: ChatSettings = {
  provider: "claude",
  claudeApiKey: "",
  claudeModel: "claude-sonnet-4-6-20250514",
  ollamaServerUrl: "http://localhost:11434",
  ollamaModel: "",
  readAloud: false,
  language: "en",
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      messages: [],
      settings: defaultSettings,
      isLoading: false,
      showSettings: false,
      currentPathname: "/",

      setOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

      addMessage: (role, content) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({
          messages: [
            ...s.messages,
            { id, role, content, timestamp: Date.now() },
          ],
        }));
        return id;
      },

      updateMessage: (id, content) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        }));
      },

      clearMessages: () => set({ messages: [] }),

      setSettings: (partial) => {
        set((s) => ({ settings: { ...s.settings, ...partial } }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setShowSettings: (show) => set({ showSettings: show }),
      setCurrentPathname: (pathname) => set({ currentPathname: pathname }),
    }),
    {
      name: "help-chat-store",
      partialize: (state) => ({
        settings: state.settings,
        messages: state.messages,
      }),
    }
  )
);
