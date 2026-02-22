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
