"use client";

import { useCourseStore } from "@/store/courseStore";

export function StatusBar() {
  const { autoSaveEnabled, setAutoSaveEnabled, lastSavedAt, statusMessage, isDirty } =
    useCourseStore();

  let displayMessage = statusMessage;
  if (!displayMessage) {
    if (isDirty) {
      displayMessage = "Unsaved changes";
    } else if (lastSavedAt) {
      displayMessage = `Auto-saved at ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  return (
    <div className="flex items-center justify-between px-3 h-7 bg-base-200 border-t border-base-300 text-xs text-base-content/60 shrink-0">
      <span>{displayMessage ?? "\u00A0"}</span>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <span>Auto-save</span>
        <input
          type="checkbox"
          className="toggle toggle-xs toggle-primary"
          checked={autoSaveEnabled}
          onChange={(e) => setAutoSaveEnabled(e.target.checked)}
        />
      </label>
    </div>
  );
}
