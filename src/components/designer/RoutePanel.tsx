"use client";

import { useRef, useState } from "react";
import { useCourseStore, CourseElement, ElementType, BuoySide, getBuoySide, setBuoySideInMeta } from "@/store/courseStore";

const TYPE_LABELS: Record<ElementType, string> = {
  buoy: "Buoy",
  start: "Start",
  finish: "Finish",
  gate_left: "Gate L",
  gate_right: "Gate R",
  shore_entry: "Shore",
  rescue_zone: "Rescue",
  feeding_platform: "Feeding",
};

const TYPE_COLORS: Record<ElementType, string> = {
  buoy: "#FBBF24",
  start: "#22C55E",
  finish: "#111111",
  gate_left: "#6366F1",
  gate_right: "#6366F1",
  shore_entry: "#F97316",
  rescue_zone: "#EF4444",
  feeding_platform: "#7C3AED",
};

const LAPS_TYPES: ElementType[] = ["buoy", "gate_left", "gate_right", "finish"];

export function RoutePanel() {
  const {
    courseData,
    selectedElementId,
    setSelectedElementId,
    reorderElements,
    updateElementMeta,
  } = useCourseStore();

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const routeElements = [...courseData.elements]
    .filter((el) => el.type !== "rescue_zone")
    .sort((a, b) => a.order - b.order);

  const rescueElements = courseData.elements.filter(
    (el) => el.type === "rescue_zone"
  );

  if (routeElements.length === 0) return null;

  const selectedEl = selectedElementId
    ? courseData.elements.find((el) => el.id === selectedElementId)
    : null;

  const showLaps = selectedEl != null && LAPS_TYPES.includes(selectedEl.type);

  let lapsValue = "";
  if (showLaps && selectedEl) {
    try {
      const meta = selectedEl.metadata ? JSON.parse(selectedEl.metadata) : null;
      if (meta && !Array.isArray(meta) && meta.mandatoryLaps != null) {
        lapsValue = String(meta.mandatoryLaps);
      }
    } catch {
      // ignore parse errors
    }
  }

  function handleDragStart(i: number) {
    dragIndexRef.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  function handleDrop(dropIndex: number) {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }

    const newRoute = [...routeElements];
    const [moved] = newRoute.splice(dragIndex, 1);
    newRoute.splice(dropIndex, 0, moved);

    const reordered: CourseElement[] = [
      ...newRoute.map((el, i) => ({ ...el, order: i })),
      ...rescueElements.map((el, i) => ({
        ...el,
        order: newRoute.length + i,
      })),
    ];

    dragIndexRef.current = null;
    setDragOverIndex(null);
    reorderElements(reordered);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleLapsChange(value: string) {
    if (!selectedEl) return;
    if (!value.trim()) {
      updateElementMeta(selectedEl.id, null);
      return;
    }
    let existingMeta: Record<string, unknown> = {};
    try {
      const parsed = selectedEl.metadata
        ? JSON.parse(selectedEl.metadata)
        : null;
      if (parsed && !Array.isArray(parsed)) {
        existingMeta = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    updateElementMeta(
      selectedEl.id,
      JSON.stringify({ ...existingMeta, mandatoryLaps: value })
    );
  }

  return (
    <div className="p-2">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide px-2 py-1">
        Route Order
      </p>
      <div className="flex flex-col gap-0.5">
        {routeElements.map((el, i) => (
          <div
            key={el.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            onClick={() => setSelectedElementId(el.id)}
            className={[
              "flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer text-xs select-none",
              selectedElementId === el.id
                ? "bg-primary/10 ring-1 ring-primary"
                : "hover:bg-base-200",
              dragOverIndex === i ? "ring-2 ring-blue-400" : "",
            ].join(" ")}
          >
            <span className="text-base-content/30 cursor-grab">⠿</span>
            <span className="text-base-content/50 w-4 text-center shrink-0">
              {i + 1}
            </span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: TYPE_COLORS[el.type] }}
            />
            <span className="truncate text-base-content/80">
              {TYPE_LABELS[el.type]}
            </span>
            {el.label && (
              <span className="truncate text-base-content/50 ml-auto text-[10px]">
                {el.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {showLaps && selectedEl && (
        <div className="mt-2 px-2">
          <label className="text-xs text-base-content/60 block mb-1">
            Mandatory on laps (e.g. 1,3)
          </label>
          <input
            type="text"
            value={lapsValue}
            onChange={(e) => handleLapsChange(e.target.value)}
            placeholder="1,3"
            className="input input-xs input-bordered w-full"
          />
        </div>
      )}

      {selectedEl?.type === "buoy" && (
        <div className="mt-2 px-2">
          <label className="text-xs text-base-content/60 block mb-1">Swim side</label>
          <select
            value={getBuoySide(selectedEl.metadata)}
            onChange={(e) => updateElementMeta(
              selectedEl.id,
              setBuoySideInMeta(selectedEl.metadata, e.target.value as BuoySide)
            )}
            className="select select-xs select-bordered w-full"
          >
            <option value="left">{"\u2190"} Left (Red)</option>
            <option value="directional">{"\u2191"} Directional (Yellow)</option>
            <option value="right">{"\u2192"} Right (Green)</option>
          </select>
        </div>
      )}
    </div>
  );
}
