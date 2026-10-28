"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useCourseStore,
  getBuoySide,
  setBuoySideInMeta,
  type BuoySide,
  type ElementType,
} from "@/store/courseStore";
import { IconTrash } from "@/components/ui/icons";

const TYPE_NAMES: Partial<Record<ElementType, string>> = {
  buoy: "Buoy",
  start: "Start",
  finish: "Finish",
  finish_left: "Finish (left)",
  finish_right: "Finish (right)",
  finish_endpoint: "Finish",
  finish_funnel_left: "Finish funnel (left)",
  finish_funnel_right: "Finish funnel (right)",
  gate_left: "Gate (left post)",
  gate_right: "Gate (right post)",
  shore_entry: "Shore entry",
  rescue_zone: "Rescue zone",
  feeding_platform: "Feeding platform",
};

const SIDES: { side: BuoySide; label: string; color: string; text: string }[] = [
  { side: "left", label: "← Left", color: "#EF4444", text: "#fff" },
  { side: "directional", label: "↑ Turn", color: "#FBBF24", text: "#111" },
  { side: "right", label: "Right →", color: "#22C55E", text: "#fff" },
];

interface Props {
  elementId: string;
  /** Position relative to the map container */
  x: number;
  y: number;
  onClose: () => void;
}

/** Right-click menu for a placed marker: label, buoy swim side, delete. */
export function MarkerContextMenu({ elementId, x, y, onClose }: Props) {
  const element = useCourseStore((s) => s.courseData.elements.find((el) => el.id === elementId));
  const { updateElementLabel, updateElementMeta, removeElement, setSelectedElementId } = useCourseStore();
  const [label, setLabel] = useState(element?.label ?? "");
  const [pos, setPos] = useState({ left: x, top: y });
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the menu inside the map area
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const container = menu?.offsetParent as HTMLElement | null;
    if (!menu || !container) return;
    const maxLeft = container.clientWidth - menu.offsetWidth - 8;
    const maxTop = container.clientHeight - menu.offsetHeight - 8;
    setPos({ left: Math.max(8, Math.min(x, maxLeft)), top: Math.max(8, Math.min(y, maxTop)) });
  }, [x, y]);

  // Close on Escape or a click elsewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  if (!element) return null;

  const saveLabel = () => {
    if ((element.label ?? "") !== label.trim()) updateElementLabel(element.id, label);
  };

  const close = () => {
    saveLabel();
    onClose();
  };

  const side = element.type === "buoy" ? getBuoySide(element.metadata) : null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${TYPE_NAMES[element.type] ?? "Marker"} options`}
      className="absolute z-30 w-64 bg-base-100 text-base-content rounded-xl shadow-2xl ring-1 ring-black/10 p-3 flex flex-col gap-3"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{TYPE_NAMES[element.type] ?? "Marker"}</span>
        <span className="text-[11px] text-base-content/50 tabular-nums">
          {element.lat.toFixed(5)}, {element.lng.toFixed(5)}
        </span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-base-content/60">Label</span>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") close();
            if (e.key === "Escape") onClose();
          }}
          onBlur={saveLabel}
          maxLength={60}
          placeholder="e.g. Buoy 1, Turn here, Exit"
          className="input input-sm input-bordered w-full max-w-none"
        />
        <span className="text-[11px] text-base-content/45">
          Shown next to the marker, in the PDF and in GPX/KML exports.
        </span>
      </label>

      {side && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/60">Swim side</span>
          <div className="grid grid-cols-3 gap-1">
            {SIDES.map((s) => (
              <button
                key={s.side}
                type="button"
                onClick={() => updateElementMeta(element.id, setBuoySideInMeta(element.metadata, s.side))}
                aria-pressed={side === s.side}
                className={`h-8 rounded-md text-xs font-semibold transition-shadow ${
                  side === s.side ? "ring-2 ring-offset-1 ring-sky-500" : "opacity-70 hover:opacity-100"
                }`}
                style={{ background: s.color, color: s.text }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-base-300">
        <button
          type="button"
          onClick={() => {
            saveLabel();
            setSelectedElementId(element.id);
            onClose();
          }}
          className="btn btn-ghost btn-sm flex-1"
          title="Select it to see all its settings in the sidebar, or drag it to move it"
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => {
            removeElement(element.id);
            onClose();
          }}
          className="btn btn-sm btn-error btn-outline flex-1 gap-1.5"
        >
          <IconTrash size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
