import { haversineDistanceKm, LatLng } from "@/lib/haversine";

export interface CameraFrame {
  center: google.maps.LatLngLiteral;
  heading: number;
  tilt: number;
  zoom: number;
  swimmerPos: google.maps.LatLngLiteral;
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
  let diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
}

export function buildCameraPath(
  routePoints: LatLng[],
  durationSec: number,
  fps: number = 30
): CameraFrame[] {
  if (routePoints.length < 2) return [];

  // Close the loop
  const pts = [...routePoints, routePoints[0]];

  // Compute cumulative distances
  const cumDist: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineDistanceKm(pts[i - 1], pts[i]));
  }
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist === 0) return [];

  const totalFrames = Math.floor(durationSec * fps);
  const rawHeadings: number[] = [];
  const positions: LatLng[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const t = f / totalFrames;
    const targetDist = t * totalDist;

    // Find segment
    let segIdx = 0;
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

    // Forward bearing
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
    const cameraPos = offsetPoint(positions[f], behindBearing, 0.01); // 10m behind

    frames.push({
      center: { lat: cameraPos.lat, lng: cameraPos.lng },
      heading: smoothHeadings[f],
      tilt: TILT,
      zoom: ZOOM,
      swimmerPos: { lat: positions[f].lat, lng: positions[f].lng },
    });
  }

  return frames;
}
