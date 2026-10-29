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

/** Draws the badge in the bottom-left corner of a video frame */
export function drawDistanceBadge(ctx: CanvasRenderingContext2D, label: DistanceLabel, width: number, height: number) {
  const s = Math.max(0.5, Math.min(width, height) / 720);
  const pad = 18 * s;
  const big = Math.round(44 * s);
  const small = Math.round(20 * s);
  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  ctx.save();
  ctx.font = `700 ${big}px ${font}`;
  const w1 = ctx.measureText(label.distance).width;
  ctx.font = `500 ${small}px ${font}`;
  const w2 = ctx.measureText(label.detail).width;
  const boxW = Math.max(w1, w2) + pad * 2;
  const boxH = big + small + pad * 2 + 6 * s;
  const x = 24 * s;
  const y = height - boxH - 24 * s;

  ctx.fillStyle = "rgba(12, 52, 64, 0.72)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, 16 * s);
  else ctx.rect(x, y, boxW, boxH);
  ctx.fill();

  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 ${big}px ${font}`;
  ctx.fillText(label.distance, x + pad, y + pad);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = `500 ${small}px ${font}`;
  ctx.fillText(label.detail, x + pad, y + pad + big + 6 * s);
  ctx.restore();
}

/**
 * A stream of the map canvas with the badge drawn over every frame, for
 * MediaRecorder: the map canvas is played into a video element and copied
 * onto a second canvas together with the badge. `getLabel` is read on every
 * frame. Falls back to the map canvas alone when a 2D canvas is unavailable.
 */
export async function overlayStream(
  mapCanvas: HTMLCanvasElement,
  fps: number,
  getLabel: () => DistanceLabel | null
): Promise<{ stream: MediaStream; stop: () => void }> {
  const source = mapCanvas.captureStream(fps);
  const out = document.createElement("canvas");
  out.width = mapCanvas.width;
  out.height = mapCanvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return { stream: source, stop: () => source.getTracks().forEach((t) => t.stop()) };

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source;
  await video.play();

  let raf = 0;
  const draw = () => {
    ctx.drawImage(video, 0, 0, out.width, out.height);
    const label = getLabel();
    if (label) drawDistanceBadge(ctx, label, out.width, out.height);
    raf = requestAnimationFrame(draw);
  };
  draw();

  const stream = out.captureStream(fps);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      source.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
