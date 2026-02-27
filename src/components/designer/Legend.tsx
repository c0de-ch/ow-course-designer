"use client";

import { useState } from "react";
import type { ElementType } from "@/store/courseStore";

interface LegendProps {
  readOnly?: boolean;
  print?: boolean;
  lapColors?: { lap: number; color: string }[];
  usedTypes?: Set<ElementType>;
  freehandEntries?: { label: string; color: string }[];
}

export interface LegendEntry {
  color: string;
  shape: string;
  label: string;
  arrow?: string;
  /** Element types that make this entry relevant. undefined = always show. */
  types?: ElementType[];
}

export const ENTRIES: LegendEntry[] = [
  { color: "#FBBF24", shape: "circle", label: "Buoy — Directional", arrow: "↑", types: ["buoy"] },
  { color: "#EF4444", shape: "circle", label: "Buoy — Swim Left", arrow: "←", types: ["buoy"] },
  { color: "#22C55E", shape: "circle", label: "Buoy — Swim Right", arrow: "→", types: ["buoy"] },
  { color: "#22C55E", shape: "circle", label: "Start", arrow: "▶", types: ["start"] },
  { color: "#111111", shape: "circle", label: "Finish", arrow: "🏁", types: ["finish", "finish_left", "finish_right", "finish_endpoint"] },
  { color: "#EF4444", shape: "rect-pair", label: "Finish Funnel", types: ["finish_funnel_left", "finish_funnel_right"] },
  { color: "#6366F1", shape: "rect-pair", label: "Gate", types: ["gate_left", "gate_right"] },
  { color: "#F97316", shape: "circle", label: "Shore Entry", arrow: "~", types: ["shore_entry"] },
  { color: "#7C3AED", shape: "rect", label: "Feeding Platform", types: ["feeding_platform"] },
  { color: "#EF4444", shape: "circle", label: "Rescue Zone", arrow: "+", types: ["rescue_zone"] },
  { color: "#3B82F6", shape: "line-solid", label: "Swim Route", types: ["buoy"] },
  { color: "#F97316", shape: "line-solid", label: "Start / Finish", types: ["start", "finish", "finish_left", "finish_right", "finish_endpoint"] },
  { color: "#22C55E", shape: "line-dashed", label: "Shore Entry", types: ["shore_entry"] },
];

function LegendIcon({ entry, size = 18 }: { entry: typeof ENTRIES[number]; size?: number }) {
  const { color, shape, arrow } = entry;

  if (shape === "circle") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
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
      <svg width={size} height={size} viewBox="0 0 18 18">
        <rect x="2" y="2" width="14" height="14" rx="2" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      </svg>
    );
  }

  if (shape === "rect-pair") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
        <rect x="1" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
        <rect x="12" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      </svg>
    );
  }

  if (shape === "line-solid") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
        <line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.8" />
      </svg>
    );
  }

  if (shape === "line-dashed") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
        <line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.6" strokeDasharray="3,3" />
      </svg>
    );
  }

  return null;
}

export function Legend({ readOnly, print, lapColors, usedTypes, freehandEntries }: LegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Filter to only entries whose element types are present in the course
  const filtered = usedTypes
    ? ENTRIES.filter((e) => !e.types || e.types.some((t) => usedTypes.has(t)))
    : ENTRIES;

  // Build entries: add per-lap entries for differing laps + freehand drawings
  const lapEntries = lapColors?.map((lc) => ({
    color: lc.color,
    shape: "line-solid" as const,
    label: `Lap ${lc.lap} route`,
  })) ?? [];
  const fhEntries = freehandEntries?.map((fh) => ({
    color: fh.color,
    shape: "line-solid" as const,
    label: fh.label,
  })) ?? [];
  const displayEntries = [...filtered, ...lapEntries, ...fhEntries];

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

  const bgClass = print
    ? "absolute bottom-3 left-3 z-[9999] bg-white rounded-lg shadow p-3 pointer-events-auto"
    : "absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow p-2 pointer-events-auto";
  const textClass = print ? "text-sm text-gray-700 whitespace-nowrap" : "text-[11px] text-gray-700 whitespace-nowrap";
  const iconSize = print ? 24 : 18;

  return (
    <div className={bgClass}>
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
        {displayEntries.map((entry, idx) => (
          <div key={`${idx}-${entry.label}`} className="flex items-center gap-1.5">
            <LegendIcon entry={entry} size={iconSize} />
            <span className={textClass}>{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
