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
  CourseData,
  CourseElement,
  useCourseStore,
} from "../courseStore";

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
