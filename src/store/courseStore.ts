import { create } from "zustand";
import { haversineDistanceKm, computeBearing, offsetPointPerpendicular } from "@/lib/haversine";

export type ElementType =
  | "buoy"
  | "start"
  | "finish"
  | "finish_left"
  | "finish_right"
  | "finish_endpoint"
  | "finish_funnel_left"
  | "finish_funnel_right"
  | "gate_left"
  | "gate_right"
  | "shore_entry"
  | "rescue_zone"
  | "feeding_platform"
  | "freehand";

export const FINISH_TYPES: ReadonlySet<ElementType> = new Set([
  "finish", "finish_left", "finish_right",
  "finish_endpoint", "finish_funnel_left", "finish_funnel_right",
]);

export type BuoySide = "left" | "right" | "directional";

export function parseFreehand(metadata?: string | null): { path: {lat: number; lng: number}[]; label?: string; color: string } {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (m && typeof m === "object" && !Array.isArray(m) && Array.isArray(m.path)) {
      return { path: m.path, label: m.label || undefined, color: m.color || "#FFFFFF" };
    }
    if (Array.isArray(m)) {
      return { path: m, color: "#FFFFFF" };
    }
  } catch {}
  return { path: [], color: "#FFFFFF" };
}

export function getBuoySide(metadata?: string | null): BuoySide {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (m?.side === "left" || m?.side === "right") return m.side;
  } catch {}
  return "directional";
}

export function setBuoySideInMeta(metadata: string | null | undefined, side: BuoySide): string {
  let existing: Record<string, unknown> = {};
  try {
    const parsed = metadata ? JSON.parse(metadata) : null;
    if (parsed && !Array.isArray(parsed)) existing = parsed;
  } catch {}
  return JSON.stringify({ ...existing, side });
}

export interface RouteParts {
  shoreEntry: CourseElement | undefined;
  start: CourseElement | undefined;
  finishLeft: CourseElement | undefined;
  finishRight: CourseElement | undefined;
  finishEndpoint: CourseElement | undefined;
  finishFunnelLeft: CourseElement | undefined;
  finishFunnelRight: CourseElement | undefined;
  buoys: CourseElement[];
  gates: CourseElement[];
}

export function getRouteParts(elements: CourseElement[]): RouteParts {
  const sorted = [...elements]
    .filter((el) => el.type !== "rescue_zone" && el.type !== "feeding_platform")
    .sort((a, b) => a.order - b.order);

  const shoreEntry = sorted.find((el) => el.type === "shore_entry");
  const start = sorted.find((el) => el.type === "start");
  const finishEndpoint = sorted.find((el) => el.type === "finish_endpoint");
  const finishLeft = sorted.find((el) => el.type === "finish_left" || el.type === "finish");
  const finishRight = sorted.find((el) => el.type === "finish_right");
  const finishFunnelLeft = sorted.find((el) => el.type === "finish_funnel_left");
  const finishFunnelRight = sorted.find((el) => el.type === "finish_funnel_right");
  const buoys = sorted.filter((el) => el.type === "buoy");
  const gates = sorted.filter((el) => el.type === "gate_left" || el.type === "gate_right");

  return { shoreEntry, start, finishLeft, finishRight, finishEndpoint, finishFunnelLeft, finishFunnelRight, buoys, gates };
}

/** Finish point: new 3-point model returns endpoint directly; legacy model returns midpoint of channel */
export function getFinishMidpoint(parts: RouteParts): { lat: number; lng: number } | undefined {
  if (parts.finishEndpoint) {
    return { lat: parts.finishEndpoint.lat, lng: parts.finishEndpoint.lng };
  }
  if (parts.finishLeft && parts.finishRight) {
    return {
      lat: (parts.finishLeft.lat + parts.finishRight.lat) / 2,
      lng: (parts.finishLeft.lng + parts.finishRight.lng) / 2,
    };
  }
  return parts.finishLeft; // legacy single finish or undefined
}

/** Parse mandatoryLaps from element metadata — returns null if all laps */
export function getMandatoryLaps(metadata?: string | null): number[] | null {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (m?.mandatoryLaps) return String(m.mandatoryLaps).split(",").map(Number).filter((n) => !isNaN(n));
  } catch {}
  return null;
}

/** Get the subset of buoys that are active for a given lap number */
export function getBuoysForLap(buoys: CourseElement[], lap: number): CourseElement[] {
  return buoys.filter((b) => {
    const ml = getMandatoryLaps(b.metadata);
    return ml === null || ml.includes(lap);
  });
}

/** Closed-loop distance (km) for one lap's active buoys */
export function computeLapLoopKm(buoys: CourseElement[], lap: number): number {
  const lapBuoys = getBuoysForLap(buoys, lap);
  if (lapBuoys.length < 2) return 0;
  let km = 0;
  for (let i = 0; i < lapBuoys.length; i++) {
    km += haversineDistanceKm(lapBuoys[i], lapBuoys[(i + 1) % lapBuoys.length]);
  }
  return km;
}

/** Compute actual race total distance accounting for per-lap buoy filtering */
export function getRaceTotalKm(courseData: CourseData): { totalKm: number; avgLoopKm: number } {
  const parts = getRouteParts(courseData.elements);
  const buoys = parts.buoys;
  const laps = courseData.laps ?? 1;

  // Sum each lap's actual closed-loop distance
  let totalLoopKm = 0;
  for (let lap = 1; lap <= laps; lap++) {
    totalLoopKm += computeLapLoopKm(buoys, lap);
  }
  const avgLoopKm = laps > 0 ? totalLoopKm / laps : 0;

  // Entry: shore → start
  let entryKm = 0;
  if (parts.shoreEntry && parts.start) {
    entryKm = haversineDistanceKm(parts.shoreEntry, parts.start);
  }

  // Start → first buoy on lap 1 + last buoy on lap 1 → start (replaces Bn→B1 with Bn→start→B1)
  let firstLapExtraKm = 0;
  if (parts.start && buoys.length >= 1) {
    const lap1Buoys = getBuoysForLap(buoys, 1);
    if (lap1Buoys.length >= 1) {
      const b1 = lap1Buoys[0];
      const bn = lap1Buoys[lap1Buoys.length - 1];
      firstLapExtraKm =
        haversineDistanceKm(bn, parts.start) +
        haversineDistanceKm(parts.start, b1) -
        haversineDistanceKm(bn, b1);
    }
  }

  // Exit: last buoy of last lap → finish
  const finishMid = getFinishMidpoint(parts);
  let exitKm = 0;
  if (finishMid && buoys.length > 0) {
    const lastLapBuoys = getBuoysForLap(buoys, laps);
    const lastBuoy = lastLapBuoys.length > 0
      ? lastLapBuoys[lastLapBuoys.length - 1]
      : buoys[buoys.length - 1];
    exitKm = haversineDistanceKm(lastBuoy, finishMid);
  }

  const totalKm = entryKm + totalLoopKm + firstLapExtraKm + exitKm;
  return { totalKm, avgLoopKm };
}

/** Colors for laps that differ from the standard (all-buoys) route */
export const DIFF_LAP_COLORS = ["#22C55E", "#7C3AED", "#EC4899", "#F97316"];

/**
 * Compute which laps have a different buoy path from the full set.
 * Returns only the laps that differ, each with a distinct color.
 * Laps that use all buoys keep the default blue color and are not listed.
 */
export function getDifferingLaps(elements: CourseElement[], laps: number): { lap: number; color: string }[] {
  const buoys = getRouteParts(elements).buoys;
  if (buoys.length < 2 || laps <= 1) return [];
  const hasVariation = buoys.some((b) => getMandatoryLaps(b.metadata) !== null);
  if (!hasVariation) return [];

  const allBuoyIds = buoys.map((b) => b.id).join(",");
  const result: { lap: number; color: string }[] = [];
  for (let lap = 1; lap <= laps; lap++) {
    const lapBuoys = getBuoysForLap(buoys, lap);
    if (lapBuoys.map((b) => b.id).join(",") !== allBuoyIds) {
      result.push({ lap, color: DIFF_LAP_COLORS[result.length % DIFF_LAP_COLORS.length] });
    }
  }
  return result;
}

export type ActiveTool =
  | "select"
  | "buoy"
  | "start"
  | "finish"
  | "gate"
  | "shore_entry"
  | "rescue_zone"
  | "feeding_platform"
  | "freehand";

export interface CourseElement {
  id: string;
  type: ElementType;
  lat: number;
  lng: number;
  order: number;
  label?: string | null;
  metadata?: string | null;
}

export interface CourseData {
  id?: string;
  name: string;
  lakeLabel?: string | null;
  lakeLatLng?: string | null;
  zoomLevel: number;
  /** One-lap buoy loop distance */
  distanceKm?: number | null;
  /** Start → first buoy distance */
  entryDistKm?: number | null;
  /** First buoy → finish midpoint distance */
  exitDistKm?: number | null;
  /** Extra distance on lap 1 from routing through start (start is skipped on laps 2+) */
  firstLapExtraKm?: number | null;
  elements: CourseElement[];
  laps: number;
  raceLabel?: string | null;
  raceLogo?: string | null;
}

interface GateFirstClick {
  lat: number;
  lng: number;
}

const MAX_UNDO_HISTORY = 50;

interface CourseStore {
  courseData: CourseData;
  activeTool: ActiveTool;
  selectedElementId: string | null;
  isDirty: boolean;
  gateFirstClick: GateFirstClick | null;
  rescueZonePoints: { lat: number; lng: number }[];
  autoSaveEnabled: boolean;
  lastSavedAt: Date | null;
  statusMessage: string | null;
  /** Undo stack — stores previous element snapshots */
  undoStack: CourseElement[][];
  setAutoSaveEnabled: (enabled: boolean) => void;
  setLastSavedAt: (d: Date) => void;
  setStatusMessage: (msg: string | null) => void;

  setActiveTool: (tool: ActiveTool) => void;
  setSelectedElementId: (id: string | null) => void;
  setCourseData: (data: CourseData) => void;
  setDirty: (dirty: boolean) => void;
  setGateFirstClick: (pt: GateFirstClick | null) => void;
  addRescueZonePoint: (pt: { lat: number; lng: number }) => void;
  clearRescueZonePoints: () => void;

  /** Push current elements onto undo stack before a mutation */
  pushUndo: () => void;
  /** Restore the most recent undo snapshot */
  undo: () => void;

  addElement: (el: Omit<CourseElement, "id" | "order">) => void;
  addFinishGroup: (lat: number, lng: number) => void;
  updateElementPosition: (id: string, lat: number, lng: number) => void;
  updateElementMeta: (id: string, meta: string | null) => void;
  removeElement: (id: string) => void;
  reorderElements: (elements: CourseElement[]) => void;
  computeDistance: () => void;
  setLaps: (laps: number) => void;
  setRaceLabel: (label: string | null) => void;
  setRaceLogo: (logo: string | null) => void;
  resetCourse: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const defaultCourseData: CourseData = {
  name: "Untitled Course",
  zoomLevel: 14,
  elements: [],
  laps: 1,
};

export const useCourseStore = create<CourseStore>((set, get) => ({
  courseData: { ...defaultCourseData },
  activeTool: "select",
  selectedElementId: null,
  isDirty: false,
  gateFirstClick: null,
  rescueZonePoints: [],
  autoSaveEnabled: true,
  lastSavedAt: null,
  statusMessage: null,
  undoStack: [],

  setActiveTool: (tool) =>
    set({ activeTool: tool, gateFirstClick: null, rescueZonePoints: [] }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  setCourseData: (data) => set({ courseData: data, isDirty: false, undoStack: [] }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setGateFirstClick: (pt) => set({ gateFirstClick: pt }),

  addRescueZonePoint: (pt) =>
    set((s) => ({ rescueZonePoints: [...s.rescueZonePoints, pt] })),

  clearRescueZonePoints: () => set({ rescueZonePoints: [] }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setLastSavedAt: (d) => set({ lastSavedAt: d }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),

  pushUndo: () => {
    const { courseData, undoStack } = get();
    const snapshot = courseData.elements.map((el) => ({ ...el }));
    const newStack = [...undoStack, snapshot].slice(-MAX_UNDO_HISTORY);
    set({ undoStack: newStack });
  },

  undo: () => {
    const { courseData, undoStack } = get();
    if (undoStack.length === 0) return;
    const newStack = [...undoStack];
    const prev = newStack.pop()!;
    set({
      undoStack: newStack,
      courseData: { ...courseData, elements: prev },
      isDirty: true,
      selectedElementId: null,
    });
    get().computeDistance();
  },

  addElement: (el) => {
    get().pushUndo();
    const { courseData } = get();
    const maxOrder = courseData.elements.reduce(
      (m, e) => Math.max(m, e.order),
      -1
    );
    const newEl: CourseElement = {
      ...el,
      id: generateId(),
      order: maxOrder + 1,
    };
    const allElements = [...courseData.elements, newEl];

    // Ensure finish elements are always at the end of the order
    const nonFinish = allElements.filter((e) => !FINISH_TYPES.has(e.type)).sort((a, b) => a.order - b.order);
    const finish = allElements.filter((e) => FINISH_TYPES.has(e.type)).sort((a, b) => a.order - b.order);
    const elements = [...nonFinish, ...finish].map((e, i) => ({ ...e, order: i }));

    set({
      courseData: { ...courseData, elements },
      isDirty: true,
    });
    get().computeDistance();
  },

  addFinishGroup: (lat, lng) => {
    get().pushUndo();
    const { courseData } = get();
    const buoys = [...courseData.elements]
      .filter((el) => el.type === "buoy")
      .sort((a, b) => a.order - b.order);

    // Compute approach bearing from last buoy, default north if no buoys
    let bearing = 0;
    if (buoys.length > 0) {
      const lastBuoy = buoys[buoys.length - 1];
      bearing = computeBearing(lastBuoy, { lat, lng });
    }

    const funnelLeft = offsetPointPerpendicular({ lat, lng }, bearing, 10, "left");
    const funnelRight = offsetPointPerpendicular({ lat, lng }, bearing, 10, "right");

    const maxOrder = courseData.elements.reduce((m, e) => Math.max(m, e.order), -1);
    const newElements: CourseElement[] = [
      { id: generateId(), type: "finish_endpoint", lat, lng, order: maxOrder + 1, metadata: null },
      { id: generateId(), type: "finish_funnel_left", lat: funnelLeft.lat, lng: funnelLeft.lng, order: maxOrder + 2, metadata: JSON.stringify({ side: "right" }) },
      { id: generateId(), type: "finish_funnel_right", lat: funnelRight.lat, lng: funnelRight.lng, order: maxOrder + 3, metadata: JSON.stringify({ side: "left" }) },
    ];

    const elements = [...courseData.elements, ...newElements];
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  updateElementPosition: (id, lat, lng) => {
    get().pushUndo();
    const { courseData } = get();
    const elements = courseData.elements.map((el) =>
      el.id === id ? { ...el, lat, lng } : el
    );
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  updateElementMeta: (id, meta) => {
    get().pushUndo();
    const { courseData } = get();
    const elements = courseData.elements.map((el) =>
      el.id === id ? { ...el, metadata: meta } : el
    );
    set({ courseData: { ...courseData, elements }, isDirty: true });
  },

  removeElement: (id) => {
    get().pushUndo();
    const { courseData } = get();
    const elements = courseData.elements
      .filter((el) => el.id !== id)
      .map((el, i) => ({ ...el, order: i }));
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  reorderElements: (elements) => {
    get().pushUndo();
    const { courseData } = get();

    // Enforce finish elements always at the end
    const nonFinish = elements.filter((e) => !FINISH_TYPES.has(e.type));
    const finish = elements.filter((e) => FINISH_TYPES.has(e.type));
    const reordered = [...nonFinish, ...finish].map((e, i) => ({ ...e, order: i }));

    set({ courseData: { ...courseData, elements: reordered }, isDirty: true });
    get().computeDistance();
  },

  setLaps: (laps) => {
    const { courseData } = get();
    set({ courseData: { ...courseData, laps }, isDirty: true });
  },

  setRaceLabel: (label) => {
    const { courseData } = get();
    set({ courseData: { ...courseData, raceLabel: label }, isDirty: true });
  },

  setRaceLogo: (logo) => {
    const { courseData } = get();
    set({ courseData: { ...courseData, raceLogo: logo }, isDirty: true });
  },

  computeDistance: () => {
    const { courseData } = get();
    const parts = getRouteParts(courseData.elements);
    const buoys = parts.buoys;

    // Loop distance = closed circuit through buoys only (B1→B2→...→Bn→B1)
    let loopKm = 0;
    if (buoys.length >= 2) {
      for (let i = 0; i < buoys.length; i++) {
        const next = buoys[(i + 1) % buoys.length];
        loopKm += haversineDistanceKm(buoys[i], next);
      }
    }
    loopKm = Math.round(loopKm * 1000) / 1000;

    // First lap extra: start is only visited on lap 1.
    // Lap 1 replaces Bn→B1 with Bn→start→B1, adding extra distance.
    let firstLapExtraKm = 0;
    if (parts.start && buoys.length >= 1) {
      const b1 = buoys[0];
      const bn = buoys[buoys.length - 1];
      firstLapExtraKm =
        haversineDistanceKm(bn, parts.start) +
        haversineDistanceKm(parts.start, b1) -
        haversineDistanceKm(bn, b1);
      firstLapExtraKm = Math.round(firstLapExtraKm * 1000) / 1000;
    }

    // Entry distance: shore_entry → start
    let entryDistKm = 0;
    if (parts.shoreEntry && parts.start) {
      entryDistKm = Math.round(haversineDistanceKm(parts.shoreEntry, parts.start) * 1000) / 1000;
    }

    // Exit distance: last buoy → finish midpoint
    const finishMid = getFinishMidpoint(parts);
    let exitDistKm = 0;
    if (finishMid && buoys.length > 0) {
      const lastBuoy = buoys[buoys.length - 1];
      exitDistKm = Math.round(haversineDistanceKm(lastBuoy, finishMid) * 1000) / 1000;
    }

    set({ courseData: { ...courseData, distanceKm: loopKm, entryDistKm, exitDistKm, firstLapExtraKm } });
  },

  resetCourse: () =>
    set({
      courseData: { ...defaultCourseData, elements: [] },
      activeTool: "select",
      selectedElementId: null,
      isDirty: false,
      gateFirstClick: null,
      rescueZonePoints: [],
      autoSaveEnabled: true,
      lastSavedAt: null,
      statusMessage: null,
      undoStack: [],
    }),
}));
