import { coursePoints } from "../course-bounds";
import type { CourseElement } from "@/store/courseStore";

const el = (over: Partial<CourseElement>): CourseElement => ({
  id: Math.random().toString(36),
  type: "buoy",
  lat: 0,
  lng: 0,
  order: 0,
  ...over,
});

describe("coursePoints", () => {
  it("returns nothing for an empty course", () => {
    expect(coursePoints([])).toEqual([]);
  });

  it("includes marker positions", () => {
    expect(coursePoints([el({ lat: 47.1, lng: 8.5 }), el({ lat: 47.2, lng: 8.6 })])).toEqual([
      { lat: 47.1, lng: 8.5 },
      { lat: 47.2, lng: 8.6 },
    ]);
  });

  it("includes rescue zone vertices and freehand points", () => {
    const points = coursePoints([
      el({ type: "rescue_zone", lat: 1, lng: 1, metadata: JSON.stringify([{ lat: 1, lng: 1 }, { lat: 2, lng: 3 }]) }),
      el({ type: "freehand", lat: 5, lng: 5, metadata: JSON.stringify({ path: [{ lat: 5, lng: 5 }, { lat: 6, lng: 7 }] }) }),
    ]);
    expect(points).toContainEqual({ lat: 2, lng: 3 });
    expect(points).toContainEqual({ lat: 6, lng: 7 });
  });

  it("ignores malformed metadata", () => {
    expect(coursePoints([el({ type: "rescue_zone", lat: 1, lng: 2, metadata: "not json" })])).toEqual([
      { lat: 1, lng: 2 },
    ]);
  });
});
