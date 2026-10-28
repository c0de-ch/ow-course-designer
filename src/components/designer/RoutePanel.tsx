"use client";

import { useRef, useState } from "react";
import { LapEditorModal } from "./LapEditorModal";
import { CoordinateListModal, formatDegMin } from "./CoordinateListModal";
import { IconCheck, IconCopy, IconPin } from "@/components/ui/icons";
import { useCourseStore, CourseElement, ElementType, BuoySide, FINISH_TYPES, getBuoySide, setBuoySideInMeta, parseFreehand, getBuoyNumbers, getBuoyColor, setBuoyColorInMeta, defaultBuoyColor, BUOY_COLORS } from "@/store/courseStore";

const TYPE_LABELS: Record<ElementType, string> = {
  buoy: "Buoy",
  start: "Start",
  finish: "Finish",
  finish_left: "Finish L",
  finish_right: "Finish R",
  finish_endpoint: "Finish",
  finish_funnel_left: "Funnel L",
  finish_funnel_right: "Funnel R",
  gate_left: "Gate L",
  gate_right: "Gate R",
  shore_entry: "Shore",
  rescue_zone: "Rescue",
  feeding_platform: "Feeding",
  freehand: "Drawing",
};

const TYPE_COLORS: Record<ElementType, string> = {
  buoy: "#FBBF24",
  start: "#22C55E",
  finish: "#111111",
  finish_left: "#111111",
  finish_right: "#111111",
  finish_endpoint: "#111111",
  finish_funnel_left: "#EF4444",
  finish_funnel_right: "#EF4444",
  gate_left: "#6366F1",
  gate_right: "#6366F1",
  shore_entry: "#F97316",
  rescue_zone: "#EF4444",
  feeding_platform: "#7C3AED",
  freehand: "#9CA3AF",
};

const LAPS_TYPES: ElementType[] = ["buoy"];
const GATE_TYPES: ElementType[] = ["gate_left", "gate_right"];

function CoordinateLine({ el }: { el: CourseElement }) {
  const [copied, setCopied] = useState(false);
  // 5 decimals is about 1 m, as precise as a buoy is placed
  const text = `${el.lat.toFixed(5)}, ${el.lng.toFixed(5)}`;
  return (
    <div className="ml-8 px-2 py-1">
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0 font-mono text-[11px] leading-snug tabular-nums">
          <div title="Decimal degrees (WGS84)">{text}</div>
          <div className="text-base-content/50" title="Degrees and decimal minutes">
            {formatDegMin(el.lat, "lat")}
            <br />
            {formatDegMin(el.lng, "lng")}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="btn btn-xs btn-ghost btn-square shrink-0"
          title={copied ? "Copied" : "Copy latitude, longitude"}
          aria-label="Copy latitude, longitude"
        >
          {copied ? <IconCheck size={14} className="text-green-600" /> : <IconCopy size={14} />}
        </button>
      </div>
    </div>
  );
}

function BuoyColorPicker({ el, buoys }: { el: CourseElement; buoys: CourseElement[] }) {
  const { updateElementMeta } = useCourseStore();
  const chosen = getBuoyColor(el.metadata);
  const swatch = "w-6 h-6 rounded-full border border-black/20 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
  const ring = (on: boolean) => (on ? " ring-2 ring-offset-1 ring-primary" : "");
  return (
    <div className="ml-8 px-2 py-1">
      <label className="text-xs text-base-content/60 block mb-1">Colour</label>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Buoy colour">
        <button
          onClick={(e) => { e.stopPropagation(); updateElementMeta(el.id, setBuoyColorInMeta(el.metadata, null)); }}
          className={swatch + ring(chosen === null) + " relative overflow-hidden"}
          style={{ background: `linear-gradient(135deg, #EF4444 0 50%, #22C55E 50% 100%)` }}
          title="By swim side: red left, green right, yellow directional"
          role="radio"
          aria-checked={chosen === null}
          aria-label="By swim side"
        />
        {BUOY_COLORS.map((c) => (
          <button
            key={c.value}
            onClick={(e) => { e.stopPropagation(); updateElementMeta(el.id, setBuoyColorInMeta(el.metadata, c.value)); }}
            className={swatch + ring(chosen === c.value)}
            style={{ background: c.value }}
            title={c.name}
            role="radio"
            aria-checked={chosen === c.value}
            aria-label={c.name}
          />
        ))}
      </div>
      {buoys.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            buoys.forEach((b) => {
              if (b.id !== el.id && getBuoyColor(b.metadata) !== chosen) updateElementMeta(b.id, setBuoyColorInMeta(b.metadata, chosen));
            });
          }}
          className="mt-1.5 text-xs text-sky-700 hover:underline"
        >
          Use {chosen ? "this colour" : "colours by side"} for all buoys
        </button>
      )}
    </div>
  );
}

function FreehandSection({ elements, onDelete }: { elements: CourseElement[]; onDelete: (el: CourseElement) => void }) {
  const { updateElementMeta } = useCourseStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(el: CourseElement) {
    const fh = parseFreehand(el.metadata);
    setEditingId(el.id);
    setEditValue(fh.label || "");
  }

  function commitEdit(el: CourseElement) {
    const fh = parseFreehand(el.metadata);
    updateElementMeta(el.id, JSON.stringify({ path: fh.path, label: editValue || undefined, color: fh.color }));
    setEditingId(null);
  }

  return (
    <>
      <p className="side-heading mt-2">
        Drawings
      </p>
      <div className="flex flex-col gap-0.5">
        {elements.map((el, i) => {
          const fh = parseFreehand(el.metadata);
          const isEditing = editingId === el.id;
          return (
            <div key={el.id} className="flex items-center gap-2 px-2 py-1 rounded-lg text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: fh.color }}
              />
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(el)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(el); if (e.key === "Escape") setEditingId(null); }}
                  className="input input-xs input-bordered flex-1 min-w-0"
                  autoFocus
                />
              ) : (
                <span
                  className="truncate text-base-content/80 cursor-pointer hover:underline"
                  onClick={() => startEdit(el)}
                  title="Click to rename"
                >
                  {fh.label || `Drawing ${i + 1}`}
                </span>
              )}
              <button
                onClick={() => onDelete(el)}
                className="ml-auto shrink-0 p-0.5 rounded hover:bg-red-100 text-base-content/30 hover:text-red-500 transition-colors"
                title="Delete drawing"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12M5.3 4V2.7a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1V4M6.5 7v4.5M9.5 7v4.5M3.5 4l.7 8.3a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L12.5 4" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RoutePanel() {
  const {
    courseData,
    selectedElementId,
    setSelectedElementId,
    reorderElements,
    removeElement,
    updateElementMeta,
  } = useCourseStore();

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lapEditorOpen, setLapEditorOpen] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);

  const routeElements = [...courseData.elements]
    .filter((el) => el.type !== "rescue_zone" && el.type !== "freehand")
    .sort((a, b) => a.order - b.order);
  const buoyNumbers = getBuoyNumbers(courseData.elements);

  const rescueElements = courseData.elements.filter(
    (el) => el.type === "rescue_zone"
  );

  const freehandElements = courseData.elements.filter(
    (el) => el.type === "freehand"
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

  function handleDelete(el: CourseElement) {
    // Finish/funnel elements are always deleted as a group
    if (FINISH_TYPES.has(el.type)) {
      const finishEls = courseData.elements.filter((e) => FINISH_TYPES.has(e.type));
      finishEls.forEach((e) => removeElement(e.id));
    } else {
      removeElement(el.id);
    }
    if (selectedElementId === el.id) setSelectedElementId(null);
  }

  function handleLapsChange(value: string) {
    if (!selectedEl) return;
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
    if (!value.trim()) {
      // Remove mandatoryLaps but keep other fields (e.g. side)
      const { mandatoryLaps: _, ...rest } = existingMeta;
      updateElementMeta(
        selectedEl.id,
        Object.keys(rest).length > 0 ? JSON.stringify(rest) : null
      );
      return;
    }
    updateElementMeta(
      selectedEl.id,
      JSON.stringify({ ...existingMeta, mandatoryLaps: value })
    );
  }

  return (
    <div className="p-3 border-t border-base-300">
      <div className="flex flex-col gap-1 mb-3">
        {routeElements.some((el) => el.type === "buoy") && (
          <button
            onClick={() => setLapEditorOpen(true)}
            className="btn btn-sm btn-primary w-full"
            title="Per lap: skip buoys, change their swim side, and set mandatory gates"
          >
            Edit course
          </button>
        )}
        <button
          onClick={() => setCoordsOpen(true)}
          className="btn btn-xs btn-ghost w-full gap-1 text-base-content/70"
          title="GPS coordinates of every buoy and mark, with CSV / GPX export"
        >
          <IconPin size={14} /> GPS coordinates
        </button>
      </div>
      {lapEditorOpen && <LapEditorModal onClose={() => setLapEditorOpen(false)} />}
      {coordsOpen && <CoordinateListModal onClose={() => setCoordsOpen(false)} />}
      <p className="side-heading">
        Route Order
      </p>
      <div className="flex flex-col gap-0.5">
        {routeElements.map((el, i) => {
          const isSelected = selectedElementId === el.id;
          const buoyNo = buoyNumbers.get(el.id);
          const elShowLaps = isSelected && LAPS_TYPES.includes(el.type);
          const elShowSide = isSelected && el.type === "buoy";
          const elShowGate = isSelected && GATE_TYPES.includes(el.type);
          return (
            <div key={el.id}>
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedElementId(el.id)}
                className={[
                  "flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-sm select-none transition-colors",
                  isSelected
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
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: el.type === "buoy"
                      ? getBuoyColor(el.metadata) ?? defaultBuoyColor(getBuoySide(el.metadata))
                      : TYPE_COLORS[el.type],
                  }}
                />
                <span className="truncate text-base-content/80">
                  {el.type === "buoy" ? (buoyNo ? `Buoy ${buoyNo}` : "Directional") : TYPE_LABELS[el.type]}
                </span>
                {el.label && (
                  <span className="truncate text-base-content/50 text-xs">
                    {el.label}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(el); }}
                  className="ml-auto shrink-0 p-0.5 rounded hover:bg-red-100 text-base-content/30 hover:text-red-500 transition-colors"
                  title={FINISH_TYPES.has(el.type) ? "Delete finish group" : `Delete ${TYPE_LABELS[el.type]}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12M5.3 4V2.7a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1V4M6.5 7v4.5M9.5 7v4.5M3.5 4l.7 8.3a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L12.5 4" />
                  </svg>
                </button>
              </div>
              {elShowLaps && (
                <div className="ml-8 px-2 py-1">
                  <label className="text-xs text-base-content/60 block mb-1">
                    Mandatory on laps (e.g. 1,3)
                  </label>
                  <input
                    type="text"
                    value={lapsValue}
                    onChange={(e) => handleLapsChange(e.target.value)}
                    placeholder="1,3"
                    className="input input-sm input-bordered w-full"
                  />
                </div>
              )}
              {elShowGate && (
                <div className="ml-8 px-2 py-1 text-xs text-base-content/60">
                  Set the laps and between which buoys this gate is passed in{" "}
                  <button onClick={() => setLapEditorOpen(true)} className="text-sky-700 hover:underline font-medium">
                    Edit course
                  </button>
                  .
                </div>
              )}
              {isSelected && <CoordinateLine el={el} />}
              {elShowSide && (
                <div className="ml-8 px-2 py-1">
                  <label className="text-xs text-base-content/60 block mb-1">Swim side</label>
                  <select
                    value={getBuoySide(el.metadata)}
                    onChange={(e) => updateElementMeta(
                      el.id,
                      setBuoySideInMeta(el.metadata, e.target.value as BuoySide)
                    )}
                    className="select select-sm select-bordered w-full"
                  >
                    <option value="left">{"\u2190"} Left (turn buoy)</option>
                    <option value="directional">{"\u2191"} Directional (no number)</option>
                    <option value="right">{"\u2192"} Right (turn buoy)</option>
                  </select>
                </div>
              )}
              {elShowSide && <BuoyColorPicker el={el} buoys={routeElements.filter((b) => b.type === "buoy")} />}
            </div>
          );
        })}
      </div>
      {freehandElements.length > 0 && (
        <FreehandSection elements={freehandElements} onDelete={handleDelete} />
      )}
    </div>
  );
}
