import { parseFreehand, type CourseElement } from "@/store/courseStore";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

function parseVertices(metadata?: string | null): LatLngPoint[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Every point a course occupies on the map: marker positions plus
 * rescue-zone vertices and freehand line points.
 */
export function coursePoints(elements: CourseElement[]): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  for (const el of elements) {
    if (el.type === "rescue_zone") {
      points.push(...parseVertices(el.metadata));
    } else if (el.type === "freehand") {
      points.push(...parseFreehand(el.metadata).path);
    }
    points.push({ lat: el.lat, lng: el.lng });
  }
  return points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
}
