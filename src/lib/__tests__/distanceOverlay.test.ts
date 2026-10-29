import { distanceLabel } from "../flyover/distanceOverlay";
import { buildCameraPath } from "../flyover/cameraPath";
import { CourseElement } from "@/store/courseStore";

describe("distanceLabel", () => {
  it("shows the share of the course total and the lap", () => {
    expect(distanceLabel({ fraction: 0.5, lap: 2 }, 3.8, 4)).toEqual({ distance: "1.90 km", detail: "Lap 2 of 4" });
    expect(distanceLabel({ fraction: 0.01, lap: 0 }, 3.8, 4)).toEqual({ distance: "0.04 km", detail: "Start" });
    expect(distanceLabel({ fraction: 1, lap: 1 }, 1.25, 1)).toEqual({ distance: "1.25 km", detail: "1.25 km course" });
  });
});

describe("camera frames", () => {
  const course: CourseElement[] = [
    { id: "s", type: "start", lat: 47.3, lng: 8.55, order: 0 },
    { id: "a", type: "buoy", lat: 47.304, lng: 8.552, order: 1, metadata: '{"side":"left"}' },
    { id: "b", type: "buoy", lat: 47.306, lng: 8.556, order: 2, metadata: '{"side":"left"}' },
    { id: "c", type: "buoy", lat: 47.301, lng: 8.559, order: 3, metadata: '{"side":"left"}' },
    { id: "f", type: "finish_endpoint", lat: 47.299, lng: 8.551, order: 4 },
  ];

  it("count up from the start to the finish and through the laps in order", () => {
    const frames = buildCameraPath(course, 20, 30, 3);
    expect(frames[0].fraction).toBe(0);
    expect(frames[0].lap).toBe(0);
    expect(frames.at(-1)!.fraction).toBeCloseTo(1, 6);
    expect(frames.at(-1)!.lap).toBe(3);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].fraction).toBeGreaterThanOrEqual(frames[i - 1].fraction);
      expect(frames[i].lap).toBeGreaterThanOrEqual(frames[i - 1].lap);
    }
    expect(new Set(frames.map((f) => f.lap))).toEqual(new Set([0, 1, 2, 3]));
  });
});
