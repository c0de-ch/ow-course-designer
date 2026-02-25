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
  { id: "finish", label: "Finish", icon: "🏁", description: "Place finish gate (1 click)" },
  { id: "gate", label: "Gate", icon: "⬛", description: "Place a gate (2 clicks)" },
  { id: "shore_entry", label: "Shore Entry", icon: "🏖", description: "Mark shore entry point" },
  { id: "rescue_zone", label: "Rescue Zone", icon: "⛑", description: "Draw rescue zone polygon" },
  { id: "feeding_platform", label: "Feeding Platform", icon: "🍵", description: "Place feeding/aid platform" },
];

export function ToolPanel() {
  const { activeTool, setActiveTool, selectedElementId, removeElement } =
    useCourseStore();

  return (
    <div className="flex flex-col gap-1.5 p-3">
      <p className="text-sm font-bold text-base-content/70 uppercase tracking-wide px-2 py-1">
        Tools
      </p>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={tool.description}
          className={`btn justify-start gap-3 font-normal transition-all duration-150 ${
            activeTool === tool.id
              ? "btn-primary shadow-md ring-2 ring-primary/30"
              : "btn-ghost"
          }`}
        >
          <span className="text-lg w-6 text-center">{tool.icon}</span>
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
            className="btn btn-error btn-outline justify-start gap-3 transition-all duration-150"
          >
            <span className="text-lg w-6 text-center">🗑</span>
            <span>Delete selected</span>
          </button>
        </>
      )}
    </div>
  );
}
