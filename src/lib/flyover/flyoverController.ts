import { CameraFrame } from "./cameraPath";

type ProgressCallback = (pct: number) => void;

export async function previewFlyover(
  map: google.maps.Map,
  frames: CameraFrame[],
  fps: number = 30,
  onProgress?: ProgressCallback
): Promise<void> {
  const interval = 1000 / fps;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    map.moveCamera({
      center: frame.center,
      heading: frame.heading,
      tilt: frame.tilt,
      zoom: frame.zoom,
    });

    onProgress?.(i / frames.length);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  onProgress?.(1);
}

async function waitForTiles(map: google.maps.Map): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = map.addListener("tilesloaded", () => {
      google.maps.event.removeListener(listener);
      resolve();
    });
    // Fallback timeout in case tiles are already loaded
    setTimeout(resolve, 200);
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
  onProgress?: ProgressCallback
): Promise<Blob> {
  const canvas = map.getDiv().querySelector("canvas");
  if (!canvas) {
    throw new Error("Cannot access map canvas for recording. Try using a Vector Map ID.");
  }

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

  recorder.start(100); // collect data every 100ms

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    map.moveCamera({
      center: frame.center,
      heading: frame.heading,
      tilt: frame.tilt,
      zoom: frame.zoom,
    });

    await waitForTiles(map);
    await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    onProgress?.((i + 1) / frames.length);
  }

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
