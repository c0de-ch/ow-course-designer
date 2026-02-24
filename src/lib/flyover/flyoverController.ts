import { CameraFrame } from "./cameraPath";

type ProgressCallback = (pct: number) => void;
type StatusCallback = (msg: string) => void;

/**
 * Check if the map supports 3D features (tilt/heading) by testing moveCamera.
 * Vector Maps (with a valid mapId) support these; raster maps don't.
 */
function supports3D(map: google.maps.Map): boolean {
  try {
    map.moveCamera({ tilt: 45, heading: 0 });
    const tilt = map.getTilt?.();
    // If tilt is still 0, the map ignored it (raster mode)
    if (tilt === 0 || tilt === undefined) return false;
    // Reset
    map.moveCamera({ tilt: 0, heading: 0 });
    return true;
  } catch {
    return false;
  }
}

export async function previewFlyover(
  map: google.maps.Map,
  frames: CameraFrame[],
  fps: number = 30,
  onProgress?: ProgressCallback,
  onStatus?: StatusCallback
): Promise<void> {
  if (frames.length === 0) {
    onStatus?.("No route points to preview");
    return;
  }

  const is3D = supports3D(map);
  onStatus?.(is3D ? "Previewing 3D flyover..." : "Previewing 2D flyover (no Vector Map ID for 3D)...");

  const interval = 1000 / fps;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (is3D) {
      map.moveCamera({
        center: frame.center,
        heading: frame.heading,
        tilt: frame.tilt,
        zoom: frame.zoom,
      });
    } else {
      // 2D fallback — just pan along the route
      map.setCenter(frame.center);
      map.setZoom(frame.zoom);
    }

    onProgress?.(i / frames.length);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  onProgress?.(1);
  onStatus?.("Preview complete");
}

async function waitForTiles(map: google.maps.Map): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = map.addListener("tilesloaded", () => {
      google.maps.event.removeListener(listener);
      resolve();
    });
    // Fallback timeout in case tiles are already loaded
    setTimeout(resolve, 300);
  });
}

function selectCodec(): string {
  const codecs = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) return codec;
  }
  return "video/webm";
}

export async function recordFlyover(
  map: google.maps.Map,
  frames: CameraFrame[],
  fps: number = 30,
  onProgress?: ProgressCallback,
  onStatus?: StatusCallback
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error("No route points to record.");
  }

  onStatus?.("Preparing recording...");

  const is3D = supports3D(map);

  // Find the canvas for recording
  const canvas = map.getDiv().querySelector("canvas");
  if (!canvas) {
    throw new Error(
      "Cannot access map canvas for recording. " +
      "A valid Vector Map ID (from Google Cloud Console) is required. " +
      "Set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID in your .env file."
    );
  }

  onStatus?.(is3D ? "Recording 3D flyover..." : "Recording 2D flyover...");

  const stream = canvas.captureStream(fps);
  const mimeType = selectCodec();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(100);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (is3D) {
      map.moveCamera({
        center: frame.center,
        heading: frame.heading,
        tilt: frame.tilt,
        zoom: frame.zoom,
      });
    } else {
      map.setCenter(frame.center);
      map.setZoom(frame.zoom);
    }

    await waitForTiles(map);
    await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    onProgress?.((i + 1) / frames.length);

    if (i % 30 === 0) {
      onStatus?.(`Recording... ${Math.round(((i + 1) / frames.length) * 100)}%`);
    }
  }

  onStatus?.("Finalizing video...");
  recorder.stop();
  await stopped;

  const rawBlob = new Blob(chunks, { type: mimeType });

  // Fix WebM duration metadata
  try {
    const { default: fixWebmDuration } = await import("fix-webm-duration");
    const durationMs = (frames.length / fps) * 1000;
    return await fixWebmDuration(rawBlob, durationMs, { logger: false });
  } catch {
    return rawBlob;
  }
}
