"use client";

import { useState } from "react";

interface LegendProps {
  readOnly?: boolean;
}

const ENTRIES = [
  { color: "#FBBF24", shape: "circle", label: "Buoy — Directional", arrow: "↑" },
  { color: "#EF4444", shape: "circle", label: "Buoy — Swim Left", arrow: "←" },
  { color: "#22C55E", shape: "circle", label: "Buoy — Swim Right", arrow: "→" },
  { color: "#22C55E", shape: "circle", label: "Start", arrow: "▶" },
  { color: "#111111", shape: "circle", label: "Finish", arrow: "🏁" },
  { color: "#EF4444", shape: "rect-pair", label: "Finish Funnel" },
  { color: "#6366F1", shape: "rect-pair", label: "Gate" },
  { color: "#F97316", shape: "circle", label: "Shore Entry", arrow: "~" },
  { color: "#7C3AED", shape: "rect", label: "Feeding Platform" },
  { color: "#EF4444", shape: "circle", label: "Rescue Zone", arrow: "+" },
  { color: "#3B82F6", shape: "line-solid", label: "Swim Route" },
  { color: "#3B82F6", shape: "line-dashed", label: "Entry / Exit" },
];

function LegendIcon({ entry }: { entry: typeof ENTRIES[number] }) {
  const { color, shape, arrow } = entry;

  if (shape === "circle") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        {arrow && (
          <text x="9" y="13" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
            {arrow}
          </text>
        )}
      </svg>
    );
  }

  if (shape === "rect") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2" y="2" width="14" height="14" rx="2" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      </svg>
    );
  }

  if (shape === "rect-pair") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="1" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
        <rect x="12" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      </svg>
    );
  }

  if (shape === "line-solid") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.8" />
      </svg>
    );
  }

  if (shape === "line-dashed") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.6" strokeDasharray="3,3" />
      </svg>
    );
  }

  return null;
}

export function Legend({ readOnly }: LegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!readOnly && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium shadow hover:bg-white transition-colors"
      >
        Legend
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow p-2 pointer-events-auto">
      {!readOnly && (
        <button
          onClick={() => setCollapsed(true)}
          className="absolute top-1 right-1 text-xs text-gray-400 hover:text-gray-600 leading-none px-1"
          title="Collapse legend"
        >
          ×
        </button>
      )}
      <div className="flex flex-col gap-0.5">
        {ENTRIES.map((entry) => (
          <div key={entry.label} className="flex items-center gap-1.5">
            <LegendIcon entry={entry} />
            <span className="text-[11px] text-gray-700 whitespace-nowrap">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
