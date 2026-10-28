"use client";

import React from "react";
import { useCourseStore, ActiveTool } from "@/store/courseStore";
import { IconTrash, ToolIconFeeding, ToolIconFinish, ToolIconRescue, ToolIconShore } from "@/components/ui/icons";

interface Tool {
  id: ActiveTool;
  label: string;
  icon: React.ReactNode;
  /** What a click on the map does with this tool; shown as a hint on the map. */
  hint: string;
  /** Keyboard shortcut (single key). */
  key: string;
}

const SvgIcon = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{children}</svg>
);

export const TOOLS: Tool[] = [
  {
    id: "select", label: "Select", key: "v", hint: "Click a marker to select it, drag to move it",
    icon: <SvgIcon><path d="M4 2l10 7-4 1.5L8 16l-1-4.5L3 13z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></SvgIcon>,
  },
  {
    id: "buoy", label: "Buoy", key: "b", hint: "Click on the water to place a turn buoy",
    icon: <SvgIcon><circle cx="10" cy="7" r="4" fill="#FBBF24" stroke="#B45309" strokeWidth="1"/><line x1="10" y1="11" x2="10" y2="18" stroke="#B45309" strokeWidth="1.5"/><line x1="6" y1="18" x2="14" y2="18" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/></SvgIcon>,
  },
  {
    id: "start", label: "Start", key: "s", hint: "Click to place the start",
    icon: <SvgIcon><circle cx="10" cy="10" r="7" fill="#22C55E" stroke="#15803D" strokeWidth="1"/><polygon points="8,6 15,10 8,14" fill="white"/></SvgIcon>,
  },
  {
    id: "finish", label: "Finish", key: "f", hint: "Click to place the finish gate",
    icon: <ToolIconFinish />,
  },
  {
    id: "gate", label: "Gate", key: "g", hint: "Click twice: first the left post, then the right post",
    icon: <SvgIcon><rect x="1" y="2" width="4" height="16" rx="1" fill="#6366F1" stroke="#4338CA" strokeWidth="0.8"/><rect x="15" y="2" width="4" height="16" rx="1" fill="#6366F1" stroke="#4338CA" strokeWidth="0.8"/><line x1="3" y1="5" x2="17" y2="5" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="2,2"/></SvgIcon>,
  },
  {
    id: "shore_entry", label: "Shore Entry", key: "e", hint: "Click to mark where swimmers enter the water",
    icon: <ToolIconShore />,
  },
  {
    id: "rescue_zone", label: "Rescue Zone", key: "r", hint: "Click to add corners, double-click to close the zone",
    icon: <ToolIconRescue />,
  },
  {
    id: "feeding_platform", label: "Feeding Platform", key: "p", hint: "Click to place a feeding platform",
    icon: <ToolIconFeeding />,
  },
  {
    id: "freehand", label: "Draw", key: "d", hint: "Click and drag to draw a note on the map",
    icon: <SvgIcon><path d="M3 17l4-4 3 3 4-6 3 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17" cy="5" r="2" fill="currentColor"/></SvgIcon>,
  },
];

export function ToolPanel() {
  const { activeTool, setActiveTool, selectedElementId, removeElement } =
    useCourseStore();

  return (
    <div className="flex flex-col gap-1 p-3" role="toolbar" aria-label="Course design tools">
      <p className="side-heading" id="tools-heading">Tools</p>
      <div role="radiogroup" aria-labelledby="tools-heading" className="flex flex-col gap-1">
        {TOOLS.map((tool) => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={`${tool.hint} (${tool.key.toUpperCase()})`}
              aria-label={`${tool.label} tool: ${tool.hint}`}
              aria-keyshortcuts={tool.key.toUpperCase()}
              role="radio"
              aria-checked={active}
              className={`btn btn-sm h-9 justify-start gap-3 font-normal transition-all duration-150 ${
                active ? "btn-primary shadow-sm" : "btn-ghost"
              }`}
            >
              <span className="w-6 flex items-center justify-center" aria-hidden="true">{tool.icon}</span>
              <span className="flex-1 text-left">{tool.label}</span>
              <kbd aria-hidden="true" className={`kbd-hint ${active ? "bg-white/20 border-white/30 text-white" : ""}`}>
                {tool.key.toUpperCase()}
              </kbd>
            </button>
          );
        })}
      </div>

      {selectedElementId && (
        <>
          <div className="divider my-1" />
          <button
            onClick={() => removeElement(selectedElementId)}
            title="Delete the selected marker (Del)"
            aria-label="Delete selected element"
            aria-keyshortcuts="Delete"
            className="btn btn-sm h-9 btn-error btn-outline justify-start gap-3 transition-all duration-150"
          >
            <span className="w-6 flex items-center justify-center" aria-hidden="true"><IconTrash size={16} /></span>
            <span className="flex-1 text-left">Delete selected</span>
            <kbd aria-hidden="true" className="kbd-hint">Del</kbd>
          </button>
        </>
      )}
    </div>
  );
}
