export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // Earth radius in km

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function totalCourseDistanceKm(elements: LatLng[]): number {
  if (elements.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < elements.length; i++) {
    const next = elements[(i + 1) % elements.length];
    total += haversineDistanceKm(elements[i], next);
  }
  return Math.round(total * 1000) / 1000;
}

export function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function offsetPointAlongBearing(
  point: LatLng,
  bearingDeg: number,
  distanceMeters: number
): LatLng {
  const R_METERS = 6371000;
  const d = distanceMeters / R_METERS;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(point.lat);
  const lng1 = toRad(point.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/** Generate 3-point arc around a sided buoy */
export function arcAroundBuoy(
  pt: LatLng,
  bearing: number,
  side: "left" | "right"
): LatLng[] {
  const approach = offsetPointAlongBearing(pt, (bearing + 180) % 360, 15);
  const departure = offsetPointAlongBearing(pt, bearing, 15);
  return [
    offsetPointPerpendicular(approach, bearing, 12, side),
    offsetPointPerpendicular(pt, bearing, 15, side),
    offsetPointPerpendicular(departure, bearing, 12, side),
  ];
}

export function offsetPointPerpendicular(
  point: LatLng,
  bearingDeg: number,
  offsetMeters: number,
  direction: "left" | "right"
): LatLng {
  const perpBearing = direction === "left"
    ? ((bearingDeg - 90 + 360) % 360)
    : ((bearingDeg + 90) % 360);
  const R_METERS = 6371000;
  const d = offsetMeters / R_METERS;
  const brng = toRad(perpBearing);
  const lat1 = toRad(point.lat);
  const lng1 = toRad(point.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}
