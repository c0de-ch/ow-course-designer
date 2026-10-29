import type { CameraFrame } from "./cameraPath";

/** What the swum-distance badge shows for one frame */
export interface DistanceLabel {
  /** "1.23 km" */
  distance: string;
  /** "Lap 2 of 4", "Start" or "3.80 km course" */
  detail: string;
}

/**
 * The badge text for a frame. The swum distance is the frame's share of the
 * course total, so the counter ends exactly on the distance the course shows.
 */
export function distanceLabel(frame: Pick<CameraFrame, "fraction" | "lap">, totalKm: number, laps: number): DistanceLabel {
  const swum = Math.min(1, Math.max(0, frame.fraction)) * totalKm;
  const detail =
    laps > 1
      ? frame.lap === 0 ? "Start" : `Lap ${Math.min(frame.lap, laps)} of ${laps}`
      : `${totalKm.toFixed(2)} km course`;
  return { distance: `${swum.toFixed(2)} km`, detail };
}
