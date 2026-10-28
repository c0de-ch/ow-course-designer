import {
  CourseElement,
  RoutePoint,
  getBaseLoop,
  getDifferingLaps,
  getFinishLeg,
  getLapLoop,
  getLapRun,
  getStartLeg,
} from "@/store/courseStore";
import { LatLng, arcAroundBuoy, computeBearing } from "@/lib/haversine";

export const ROUTE_COLOR = "#3B82F6";
export const START_FINISH_COLOR = "#F97316";

/** A drawn route line with one direction arrow per [from, to] pair */
export interface RouteLine {
  path: LatLng[];
  color: string;
  arrows: [LatLng, LatLng][];
}

export interface RouteLines {
  /** The standard loop (blue) */
  loop: RouteLine | null;
  /** Segments where a lap leaves the standard loop, in that lap's colour */
  lapSegments: RouteLine[];
  /** Start → first waypoint of lap 1 */
  startLine: RouteLine | null;
  /** Last buoy of the last lap → finish */
  finishLine: RouteLine | null;
}

const pt = (p: { lat: number; lng: number }): LatLng => ({ lat: p.lat, lng: p.lng });

/** Points drawn for a waypoint between prev and next: an arc on its side, or the point itself */
function arcBetween(prev: RoutePoint, p: RoutePoint, next: RoutePoint): LatLng[] {
  if (p.side === "directional" || (prev.id === p.id && next.id === p.id)) return [pt(p)];
  return arcAroundBuoy(pt(p), computeBearing(prev, next), p.side);
}

/** Points drawn for waypoint i of a closed loop */
function arcAt(loop: RoutePoint[], i: number): LatLng[] {
  if (loop.length < 2) return [pt(loop[i])];
  return arcBetween(loop[(i - 1 + loop.length) % loop.length], loop[i], loop[(i + 1) % loop.length]);
}

function segmentKey(a: RoutePoint, b: RoutePoint): string {
  return `${a.id}:${a.side}->${b.id}:${b.side}`;
}

/**
 * Everything the designer and share view draw for the swim route: the standard
 * loop, the per-lap deviations, and the start/finish legs (which follow lap 1's
 * first and the last lap's last buoy, through any start/finish gates).
 */
export function buildRouteLines(elements: CourseElement[], laps: number): RouteLines {
  const base = getBaseLoop(elements, laps);

  let loop: RouteLine | null = null;
  const lapSegments: RouteLine[] = [];
  if (base.length >= 2) {
    loop = {
      path: [...base.flatMap((_, i) => arcAt(base, i)), ...arcAt(base, 0)],
      color: ROUTE_COLOR,
      arrows: base.map((p, i) => [pt(p), pt(base[(i + 1) % base.length])]),
    };

    const baseSegments = new Set(base.map((p, i) => segmentKey(p, base[(i + 1) % base.length])));
    for (const dl of getDifferingLaps(elements, laps)) {
      // The lap as swum, running on into the next lap's first buoy (its own on the last lap)
      const { points, next } = getLapRun(elements, dl.lap, laps);
      if (!next || points.length + (next.id === points[0]?.id ? 0 : 1) < 2) continue;
      const run = [...points, next];
      const following = dl.lap < laps ? getLapRun(elements, dl.lap + 1, laps).points : points;
      // Neighbours of each run point: the next buoy is rounded as the next lap swims it
      const prevOf = (j: number) => (j > 0 ? run[j - 1] : points[points.length - 1]);
      const nextOf = (j: number) => (j < run.length - 1 ? run[j + 1] : following[1] ?? following[0]);
      for (let j = 0; j < run.length - 1; j++) {
        const a = run[j];
        const b = run[j + 1];
        if (a.id === b.id || baseSegments.has(segmentKey(a, b))) continue;
        lapSegments.push({
          path: [...arcBetween(prevOf(j), a, nextOf(j)), ...arcBetween(prevOf(j + 1), b, nextOf(j + 1))],
          color: dl.color,
          arrows: [[pt(a), pt(b)]],
        });
      }
    }
  }

  // Start leg enters the first waypoint's arc as lap 1 swims it
  let startLine: RouteLine | null = null;
  const startLeg = getStartLeg(elements);
  if (startLeg) {
    const lap1 = getLapLoop(elements, 1);
    const entry = arcAt(lap1, 0)[0];
    startLine = {
      path: [...startLeg.slice(0, -1).map(pt), entry],
      color: START_FINISH_COLOR,
      arrows: startLeg.slice(0, -1).map((p, i) => [pt(p), pt(startLeg[i + 1])]),
    };
  }

  // Finish leg leaves the last buoy's arc as the last lap swims it
  let finishLine: RouteLine | null = null;
  const finishLeg = getFinishLeg(elements, laps);
  if (finishLeg) {
    const lastLap = getLapLoop(elements, Math.max(1, laps), Math.max(1, laps));
    const idx = lastLap.findIndex((p) => p.id === finishLeg[0].id);
    const exit = arcAt(lastLap, idx).at(-1)!;
    finishLine = {
      path: [exit, ...finishLeg.slice(1).map(pt)],
      color: START_FINISH_COLOR,
      arrows: finishLeg.slice(0, -1).map((p, i) => [pt(p), pt(finishLeg[i + 1])]),
    };
  }

  return { loop, lapSegments, startLine, finishLine };
}
