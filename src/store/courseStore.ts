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

/** Parse mandatoryLaps from element metadata — returns null if all laps, [] if none */
export function getMandatoryLaps(metadata?: string | null): number[] | null {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (m?.mandatoryLaps != null) {
      return String(m.mandatoryLaps).split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    }
  } catch {}
  return null;
}

/** Per-lap swim side overrides, e.g. { 2: "right" } */
export function getLapSides(metadata?: string | null): Record<number, BuoySide> {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (m?.lapSides && typeof m.lapSides === "object") return m.lapSides;
  } catch {}
  return {};
}

/** Swim side of a buoy on a given lap: the lap override, else its normal side */
export function getBuoySideForLap(metadata: string | null | undefined, lap: number): BuoySide {
  return getLapSides(metadata)[lap] ?? getBuoySide(metadata);
}

/** What a buoy does on one lap: normal side, skipped, or a different side */
export type LapRule = "default" | "skip" | BuoySide;

export function getBuoyLapRule(metadata: string | null | undefined, lap: number): LapRule {
  const ml = getMandatoryLaps(metadata);
  if (ml !== null && !ml.includes(lap)) return "skip";
  return getLapSides(metadata)[lap] ?? "default";
}

export function setBuoyLapRuleInMeta(
  metadata: string | null | undefined,
  lap: number,
  rule: LapRule,
  totalLaps: number
): string | null {
  let meta: Record<string, unknown> = {};
  try {
    const parsed = metadata ? JSON.parse(metadata) : null;
    if (parsed && !Array.isArray(parsed)) meta = parsed;
  } catch {}

  const allLaps = Array.from({ length: Math.max(totalLaps, lap) }, (_, i) => i + 1);
  const active = new Set(getMandatoryLaps(metadata) ?? allLaps);
  const lapSides = { ...getLapSides(metadata) };

  if (rule === "skip") {
    active.delete(lap);
    delete lapSides[lap];
  } else {
    active.add(lap);
    if (rule === "default" || rule === getBuoySide(metadata)) delete lapSides[lap];
    else lapSides[lap] = rule;
  }

  // Drop the lap list when every lap is swum, so laps added later are included
  if (allLaps.every((l) => active.has(l))) delete meta.mandatoryLaps;
  else meta.mandatoryLaps = [...active].sort((a, b) => a - b).join(",");

  if (Object.keys(lapSides).length > 0) meta.lapSides = lapSides;
  else delete meta.lapSides;

  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

/** True when some buoy is skipped or swum on a different side on some lap */
export function hasLapVariation(buoys: CourseElement[]): boolean {
  return buoys.some(
    (b) => getMandatoryLaps(b.metadata) !== null || Object.keys(getLapSides(b.metadata)).length > 0
  );
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

/** Endpoint ids a gate can be placed after (start) or before (finish), next to buoy ids */
export const START_ID = "start";
export const FINISH_ID = "finish";

/** An intermediate gate: a gate_left post paired with the gate_right placed after it */
export interface GatePair {
  /** The gate_left element id; the gate's settings live in its metadata */
  id: string;
  left: CourseElement;
  right: CourseElement | undefined;
  /** Midpoint the swimmers pass through */
  lat: number;
  lng: number;
  /** Laps the gate must be passed on; null = every lap */
  laps: number[] | null;
  /** Route waypoints the gate sits between: buoy ids, START_ID or FINISH_ID */
  from: string | null;
  to: string | null;
}

/** Gate pairs in route order: each gate_left takes the first unpaired gate_right after it */
export function getGates(elements: CourseElement[]): GatePair[] {
  const sorted = [...elements].sort((a, b) => a.order - b.order);
  const used = new Set<string>();
  const gates: GatePair[] = [];
  sorted.forEach((el, i) => {
    if (el.type !== "gate_left") return;
    const right = sorted.slice(i + 1).find((r) => r.type === "gate_right" && !used.has(r.id));
    if (right) used.add(right.id);
    const { from, to } = getGateBetween(el.metadata);
    gates.push({
      id: el.id,
      left: el,
      right,
      lat: right ? (el.lat + right.lat) / 2 : el.lat,
      lng: right ? (el.lng + right.lng) / 2 : el.lng,
      laps: getMandatoryLaps(el.metadata),
      from,
      to,
    });
  });
  return gates;
}

export function getGateBetween(metadata?: string | null): { from: string | null; to: string | null } {
  try {
    const m = metadata ? JSON.parse(metadata) : null;
    if (Array.isArray(m?.between) && m.between.length === 2) {
      return { from: m.between[0] || null, to: m.between[1] || null };
    }
  } catch {}
  return { from: null, to: null };
}

export function setGateBetweenInMeta(metadata: string | null | undefined, from: string | null, to: string | null): string | null {
  let meta: Record<string, unknown> = {};
  try {
    const parsed = metadata ? JSON.parse(metadata) : null;
    if (parsed && !Array.isArray(parsed)) meta = parsed;
  } catch {}
  if (from || to) meta.between = [from ?? "", to ?? ""];
  else delete meta.between;
  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

export function isGateActiveOnLap(gate: GatePair, lap: number): boolean {
  return gate.laps === null || gate.laps.includes(lap);
}

/** A waypoint of the swim route: a buoy rounded on a side, or a gate passed through */
export interface RoutePoint {
  id: string;
  kind: "buoy" | "gate";
  lat: number;
  lng: number;
  side: BuoySide;
}

function buoyPoint(b: CourseElement, side: BuoySide): RoutePoint {
  return { id: b.id, kind: "buoy", lat: b.lat, lng: b.lng, side };
}

function gatePoint(g: GatePair): RoutePoint {
  return { id: g.id, kind: "gate", lat: g.lat, lng: g.lng, side: "directional" };
}

/** Gates set between `from` and `to`, nearest to `from` first */
function gatesBetween(gates: GatePair[], from: { id: string; lat: number; lng: number }, toId: string): RoutePoint[] {
  return gates
    .filter((g) => g.from === from.id && g.to === toId)
    .sort((a, b) => haversineDistanceKm(from, a) - haversineDistanceKm(from, b))
    .map(gatePoint);
}

/** Insert gates into a closed buoy loop wherever their from → to pair is consecutive */
function insertGates(seq: RoutePoint[], gates: GatePair[]): RoutePoint[] {
  return seq.flatMap((a, i) => [a, ...gatesBetween(gates, a, seq[(i + 1) % seq.length].id)]);
}

/**
 * One lap's closed loop: the buoys active on that lap (with that lap's side),
 * with the gates mandatory on that lap inserted between their two waypoints.
 */
export function getLapLoop(elements: CourseElement[], lap: number): RoutePoint[] {
  const buoys = getBuoysForLap(getRouteParts(elements).buoys, lap);
  const gates = getGates(elements).filter((g) => isGateActiveOnLap(g, lap));
  return insertGates(buoys.map((b) => buoyPoint(b, getBuoySideForLap(b.metadata, lap))), gates);
}

/**
 * The standard loop drawn in blue: every buoy swum on at least one lap (with its
 * normal side) and the gates mandatory on every lap. Laps whose loop differs
 * from it are drawn in their own colour.
 */
export function getBaseLoop(elements: CourseElement[], laps: number): RoutePoint[] {
  const lapNumbers = Array.from({ length: Math.max(1, laps) }, (_, i) => i + 1);
  const buoys = getRouteParts(elements).buoys.filter((b) => {
    const ml = getMandatoryLaps(b.metadata);
    return ml === null || lapNumbers.some((l) => ml.includes(l));
  });
  const gates = getGates(elements).filter((g) => lapNumbers.every((l) => isGateActiveOnLap(g, l)));
  return insertGates(buoys.map((b) => buoyPoint(b, getBuoySide(b.metadata))), gates);
}

/** Start → (gates) → first waypoint of lap 1; null without a start or a lap-1 buoy */
export function getStartLeg(elements: CourseElement[]): RoutePoint[] | null {
  const start = getRouteParts(elements).start;
  const loop = getLapLoop(elements, 1);
  if (!start || loop.length === 0) return null;
  const gates = getGates(elements).filter((g) => isGateActiveOnLap(g, 1));
  return [
    { id: START_ID, kind: "buoy", lat: start.lat, lng: start.lng, side: "directional" },
    ...gatesBetween(gates, { id: START_ID, lat: start.lat, lng: start.lng }, loop[0].id),
    loop[0],
  ];
}

/** Last buoy of the last lap → (gates) → finish; null without a finish or a buoy */
export function getFinishLeg(elements: CourseElement[], laps: number): RoutePoint[] | null {
  const finish = getFinishMidpoint(getRouteParts(elements));
  const lastLap = Math.max(1, laps);
  const lastBuoy = getLapLoop(elements, lastLap).filter((p) => p.kind === "buoy").at(-1);
  if (!finish || !lastBuoy) return null;
  const gates = getGates(elements).filter((g) => isGateActiveOnLap(g, lastLap));
  return [
    lastBuoy,
    ...gatesBetween(gates, lastBuoy, FINISH_ID),
    { id: FINISH_ID, kind: "buoy", lat: finish.lat, lng: finish.lng, side: "directional" },
  ];
}

function pathKm(points: { lat: number; lng: number }[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineDistanceKm(points[i - 1], points[i]);
  return km;
}

/** Closed-loop distance (km) of one lap, gates included */
export function computeLapRouteKm(elements: CourseElement[], lap: number): number {
  const loop = getLapLoop(elements, lap);
  if (loop.length < 2) return 0;
  return pathKm([...loop, loop[0]]);
}

/**
 * Why a gate is not passed on a lap where it is mandatory, or null when it is:
 * its two waypoints must both be swum on that lap, one right after the other.
 */
export function getGateLapProblem(elements: CourseElement[], gate: GatePair, lap: number, laps: number): string | null {
  if (!gate.from || !gate.to) return "Choose between which marks the gate is";
  if (gate.from === START_ID) {
    if (lap !== 1) return "The start is only swum on lap 1";
    return getStartLeg(elements)?.some((p) => p.id === gate.id) ? null : "Not right before the first buoy of lap 1";
  }
  if (gate.to === FINISH_ID) {
    if (lap !== Math.max(1, laps)) return "The finish is only swum after the last lap";
    return getFinishLeg(elements, laps)?.some((p) => p.id === gate.id) ? null : "Not right after the last buoy of the last lap";
  }
  return getLapLoop(elements, lap).some((p) => p.id === gate.id)
    ? null
    : "The two buoys do not follow each other on this lap";
}

/** Compute actual race total distance accounting for per-lap buoy filtering and gates */
export function getRaceTotalKm(courseData: CourseData): { totalKm: number; avgLoopKm: number } {
  const { elements } = courseData;
  const parts = getRouteParts(elements);
  const laps = courseData.laps ?? 1;

  // Sum each lap's actual closed-loop distance
  let totalLoopKm = 0;
  for (let lap = 1; lap <= laps; lap++) {
    totalLoopKm += computeLapRouteKm(elements, lap);
  }
  const avgLoopKm = laps > 0 ? totalLoopKm / laps : 0;

  // Entry: shore → start
  let entryKm = 0;
  if (parts.shoreEntry && parts.start) {
    entryKm = haversineDistanceKm(parts.shoreEntry, parts.start);
  }

  // Lap 1 goes through the start: its closing leg last → first becomes last → start → (gates) → first
  let firstLapExtraKm = 0;
  const startLeg = getStartLeg(elements);
  if (parts.start && startLeg) {
    const loop = getLapLoop(elements, 1);
    const last = loop[loop.length - 1];
    firstLapExtraKm =
      haversineDistanceKm(last, parts.start) +
      pathKm(startLeg) -
      haversineDistanceKm(last, loop[0]);
  }

  // Exit: last buoy of last lap → (gates) → finish
  const finishLeg = getFinishLeg(elements, laps);
  const exitKm = finishLeg ? pathKm(finishLeg) : 0;

  const totalKm = entryKm + totalLoopKm + firstLapExtraKm + exitKm;
  return { totalKm, avgLoopKm };
}

/** Colors for laps that differ from the standard (all-buoys) route */
export const DIFF_LAP_COLORS = ["#22C55E", "#7C3AED", "#EC4899", "#F97316"];

function loopKey(loop: RoutePoint[]): string {
  return loop.map((p) => `${p.id}:${p.side}`).join(",");
}

/**
 * Compute which laps have a different path from the standard loop (getBaseLoop):
 * a buoy skipped or swum on another side, or a gate passed on some laps only.
 * Returns only the laps that differ, each with a distinct color.
 */
export function getDifferingLaps(elements: CourseElement[], laps: number): { lap: number; color: string }[] {
  const base = getBaseLoop(elements, laps);
  if (base.length < 2) return [];
  const baseKey = loopKey(base);
  const result: { lap: number; color: string }[] = [];
  for (let lap = 1; lap <= laps; lap++) {
    if (loopKey(getLapLoop(elements, lap)) !== baseKey) {
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
  setBuoyLapRule: (id: string, lap: number, rule: LapRule) => void;
  /** Set between which route waypoints a gate (its gate_left id) is passed */
  setGateBetween: (id: string, from: string | null, to: string | null) => void;
  updateElementLabel: (id: string, label: string | null) => void;
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

  setBuoyLapRule: (id, lap, rule) => {
    const { courseData } = get();
    const el = courseData.elements.find((e) => e.id === id);
    if (!el) return;
    get().updateElementMeta(id, setBuoyLapRuleInMeta(el.metadata, lap, rule, courseData.laps ?? 1));
  },

  setGateBetween: (id, from, to) => {
    const el = get().courseData.elements.find((e) => e.id === id);
    if (!el) return;
    get().updateElementMeta(id, setGateBetweenInMeta(el.metadata, from, to));
  },

  updateElementLabel: (id, label) => {
    get().pushUndo();
    const { courseData } = get();
    const trimmed = label?.trim() || null;
    const elements = courseData.elements.map((el) =>
      el.id === id ? { ...el, label: trimmed } : el
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
