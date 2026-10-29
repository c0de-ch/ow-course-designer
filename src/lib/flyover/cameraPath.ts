import { haversineDistanceKm, LatLng } from "@/lib/haversine";
import { CourseElement, getRouteParts, getLapRun, getStartLeg, getFinishLeg } from "@/store/courseStore";

export interface CameraFrame {
  center: google.maps.LatLngLiteral;
  heading: number;
  tilt: number;
  zoom: number;
  swimmerPos: google.maps.LatLngLiteral;
  /** Share of the swim covered at this frame, 0 at the start to 1 at the finish */
  fraction: number;
  /** Lap being swum: 0 on the way from the start to the first buoy, then 1…laps */
  lap: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

function offsetPoint(point: LatLng, bearingDeg: number, distanceKm: number): LatLng {
  const R = 6371;
  const d = distanceKm / R;
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
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
}

/**
 * Build camera path using new route semantics:
 * - Path: start → buoy loop × laps → finish
 * - Gates included only on their mandatory laps
 * - Pacing: constant speed through the entry, first and last lap and exit;
 *   middle laps three times faster
 */
export function buildCameraPath(
  elements: CourseElement[],
  durationSec: number,
  fps: number = 30,
  laps: number = 1
): CameraFrame[] {
  const parts = getRouteParts(elements);
  const buoys = parts.buoys;
  if (buoys.length < 2) return [];

  // Build the full swim path: start → (buoy loop + gates per lap) × laps → finish
  // Track which points belong to which lap for pacing
  const pts: (LatLng & { id?: string })[] = [];
  const lapBoundaries: number[] = []; // indices where each lap starts

  // Entry: start (and any start gate) → first waypoint of lap 1
  const startLeg = getStartLeg(elements);
  if (startLeg) {
    pts.push(...startLeg.slice(0, -1));
  }

  for (let lap = 0; lap < laps; lap++) {
    lapBoundaries.push(pts.length);
    const lapNum = lap + 1;

    // Per-lap filtering: only the buoys and gates swum on this lap, up to
    // where the next lap starts (a gate after the last buoy ends the lap)
    const { points, next } = getLapRun(elements, lapNum, laps);
    if (points.length === 0) continue;

    pts.push(...points);

    // The last lap closes its loop; the others run on into the next lap's first buoy
    if (lapNum === laps && next) pts.push(next);
  }

  // Exit: last buoy of the last lap → (finish gate) → finish (only if finish exists)
  const finishLeg = getFinishLeg(elements, laps);
  if (finishLeg) {
    // Drop the closing point and any gate after the last buoy (we'll go to finish instead)
    pts.pop();
    while (pts.length > 0 && pts[pts.length - 1].id !== finishLeg[0].id) pts.pop();
    pts.push(...finishLeg.slice(1));
  }

  if (pts.length < 2) return [];

  // Compute cumulative distances
  const cumDist: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineDistanceKm(pts[i - 1], pts[i]));
  }
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist === 0) return [];

  // --- Variable pacing: slow-fast-slow ---
  // Compute distance ranges for each lap
  const lapDistRanges: { start: number; end: number }[] = [];
  for (let i = 0; i < lapBoundaries.length; i++) {
    const startIdx = lapBoundaries[i];
    const endIdx = i + 1 < lapBoundaries.length ? lapBoundaries[i + 1] : pts.length - 1;
    lapDistRanges.push({
      start: cumDist[startIdx],
      end: cumDist[endIdx],
    });
  }

  // Include entry/exit in total timing
  const entryDist = lapBoundaries.length > 0 ? cumDist[lapBoundaries[0]] : 0;

  // Time is spent in proportion to distance, at one of two speeds: the
  // entry, the first and the last lap and the exit at the slow speed, the
  // middle laps three times faster. (Weighting a whole lap, or the entry
  // against all laps together, made short legs race and long ones crawl.)
  const SLOW = 3; // time per km, relative
  const FAST = 1;
  const lapPace = (i: number) => (laps <= 2 || i === 0 || i === laps - 1 ? SLOW : FAST);
  const weights = lapDistRanges.map((r, i) => (r.end - r.start) * lapPace(i));
  const entryWeight = entryDist * SLOW;
  const exitDist = totalDist - (lapDistRanges.length > 0 ? lapDistRanges[lapDistRanges.length - 1].end : 0);
  const exitWeight = exitDist * SLOW;

  const totalWeight = entryWeight + weights.reduce((s, w) => s + w, 0) + exitWeight;

  // Build a mapping function: linear time t → distance fraction
  // Segments: [entry, lap1, lap2, ..., lapN, exit]
  interface PaceSegment { distStart: number; distEnd: number; timeFrac: number; }
  const paceSegments: PaceSegment[] = [];

  if (entryDist > 0) {
    paceSegments.push({ distStart: 0, distEnd: entryDist, timeFrac: entryWeight / totalWeight });
  }
  for (let i = 0; i < lapDistRanges.length; i++) {
    paceSegments.push({
      distStart: lapDistRanges[i].start,
      distEnd: lapDistRanges[i].end,
      timeFrac: weights[i] / totalWeight,
    });
  }
  if (exitDist > 0) {
    const lastLapEnd = lapDistRanges.length > 0 ? lapDistRanges[lapDistRanges.length - 1].end : 0;
    paceSegments.push({ distStart: lastLapEnd, distEnd: totalDist, timeFrac: exitWeight / totalWeight });
  }

  // If no segments (shouldn't happen), fall back to linear
  if (paceSegments.length === 0) {
    paceSegments.push({ distStart: 0, distEnd: totalDist, timeFrac: 1 });
  }

  // Compute cumulative time boundaries
  const cumTimeFrac: number[] = [0];
  for (const seg of paceSegments) {
    cumTimeFrac.push(cumTimeFrac[cumTimeFrac.length - 1] + seg.timeFrac);
  }
  // Normalize to exactly 1
  const timeFracTotal = cumTimeFrac[cumTimeFrac.length - 1];
  for (let i = 0; i < cumTimeFrac.length; i++) {
    cumTimeFrac[i] /= timeFracTotal;
  }

  function timeToDistance(t: number): number {
    // Find which pace segment this t falls in
    for (let i = 0; i < paceSegments.length; i++) {
      const tStart = cumTimeFrac[i];
      const tEnd = cumTimeFrac[i + 1];
      if (t <= tEnd || i === paceSegments.length - 1) {
        const localT = tEnd > tStart ? (t - tStart) / (tEnd - tStart) : 0;
        return lerp(paceSegments[i].distStart, paceSegments[i].distEnd, localT);
      }
    }
    return totalDist;
  }

  /** 0 before lap 1 starts, then the lap whose stretch holds this distance */
  function lapAt(dist: number): number {
    if (lapDistRanges.length === 0 || dist < lapDistRanges[0].start) return 0;
    const i = lapDistRanges.findIndex((r) => dist < r.end);
    return i < 0 ? lapDistRanges.length : i + 1;
  }

  // Generate frames
  const totalFrames = Math.floor(durationSec * fps);
  const rawHeadings: number[] = [];
  const positions: LatLng[] = [];
  const distances: number[] = [];

  for (let f = 0; f < totalFrames; f++) {
    // t goes from 0 to 1 inclusive so the last frame reaches the finish
    const t = totalFrames > 1 ? f / (totalFrames - 1) : 0;
    const targetDist = timeToDistance(Math.min(t, 1));
    distances.push(targetDist);

    // Find segment — default to last segment if not found
    let segIdx = cumDist.length - 2;
    for (let i = 1; i < cumDist.length; i++) {
      if (cumDist[i] >= targetDist) {
        segIdx = i - 1;
        break;
      }
    }

    const segStart = cumDist[segIdx];
    const segEnd = cumDist[segIdx + 1];
    const segT = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;

    const pos: LatLng = {
      lat: lerp(pts[segIdx].lat, pts[segIdx + 1].lat, segT),
      lng: lerp(pts[segIdx].lng, pts[segIdx + 1].lng, segT),
    };
    positions.push(pos);

    const bearing = computeBearing(pts[segIdx], pts[segIdx + 1]);
    rawHeadings.push(bearing);
  }

  // Smooth headings with EMA
  const alpha = 0.08;
  const smoothHeadings: number[] = [rawHeadings[0]];
  for (let i = 1; i < rawHeadings.length; i++) {
    const prev = smoothHeadings[i - 1];
    smoothHeadings.push(lerpAngle(prev, rawHeadings[i], alpha));
  }

  // Build frames with chase camera (offset 10m behind)
  const frames: CameraFrame[] = [];
  const TILT = 67.5;
  const ZOOM = 18;

  for (let f = 0; f < totalFrames; f++) {
    const behindBearing = (smoothHeadings[f] + 180) % 360;
    const cameraPos = offsetPoint(positions[f], behindBearing, 0.01);

    frames.push({
      center: { lat: cameraPos.lat, lng: cameraPos.lng },
      heading: smoothHeadings[f],
      tilt: TILT,
      zoom: ZOOM,
      swimmerPos: { lat: positions[f].lat, lng: positions[f].lng },
      fraction: distances[f] / totalDist,
      lap: lapAt(distances[f]),
    });
  }

  return frames;
}
