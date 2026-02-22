"use client";

import { useCourseStore, ActiveTool } from "@/store/courseStore";

interface Tool {
  id: ActiveTool;
  label: string;
  icon: string;
  description: string;
}

const TOOLS: Tool[] = [
  { id: "select", label: "Select", icon: "↖", description: "Select and drag markers" },
  { id: "buoy", label: "Buoy", icon: "🟡", description: "Place a turn buoy" },
  { id: "start", label: "Start", icon: "🟢", description: "Place start position" },
  { id: "finish", label: "Finish", icon: "🔴", description: "Place finish position" },
  { id: "gate", label: "Gate", icon: "⬛", description: "Place a gate (2 clicks)" },
  { id: "shore_entry", label: "Shore Entry", icon: "🏖", description: "Mark shore entry point" },
  { id: "rescue_zone", label: "Rescue Zone", icon: "⛑", description: "Draw rescue zone polygon" },
];

export function ToolPanel() {
  const { activeTool, setActiveTool, selectedElementId, removeElement } =
    useCourseStore();

  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide px-2 py-1">
        Tools
      </p>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={tool.description}
          className={`btn btn-sm justify-start gap-2 font-normal ${
            activeTool === tool.id
              ? "btn-primary"
              : "btn-ghost"
          }`}
        >
          <span className="text-base w-5 text-center">{tool.icon}</span>
          <span>{tool.label}</span>
        </button>
      ))}

      {selectedElementId && (
        <>
          <div className="divider my-1" />
          <button
            onClick={() => {
              removeElement(selectedElementId);
            }}
            className="btn btn-sm btn-error btn-outline justify-start gap-2"
          >
            <span className="text-base">🗑</span>
            <span>Delete selected</span>
          </button>
        </>
      )}
    </div>
  );
}
