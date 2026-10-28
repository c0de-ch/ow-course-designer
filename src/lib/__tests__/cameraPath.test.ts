import { buildCameraPath } from "../flyover/cameraPath";
import { haversineDistanceKm } from "../haversine";
import { CourseElement } from "@/store/courseStore";

const course: CourseElement[] = [
  { id: "s", type: "start", lat: 47.3, lng: 8.55, order: 0 },
  { id: "a", type: "buoy", lat: 47.304, lng: 8.552, order: 1, metadata: '{"side":"left"}' },
  { id: "b", type: "buoy", lat: 47.306, lng: 8.556, order: 2, metadata: '{"side":"left"}' },
  { id: "c", type: "buoy", lat: 47.301, lng: 8.559, order: 3, metadata: '{"side":"left"}' },
  { id: "f", type: "finish_endpoint", lat: 47.299, lng: 8.551, order: 4 },
];

/** Metres the swimmer moves per frame, averaged over each tenth of the flyover */
function speedByTenth(laps: number): number[] {
  const frames = buildCameraPath(course, 40, 30, laps);
  const steps = frames.slice(1).map((f, i) => haversineDistanceKm(frames[i].swimmerPos, f.swimmerPos) * 1000);
  const n = Math.floor(steps.length / 10);
  return Array.from({ length: 10 }, (_, k) => steps.slice(k * n, (k + 1) * n).reduce((a, b) => a + b, 0) / n);
}

describe("buildCameraPath pacing", () => {
  it.each([1, 2])("keeps one speed from start to finish with %i lap(s)", (laps) => {
    const speeds = speedByTenth(laps);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    // corners cut a little distance off, so allow a few percent
    for (const v of speeds) expect(Math.abs(v - mean) / mean).toBeLessThan(0.05);
  });

  it("swims the middle laps faster and the start leg as slow as the first lap", () => {
    const speeds = speedByTenth(4);
    // first tenth: start leg + lap 1; last tenth: lap 4 + finish; the fastest: laps 2-3
    expect(Math.abs(speeds[0] - speeds[9]) / speeds[9]).toBeLessThan(0.05);
    expect(Math.max(...speeds)).toBeGreaterThan(speeds[0] * 2.5);
  });
});
