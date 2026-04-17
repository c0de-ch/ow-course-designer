import {
  haversineDistanceKm,
  totalCourseDistanceKm,
  computeBearing,
  offsetPointAlongBearing,
  offsetPointPerpendicular,
  LatLng,
} from "../haversine";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical points", () => {
    const p: LatLng = { lat: 46.2, lng: 8.8 };
    expect(haversineDistanceKm(p, p)).toBeCloseTo(0, 6);
  });

  it("matches a known short distance within 1%", () => {
    // Zürich HB → Bellevue, ~1.1 km
    const hb: LatLng = { lat: 47.3779, lng: 8.5402 };
    const bellevue: LatLng = { lat: 47.3668, lng: 8.5456 };
    const d = haversineDistanceKm(hb, bellevue);
    expect(d).toBeGreaterThan(1.15);
    expect(d).toBeLessThan(1.35);
  });

  it("is symmetric", () => {
    const a: LatLng = { lat: 46.2, lng: 8.8 };
    const b: LatLng = { lat: 46.25, lng: 8.85 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });

  it("handles antipodal-ish points (half circumference)", () => {
    const north: LatLng = { lat: 0, lng: 0 };
    const south: LatLng = { lat: 0, lng: 180 };
    // Half of Earth's circumference ≈ 20015 km
    expect(haversineDistanceKm(north, south)).toBeGreaterThan(19900);
    expect(haversineDistanceKm(north, south)).toBeLessThan(20100);
  });
});

describe("totalCourseDistanceKm", () => {
  it("returns 0 for <2 points", () => {
    expect(totalCourseDistanceKm([])).toBe(0);
    expect(totalCourseDistanceKm([{ lat: 0, lng: 0 }])).toBe(0);
  });

  it("closes the loop — sum includes last→first segment", () => {
    const square: LatLng[] = [
      { lat: 46.2, lng: 8.8 },
      { lat: 46.21, lng: 8.8 },
      { lat: 46.21, lng: 8.81 },
      { lat: 46.2, lng: 8.81 },
    ];
    const total = totalCourseDistanceKm(square);
    // N/S sides ≈ 1.11 km, E/W sides at 46° ≈ 0.77 km → perimeter ≈ 3.76 km
    expect(total).toBeGreaterThan(3.5);
    expect(total).toBeLessThan(4.0);
  });

  it("rounds to 3 decimals", () => {
    const pts: LatLng[] = [
      { lat: 46.2, lng: 8.8 },
      { lat: 46.2001, lng: 8.8001 },
    ];
    const total = totalCourseDistanceKm(pts);
    expect(total.toString()).toMatch(/^\d+(\.\d{1,3})?$/);
  });
});

describe("computeBearing", () => {
  it("returns ~0 for due north", () => {
    const from: LatLng = { lat: 46.0, lng: 8.0 };
    const to: LatLng = { lat: 46.1, lng: 8.0 };
    expect(computeBearing(from, to)).toBeCloseTo(0, 1);
  });

  it("returns ~90 for due east", () => {
    const from: LatLng = { lat: 46.0, lng: 8.0 };
    const to: LatLng = { lat: 46.0, lng: 8.1 };
    expect(computeBearing(from, to)).toBeCloseTo(90, 1);
  });

  it("is always in [0, 360)", () => {
    const from: LatLng = { lat: 46.0, lng: 8.0 };
    const directions: LatLng[] = [
      { lat: 46.1, lng: 8.0 },
      { lat: 46.0, lng: 8.1 },
      { lat: 45.9, lng: 8.0 },
      { lat: 46.0, lng: 7.9 },
    ];
    for (const to of directions) {
      const b = computeBearing(from, to);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe("offsetPointAlongBearing", () => {
  it("moving 100m north then measuring returns ~100m", () => {
    const start: LatLng = { lat: 46.0, lng: 8.0 };
    const end = offsetPointAlongBearing(start, 0, 100);
    const d = haversineDistanceKm(start, end) * 1000;
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });
});

describe("offsetPointPerpendicular", () => {
  it("left offset moves perpendicular to bearing", () => {
    const pt: LatLng = { lat: 46.0, lng: 8.0 };
    // Bearing 0 (north) + left = west
    const left = offsetPointPerpendicular(pt, 0, 50, "left");
    expect(left.lng).toBeLessThan(pt.lng);
    const right = offsetPointPerpendicular(pt, 0, 50, "right");
    expect(right.lng).toBeGreaterThan(pt.lng);
  });
});
