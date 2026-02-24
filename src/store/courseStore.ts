import { create } from "zustand";
import { totalCourseDistanceKm } from "@/lib/haversine";

export type ElementType =
  | "buoy"
  | "start"
  | "finish"
  | "gate_left"
  | "gate_right"
  | "shore_entry"
  | "rescue_zone"
  | "feeding_platform";

export type BuoySide = "left" | "right" | "directional";

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

export type ActiveTool =
  | "select"
  | "buoy"
  | "start"
  | "finish"
  | "gate"
  | "shore_entry"
  | "rescue_zone"
  | "feeding_platform";

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
  distanceKm?: number | null;
  elements: CourseElement[];
}

interface GateFirstClick {
  lat: number;
  lng: number;
}

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

  addElement: (el: Omit<CourseElement, "id" | "order">) => void;
  updateElementPosition: (id: string, lat: number, lng: number) => void;
  updateElementMeta: (id: string, meta: string | null) => void;
  removeElement: (id: string) => void;
  reorderElements: (elements: CourseElement[]) => void;
  computeDistance: () => void;
  resetCourse: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const defaultCourseData: CourseData = {
  name: "Untitled Course",
  zoomLevel: 14,
  elements: [],
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

  setActiveTool: (tool) =>
    set({ activeTool: tool, gateFirstClick: null, rescueZonePoints: [] }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  setCourseData: (data) => set({ courseData: data, isDirty: false }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setGateFirstClick: (pt) => set({ gateFirstClick: pt }),

  addRescueZonePoint: (pt) =>
    set((s) => ({ rescueZonePoints: [...s.rescueZonePoints, pt] })),

  clearRescueZonePoints: () => set({ rescueZonePoints: [] }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setLastSavedAt: (d) => set({ lastSavedAt: d }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),

  addElement: (el) => {
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
    const elements = [...courseData.elements, newEl];
    set({
      courseData: { ...courseData, elements },
      isDirty: true,
    });
    get().computeDistance();
  },

  updateElementPosition: (id, lat, lng) => {
    const { courseData } = get();
    const elements = courseData.elements.map((el) =>
      el.id === id ? { ...el, lat, lng } : el
    );
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  updateElementMeta: (id, meta) => {
    const { courseData } = get();
    const elements = courseData.elements.map((el) =>
      el.id === id ? { ...el, metadata: meta } : el
    );
    set({ courseData: { ...courseData, elements }, isDirty: true });
  },

  removeElement: (id) => {
    const { courseData } = get();
    const elements = courseData.elements
      .filter((el) => el.id !== id)
      .map((el, i) => ({ ...el, order: i }));
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  reorderElements: (elements) => {
    const { courseData } = get();
    set({ courseData: { ...courseData, elements }, isDirty: true });
    get().computeDistance();
  },

  computeDistance: () => {
    const { courseData } = get();
    const routeElements = courseData.elements.filter(
      (el) => el.type !== "rescue_zone"
    );
    const distanceKm = totalCourseDistanceKm(routeElements);
    set({ courseData: { ...courseData, distanceKm } });
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
    }),
}));
