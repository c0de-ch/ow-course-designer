import {
  parseFreehand,
  getBuoySide,
  setBuoySideInMeta,
  getRouteParts,
  getFinishMidpoint,
  getMandatoryLaps,
  getBuoysForLap,
  computeLapLoopKm,
  getRaceTotalKm,
  getDifferingLaps,
  getBuoyLapRule,
  getBuoySideForLap,
  setBuoyLapRuleInMeta,
  getStartLeg,
  getFinishLeg,
  getLapLoop,
  getBaseLoop,
  getGates,
  getGateBetween,
  setGateBetweenInMeta,
  getGateLapProblem,
  computeLapRouteKm,
  getLapRun,
  getBuoyNumbers,
  buoyName,
  getBuoyColor,
  setBuoyColorInMeta,
  START_ID,
  FINISH_ID,
  CourseData,
  CourseElement,
  useCourseStore,
} from "../courseStore";
import { haversineDistanceKm } from "@/lib/haversine";

function buoy(id: string, lat: number, lng: number, order: number, metadata: string | null = null): CourseElement {
  return { id, type: "buoy", lat, lng, order, metadata };
}

describe("parseFreehand", () => {
  it("returns empty path for null metadata", () => {
    expect(parseFreehand(null).path).toEqual([]);
  });

  it("parses object form with path + label + color", () => {
    const meta = JSON.stringify({ path: [{ lat: 1, lng: 2 }], label: "L", color: "#abc" });
    const p = parseFreehand(meta);
    expect(p.path).toEqual([{ lat: 1, lng: 2 }]);
    expect(p.label).toBe("L");
    expect(p.color).toBe("#abc");
  });

  it("parses legacy array form", () => {
    const meta = JSON.stringify([{ lat: 1, lng: 2 }]);
    expect(parseFreehand(meta).path).toEqual([{ lat: 1, lng: 2 }]);
  });

  it("tolerates malformed json", () => {
    expect(parseFreehand("not-json").path).toEqual([]);
  });
});

describe("buoy side helpers", () => {
  it("defaults to directional when no side", () => {
    expect(getBuoySide(null)).toBe("directional");
  });

  it("round-trips side through metadata", () => {
    const m1 = setBuoySideInMeta(null, "left");
    expect(getBuoySide(m1)).toBe("left");
    const m2 = setBuoySideInMeta(m1, "right");
    expect(getBuoySide(m2)).toBe("right");
  });

  it("preserves other metadata keys when setting side", () => {
    const original = JSON.stringify({ mandatoryLaps: "1,2" });
    const updated = setBuoySideInMeta(original, "left");
    const parsed = JSON.parse(updated);
    expect(parsed.mandatoryLaps).toBe("1,2");
    expect(parsed.side).toBe("left");
  });
});

describe("getMandatoryLaps", () => {
  it("returns null for null metadata (all laps)", () => {
    expect(getMandatoryLaps(null)).toBeNull();
  });

  it("parses comma-separated lap list", () => {
    expect(getMandatoryLaps(JSON.stringify({ mandatoryLaps: "1,3" }))).toEqual([1, 3]);
  });

  it("filters NaN entries", () => {
    expect(getMandatoryLaps(JSON.stringify({ mandatoryLaps: "1,x,2" }))).toEqual([1, 2]);
  });
});

describe("getBuoysForLap", () => {
  const buoys: CourseElement[] = [
    buoy("a", 0, 0, 1),
    buoy("b", 0, 0, 2, JSON.stringify({ mandatoryLaps: "1" })),
    buoy("c", 0, 0, 3, JSON.stringify({ mandatoryLaps: "2,3" })),
  ];

  it("includes buoys without restriction", () => {
    expect(getBuoysForLap(buoys, 1).map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("filters by mandatoryLaps", () => {
    expect(getBuoysForLap(buoys, 2).map((b) => b.id)).toEqual(["a", "c"]);
    expect(getBuoysForLap(buoys, 3).map((b) => b.id)).toEqual(["a", "c"]);
  });
});

describe("computeLapLoopKm", () => {
  it("is 0 with fewer than 2 buoys", () => {
    expect(computeLapLoopKm([buoy("a", 0, 0, 1)], 1)).toBe(0);
  });

  it("returns positive for 2+ buoys", () => {
    const b = [buoy("a", 46.2, 8.8, 1), buoy("b", 46.21, 8.81, 2)];
    expect(computeLapLoopKm(b, 1)).toBeGreaterThan(0);
  });
});

describe("getRouteParts", () => {
  it("sorts by order and filters rescue/feeding", () => {
    const els: CourseElement[] = [
      buoy("b2", 0, 0, 2),
      buoy("b1", 0, 0, 1),
      { id: "rz", type: "rescue_zone", lat: 0, lng: 0, order: 0 },
      { id: "s", type: "start", lat: 0, lng: 0, order: 3 },
    ];
    const parts = getRouteParts(els);
    expect(parts.buoys.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(parts.start?.id).toBe("s");
  });
});

describe("getFinishMidpoint", () => {
  it("prefers finish_endpoint when present", () => {
    const parts = getRouteParts([
      { id: "fe", type: "finish_endpoint", lat: 1, lng: 2, order: 1 },
    ]);
    expect(getFinishMidpoint(parts)).toEqual({ lat: 1, lng: 2 });
  });

  it("averages finish_left + finish_right when no endpoint", () => {
    const parts = getRouteParts([
      { id: "fl", type: "finish_left", lat: 0, lng: 0, order: 1 },
      { id: "fr", type: "finish_right", lat: 2, lng: 4, order: 2 },
    ]);
    expect(getFinishMidpoint(parts)).toEqual({ lat: 1, lng: 2 });
  });
});

describe("getRaceTotalKm", () => {
  it("is 0 for empty course", () => {
    const data: CourseData = { name: "x", zoomLevel: 14, elements: [], laps: 1 };
    expect(getRaceTotalKm(data).totalKm).toBe(0);
  });

  it("scales loop distance with laps", () => {
    const data1: CourseData = {
      name: "x",
      zoomLevel: 14,
      laps: 1,
      elements: [buoy("a", 46.2, 8.8, 1), buoy("b", 46.21, 8.81, 2)],
    };
    const data2: CourseData = { ...data1, laps: 2 };
    const one = getRaceTotalKm(data1).totalKm;
    const two = getRaceTotalKm(data2).totalKm;
    expect(two).toBeCloseTo(one * 2, 3);
  });

  it("reports avgLoopKm independent of laps", () => {
    const base: CourseData = {
      name: "x",
      zoomLevel: 14,
      laps: 1,
      elements: [buoy("a", 46.2, 8.8, 1), buoy("b", 46.21, 8.81, 2)],
    };
    const a = getRaceTotalKm(base).avgLoopKm;
    const b = getRaceTotalKm({ ...base, laps: 3 }).avgLoopKm;
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("getDifferingLaps", () => {
  it("returns empty when no buoy has mandatoryLaps", () => {
    const els = [buoy("a", 0, 0, 1), buoy("b", 0, 0, 2)];
    expect(getDifferingLaps(els, 3)).toEqual([]);
  });

  it("lists laps that skip a buoy", () => {
    const els = [
      buoy("a", 0, 0, 1),
      buoy("b", 0, 0, 2, JSON.stringify({ mandatoryLaps: "1" })),
    ];
    const diff = getDifferingLaps(els, 3);
    // lap 2 and lap 3 differ from lap 1 (which has all buoys)
    expect(diff.map((d) => d.lap).sort()).toEqual([2, 3]);
  });
});

describe("updateElementLabel", () => {
  beforeEach(() => {
    useCourseStore.getState().setCourseData({
      name: "Test",
      lakeLabel: null,
      lakeLatLng: null,
      zoomLevel: 14,
      distanceKm: null,
      laps: 1,
      elements: [{ id: "b1", type: "buoy", lat: 47, lng: 8, order: 0, label: null, metadata: null }],
    } as unknown as CourseData);
    useCourseStore.getState().setDirty(false);
  });

  it("sets a trimmed label and marks the course dirty", () => {
    useCourseStore.getState().updateElementLabel("b1", "  Buoy 1 ");
    const s = useCourseStore.getState();
    expect(s.courseData.elements[0].label).toBe("Buoy 1");
    expect(s.isDirty).toBe(true);
  });

  it("clears the label when given an empty string", () => {
    useCourseStore.getState().updateElementLabel("b1", "Exit");
    useCourseStore.getState().updateElementLabel("b1", "   ");
    expect(useCourseStore.getState().courseData.elements[0].label).toBeNull();
  });

  it("can be undone", () => {
    useCourseStore.getState().updateElementLabel("b1", "Exit");
    useCourseStore.getState().undo();
    expect(useCourseStore.getState().courseData.elements[0].label).toBeNull();
  });
});

describe("per-lap buoy rules", () => {
  it("defaults to swimming every buoy as placed", () => {
    expect(getBuoyLapRule(null, 2)).toBe("default");
    expect(getBuoySideForLap(JSON.stringify({ side: "left" }), 2)).toBe("left");
  });

  it("skips a buoy on one lap and keeps the others", () => {
    const meta = setBuoyLapRuleInMeta(JSON.stringify({ side: "left" }), 2, "skip", 3);
    expect(getMandatoryLaps(meta)).toEqual([1, 3]);
    expect(getBuoyLapRule(meta, 2)).toBe("skip");
    expect(getBuoyLapRule(meta, 1)).toBe("default");
    expect(getBuoySide(meta)).toBe("left");
  });

  it("can skip a buoy on every lap", () => {
    let meta: string | null = null;
    for (const lap of [1, 2]) meta = setBuoyLapRuleInMeta(meta, lap, "skip", 2);
    expect(getMandatoryLaps(meta)).toEqual([]);
    expect(getBuoysForLap([buoy("a", 0, 0, 0, meta)], 1)).toEqual([]);
  });

  it("overrides the side on one lap", () => {
    const meta = setBuoyLapRuleInMeta(JSON.stringify({ side: "left" }), 2, "right", 3);
    expect(getBuoySideForLap(meta, 2)).toBe("right");
    expect(getBuoySideForLap(meta, 1)).toBe("left");
    expect(getBuoyLapRule(meta, 2)).toBe("right");
  });

  it("clears the rule when set back to default or to the normal side", () => {
    const base = JSON.stringify({ side: "left" });
    const skipped = setBuoyLapRuleInMeta(base, 2, "skip", 3);
    expect(setBuoyLapRuleInMeta(skipped, 2, "default", 3)).toBe(base);
    const flipped = setBuoyLapRuleInMeta(base, 2, "right", 3);
    expect(setBuoyLapRuleInMeta(flipped, 2, "left", 3)).toBe(base);
    expect(setBuoyLapRuleInMeta(null, 1, "default", 3)).toBeNull();
  });

  it("marks laps with a different side as differing", () => {
    const els = [
      buoy("a", 47.0, 8.0, 0),
      buoy("b", 47.01, 8.0, 1, setBuoyLapRuleInMeta(null, 2, "right", 2)),
      buoy("c", 47.0, 8.01, 2),
    ];
    expect(getDifferingLaps(els, 2).map((d) => d.lap)).toEqual([2]);
  });
});

describe("route with skipped buoys and gates", () => {
  const start: CourseElement = { id: "s", type: "start", lat: 0, lng: -0.01, order: 0 };
  const finish: CourseElement = { id: "f", type: "finish_endpoint", lat: -0.005, lng: -0.01, order: 99 };
  const b1 = buoy("b1", 0, 0, 1);
  const b2 = buoy("b2", 0.01, 0, 2);
  const b3 = buoy("b3", 0.01, 0.01, 3);
  const gate = (meta: Record<string, unknown> | null, order = 10): CourseElement[] => [
    { id: "gl", type: "gate_left", lat: 0.005, lng: -0.004, order, metadata: meta ? JSON.stringify(meta) : null },
    { id: "gr", type: "gate_right", lat: 0.005, lng: -0.002, order: order + 1 },
  ];
  const ids = (pts: { id: string }[] | null) => pts?.map((p) => p.id);

  it("starts at the first buoy swum on lap 1 when buoy 1 is skipped on lap 1", () => {
    const skip1 = buoy("b1", 0, 0, 1, JSON.stringify({ mandatoryLaps: "2" }));
    const els = [start, skip1, b2, b3, finish];
    expect(ids(getStartLeg(els))).toEqual([START_ID, "b2"]);
    expect(ids(getLapLoop(els, 1))).toEqual(["b2", "b3"]);
    expect(ids(getLapLoop(els, 2))).toEqual(["b1", "b2", "b3"]);
  });

  it("leaves a buoy skipped on every lap out of the standard loop", () => {
    const skip1 = buoy("b1", 0, 0, 1, JSON.stringify({ mandatoryLaps: "" }));
    const els = [start, skip1, b2, b3];
    // laps=1: the single lap is the standard loop, nothing drawn as a deviation
    expect(ids(getBaseLoop(els, 1))).toEqual(["b2", "b3"]);
    expect(getDifferingLaps(els, 1)).toEqual([]);
  });

  it("pairs gate posts and takes the midpoint", () => {
    const g = getGates([b1, ...gate(null)]);
    expect(g).toHaveLength(1);
    expect(g[0].id).toBe("gl");
    expect(g[0].lat).toBeCloseTo(0.005);
    expect(g[0].lng).toBeCloseTo(-0.003);
  });

  it("inserts a gate between its two buoys only on its laps", () => {
    const els = [start, b1, b2, b3, ...gate({ between: ["b1", "b2"], mandatoryLaps: "2" })];
    expect(ids(getLapLoop(els, 1))).toEqual(["b1", "b2", "b3"]);
    expect(ids(getLapLoop(els, 2))).toEqual(["b1", "gl", "b2", "b3"]);
    expect(getDifferingLaps(els, 2).map((d) => d.lap)).toEqual([2]);
    expect(computeLapRouteKm(els, 2)).toBeGreaterThan(computeLapRouteKm(els, 1));
  });

  it("puts a gate on every lap into the standard loop", () => {
    const els = [b1, b2, b3, ...gate({ between: ["b1", "b2"] })];
    expect(ids(getBaseLoop(els, 3))).toEqual(["b1", "gl", "b2", "b3"]);
    expect(getDifferingLaps(els, 3)).toEqual([]);
  });

  it("reports a gate whose buoys do not follow each other on a lap", () => {
    const skip2 = buoy("b2", 0.01, 0, 2, JSON.stringify({ mandatoryLaps: "1" }));
    const els = [b1, skip2, b3, ...gate({ between: ["b1", "b2"] })];
    const g = getGates(els)[0];
    expect(getGateLapProblem(els, g, 1, 2)).toBeNull();
    expect(getGateLapProblem(els, g, 2, 2)).toMatch(/do not follow/);
    expect(getGateLapProblem(els, { ...g, from: null }, 1, 2)).toMatch(/Choose/);
  });

  it("routes start and finish legs through start/finish gates", () => {
    const startGate = [b1, b2, b3, start, finish, ...gate({ between: [START_ID, "b1"] })];
    expect(ids(getStartLeg(startGate))).toEqual([START_ID, "gl", "b1"]);
    const finishGate = [b1, b2, b3, start, finish, ...gate({ between: ["b3", FINISH_ID] })];
    expect(ids(getFinishLeg(finishGate, 2))).toEqual(["b3", "gl", FINISH_ID]);
    // a start gate never lands in a lap loop
    expect(ids(getLapLoop(startGate, 1))).toEqual(["b1", "b2", "b3"]);
  });

  it("counts gate detours in the race total", () => {
    const plain = { name: "x", zoomLevel: 14, laps: 2, elements: [start, b1, b2, b3, finish] };
    const gated = { ...plain, elements: [...plain.elements, ...gate({ between: ["b1", "b2"] })] };
    expect(getRaceTotalKm(gated).totalKm).toBeGreaterThan(getRaceTotalKm(plain).totalKm);
  });

  it("stores gate laps with the buoy lap rule and keeps between", () => {
    let meta = setGateBetweenInMeta(null, "b1", "b2");
    meta = setBuoyLapRuleInMeta(meta, 1, "skip", 3);
    expect(getGateBetween(meta)).toEqual({ from: "b1", to: "b2" });
    expect(getMandatoryLaps(meta)).toEqual([2, 3]);
    expect(setGateBetweenInMeta(JSON.stringify({ between: ["b1", "b2"] }), null, null)).toBeNull();
  });
});

describe("buoy numbers and colours", () => {
  const side = (s: string) => JSON.stringify({ side: s });
  const els = [
    buoy("a", 0, 0, 1, side("left")),
    buoy("d", 0, 0.001, 2),
    buoy("b", 0, 0.002, 3, side("right")),
  ];

  it("numbers only the turn buoys, in route order", () => {
    const n = getBuoyNumbers(els);
    expect([...n.entries()]).toEqual([["a", 1], ["b", 2]]);
    expect(buoyName(els[1], n)).toBe("Directional buoy");
    expect(buoyName(els[2], n)).toBe("Buoy 2");
    expect(buoyName({ ...els[2], label: "Pier" }, n)).toBe("Pier");
  });

  it("stores a colour next to the other buoy settings and clears it", () => {
    const meta = setBuoyColorInMeta(side("left"), "#F97316");
    expect(getBuoyColor(meta)).toBe("#F97316");
    expect(getBuoySide(meta)).toBe("left");
    expect(getBuoyColor(setBuoyColorInMeta(meta, null))).toBeNull();
    expect(setBuoyColorInMeta(JSON.stringify({ color: "#F97316" }), null)).toBeNull();
    expect(getBuoyColor(JSON.stringify({ color: "red;x" }))).toBeNull();
  });
});

describe("gate that ends a lap", () => {
  const finish: CourseElement = { id: "f", type: "finish_endpoint", lat: -0.005, lng: -0.01, order: 99 };
  const gate = (meta: Record<string, unknown>): CourseElement[] => [
    { id: "gl", type: "gate_left", lat: 0.005, lng: 0.012, order: 10, metadata: JSON.stringify(meta) },
    { id: "gr", type: "gate_right", lat: 0.005, lng: 0.014, order: 11 },
  ];
  const ids = (pts: { id: string }[]) => pts.map((p) => p.id);

  it("runs from the last buoy through the gate into the next lap's first buoy", () => {
    // lap 2 skips b1, so it starts at b2
    const els = [
      buoy("b1", 0, 0, 1, JSON.stringify({ mandatoryLaps: "1" })),
      buoy("b2", 0.01, 0, 2),
      buoy("b3", 0.01, 0.01, 3),
      ...gate({ between: ["b3", "b2"], mandatoryLaps: "1" }),
      finish,
    ];
    const run = getLapRun(els, 1, 2);
    expect(ids(run.points)).toEqual(["b1", "b2", "b3", "gl"]);
    expect(run.next?.id).toBe("b2");
    expect(getGateLapProblem(els, getGates(els)[0], 1, 2)).toBeNull();
    // the lap's distance ends where lap 2 starts
    const g = getGates(els)[0];
    const expected =
      haversineDistanceKm(els[0], els[1]) + haversineDistanceKm(els[1], els[2]) +
      haversineDistanceKm(els[2], g) + haversineDistanceKm(g, els[1]);
    expect(computeLapRouteKm(els, 1, 2)).toBeCloseTo(expected, 6);
  });

  it("is part of the standard loop when it ends every lap but the last", () => {
    const els = [
      buoy("b1", 0, 0, 1),
      buoy("b2", 0.01, 0, 2),
      buoy("b3", 0.01, 0.01, 3),
      ...gate({ between: ["b3", "b1"], mandatoryLaps: "1,2" }),
      finish,
    ];
    expect(ids(getBaseLoop(els, 3))).toEqual(["b1", "b2", "b3", "gl"]);
    expect(getDifferingLaps(els, 3)).toEqual([]);
  });
});

describe("directional buoy names", () => {
  it("names a directional buoy after the turn buoy around it", () => {
    const els = [
      buoy("d0", 0, 0, 1),
      buoy("a", 0, 0.001, 2, JSON.stringify({ side: "left" })),
      buoy("d1", 0, 0.002, 3),
    ];
    const n = getBuoyNumbers(els);
    expect(buoyName(els[0], n, els)).toBe("Directional before 1");
    expect(buoyName(els[2], n, els)).toBe("Directional after 1");
  });
});
