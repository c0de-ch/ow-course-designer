import React from "react";
import { render, act } from "@testing-library/react";
import { FlyoverModal } from "../FlyoverModal";
import type { CourseData } from "@/store/courseStore";

// A fake Maps API that counts the shapes the flyover puts on the map and lets
// the test fire the map's "idle" event, which the real map fires whenever the
// camera settles (again and again during a preview).
const created = { polylines: 0, circles: 0, overlays: 0 };
const listeners: Record<string, (() => void)[]> = {};
const fire = (event: string) => (listeners[event] ?? []).slice().forEach((fn) => fn());

class FakeMap {
  addListener(event: string, fn: () => void) {
    (listeners[event] ??= []).push(fn);
    return { remove: () => { listeners[event] = listeners[event].filter((f) => f !== fn); } };
  }
  fitBounds() {}
  getRenderingType() { return "VECTOR"; }
}
const shape = (kind: keyof typeof created) =>
  class {
    constructor() { created[kind]++; }
    setMap() {}
    setPath() {}
    setVisible() {}
    getVisible() { return false; }
    setCenter() {}
  };

beforeAll(() => {
  Object.defineProperty(globalThis, "google", {
    writable: true,
    value: {
      maps: {
        Map: FakeMap,
        Polyline: shape("polylines"),
        Circle: shape("circles"),
        OverlayView: shape("overlays"),
        LatLng: class { constructor(public lat: number, public lng: number) {} },
        LatLngBounds: class {
          extend() {}
          getNorthEast() { return { lat: () => 47.31, lng: () => 8.56 }; }
          getSouthWest() { return { lat: () => 47.3, lng: () => 8.55 }; }
        },
        RenderingType: { VECTOR: "VECTOR" },
        event: {
          addListenerOnce: (map: FakeMap, event: string, fn: () => void) => {
            const l = map.addListener(event, () => { l.remove(); fn(); });
            return l;
          },
          removeListener: (l: { remove: () => void }) => l.remove(),
        },
      },
    },
  });
});

const course: CourseData = {
  name: "Test",
  zoomLevel: 15,
  laps: 2,
  elements: [
    { id: "s", type: "start", lat: 47.3, lng: 8.55, order: 0 },
    { id: "a", type: "buoy", lat: 47.304, lng: 8.552, order: 1, metadata: '{"side":"left"}' },
    { id: "b", type: "buoy", lat: 47.306, lng: 8.556, order: 2, metadata: '{"side":"left"}' },
    { id: "f", type: "finish_endpoint", lat: 47.299, lng: 8.551, order: 3 },
  ],
} as CourseData;

it("draws the route and the swimmer once, however often the map goes idle", () => {
  render(<FlyoverModal onClose={() => {}} courseDataProp={course} />);
  act(() => fire("idle"));
  const once = { ...created };
  expect(once.circles).toBe(2); // the swimmer: dot + halo

  act(() => { fire("idle"); fire("idle"); });
  expect(created).toEqual(once);
});
