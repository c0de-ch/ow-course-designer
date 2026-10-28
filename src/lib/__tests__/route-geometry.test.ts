import { buildRouteLines, getLegendLaps, ROUTE_COLOR } from "../route-geometry";
import { CourseElement, getDifferingLaps } from "@/store/courseStore";

const el = (id: string, type: CourseElement["type"], lat: number, lng: number, order: number, meta?: object): CourseElement =>
  ({ id, type, lat, lng, order, metadata: meta ? JSON.stringify(meta) : null });

describe("buildRouteLines", () => {
  const start = el("s", "start", 0, -0.01, 0);
  const b2 = el("b2", "buoy", 0.01, 0, 2);
  const b3 = el("b3", "buoy", 0.01, 0.01, 3);

  it("aims the start line at buoy 2 when buoy 1 is skipped on lap 1", () => {
    const b1 = el("b1", "buoy", 0, 0, 1, { mandatoryLaps: "2" });
    const lines = buildRouteLines([start, b1, b2, b3], 2);
    expect(lines.startLine?.arrows).toEqual([[{ lat: 0, lng: -0.01 }, { lat: 0.01, lng: 0 }]]);
    // lap 1 runs b2 → b3 → b1 (where lap 2 starts): all on the standard loop, nothing extra drawn
    expect(lines.lapSegments).toEqual([]);
  });

  it("draws the hand-over from a lap-ending gate into the next lap's first buoy", () => {
    const b1 = el("b1", "buoy", 0, 0, 1, { mandatoryLaps: "1" });
    const gl = el("gl", "gate_left", 0.005, 0.012, 4, { between: ["b3", "b2"], mandatoryLaps: "1" });
    const gr = el("gr", "gate_right", 0.005, 0.014, 5);
    const lines = buildRouteLines([start, b1, b2, b3, gl, gr], 2);
    // lap 1: b1 → b2 → b3 → gate → b2 (lap 2 skips b1), in lap 1's colour
    expect(lines.lapSegments.some((s) => s.arrows[0][1].lat === 0.01 && s.arrows[0][1].lng === 0)).toBe(true);
    expect(lines.lapSegments.every((s) => s.color !== ROUTE_COLOR)).toBe(true);
  });

  it("draws a single-lap course without buoy 1 when it is skipped", () => {
    const b1 = el("b1", "buoy", 0, 0, 1, { mandatoryLaps: "" });
    const lines = buildRouteLines([start, b1, b2, b3], 1);
    expect(lines.loop?.arrows).toHaveLength(2);
    expect(lines.lapSegments).toEqual([]);
  });

  it("routes the loop through a gate", () => {
    const b1 = el("b1", "buoy", 0, 0, 1);
    const gl = el("gl", "gate_left", 0.005, -0.001, 4, { between: ["b1", "b2"] });
    const gr = el("gr", "gate_right", 0.005, 0.001, 5);
    const lines = buildRouteLines([b1, b2, b3, gl, gr], 1);
    expect(lines.loop?.arrows).toHaveLength(4);
    expect(lines.loop?.arrows[0][1].lat).toBeCloseTo(0.005);
  });
});

describe("getLegendLaps", () => {
  const start = el("s", "start", 0, -0.01, 0);
  const b2 = el("b2", "buoy", 0.01, 0, 2);
  const b3 = el("b3", "buoy", 0.01, 0.01, 3);

  it("leaves out a lap that differs but draws nothing of its own", () => {
    // lap 1 skips b1 and runs b2 → b3 → b1 (lap 2's start): all on the blue loop
    const b1 = el("b1", "buoy", 0, 0, 1, { mandatoryLaps: "2" });
    const els = [start, b1, b2, b3];
    expect(getDifferingLaps(els, 2).map((d) => d.lap)).toEqual([1]);
    expect(getLegendLaps(els, 2)).toEqual([]);
  });

  it("lists the laps with a line in their colour", () => {
    // lap 1: b1 → b2 → b3 → gate → b2 (lap 2's start); lap 2: b2 → b3 → b2, off the blue loop
    const b1 = el("b1", "buoy", 0, 0, 1, { mandatoryLaps: "1" });
    const gl = el("gl", "gate_left", 0.005, 0.012, 4, { between: ["b3", "b2"], mandatoryLaps: "1" });
    const gr = el("gr", "gate_right", 0.005, 0.014, 5);
    const els = [start, b1, b2, b3, gl, gr];
    const drawn = new Set(buildRouteLines(els, 2).lapSegments.map((s) => s.lap));
    expect(getLegendLaps(els, 2).map((d) => d.lap)).toEqual([1, 2]);
    expect([...drawn].sort()).toEqual([1, 2]);
  });
});
