"use client";

import React from "react";
import { useCourseStore, ActiveTool } from "@/store/courseStore";

interface Tool {
  id: ActiveTool;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const SvgIcon = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">{children}</svg>
);

const TOOLS: Tool[] = [
  {
    id: "select", label: "Select", description: "Select and drag markers",
    icon: <SvgIcon><path d="M4 2l10 7-4 1.5L8 16l-1-4.5L3 13z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></SvgIcon>,
  },
  {
    id: "buoy", label: "Buoy", description: "Place a turn buoy",
    icon: <SvgIcon><circle cx="10" cy="7" r="4" fill="#FBBF24" stroke="#B45309" strokeWidth="1"/><line x1="10" y1="11" x2="10" y2="18" stroke="#B45309" strokeWidth="1.5"/><line x1="6" y1="18" x2="14" y2="18" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/></SvgIcon>,
  },
  {
    id: "start", label: "Start", description: "Place start position",
    icon: <SvgIcon><circle cx="10" cy="10" r="7" fill="#22C55E" stroke="#15803D" strokeWidth="1"/><polygon points="8,6 15,10 8,14" fill="white"/></SvgIcon>,
  },
  {
    id: "finish", label: "Finish", description: "Place finish gate (1 click)",
    icon: <span className="text-lg w-5 text-center leading-none">🏁</span>,
  },
  {
    id: "gate", label: "Gate", description: "Place a gate (2 clicks)",
    icon: <SvgIcon><rect x="1" y="2" width="4" height="16" rx="1" fill="#6366F1" stroke="#4338CA" strokeWidth="0.8"/><rect x="15" y="2" width="4" height="16" rx="1" fill="#6366F1" stroke="#4338CA" strokeWidth="0.8"/><line x1="3" y1="5" x2="17" y2="5" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="2,2"/></SvgIcon>,
  },
  {
    id: "shore_entry", label: "Shore Entry", description: "Mark shore entry point",
    icon: <span className="text-lg w-5 text-center leading-none">🏖</span>,
  },
  {
    id: "rescue_zone", label: "Rescue Zone", description: "Draw rescue zone polygon",
    icon: <span className="text-lg w-5 text-center leading-none">⛑</span>,
  },
  {
    id: "feeding_platform", label: "Feeding Platform", description: "Place feeding/aid platform",
    icon: <span className="text-lg w-5 text-center leading-none">🍵</span>,
  },
  {
    id: "freehand", label: "Draw", description: "Freehand draw annotation lines",
    icon: <SvgIcon><path d="M3 17l4-4 3 3 4-6 3 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17" cy="5" r="2" fill="currentColor"/></SvgIcon>,
  },
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
          <span className="w-6 flex items-center justify-center">{tool.icon}</span>
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
