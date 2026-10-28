import { buildRouteLines, ROUTE_COLOR } from "../route-geometry";
import { CourseElement } from "@/store/courseStore";

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
    // lap 1 deviates (b3 → b2 shortcut) and is drawn in its own colour
    expect(lines.lapSegments.length).toBeGreaterThan(0);
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
