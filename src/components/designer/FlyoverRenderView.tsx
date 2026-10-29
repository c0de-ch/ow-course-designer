"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { CourseData, getRaceTotalKm } from "@/store/courseStore";
import { getPublicConfig } from "@/lib/public-config";
import { createFlyoverScene } from "@/lib/flyover/scene";
import { buildCameraPath, flyoverDurationSec, type CameraFrame } from "@/lib/flyover/cameraPath";
import { distanceLabel, type DistanceLabel } from "@/lib/flyover/distanceOverlay";
import { RENDER_FPS, RENDER_HEIGHT, RENDER_WIDTH } from "@/lib/flyover/render-config";


/** What the server-side recorder drives (see src/lib/flyover/render.ts) */
export interface FlyoverRenderApi {
  ready: boolean;
  error: string | null;
  frameCount: number;
  /** Shows frame i and resolves once the map has drawn it */
  show: (i: number) => Promise<void>;
}

declare global {
  interface Window {
    __flyover?: FlyoverRenderApi;
  }
}

/**
 * Resolves once the map has drawn the new camera: its "idle" event (fired
 * after every camera change), at most `ms`; then, if tiles are still coming,
 * their "tilesloaded" for up to `tilesMs`; then two painted frames. Waiting
 * for "tilesloaded" alone stalls every frame that needs no new tiles, as that
 * event never fires then.
 */
function settle(map: google.maps.Map, ms: number, tilesMs: number): Promise<void> {
  const once = (event: string, timeout: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        google.maps.event.removeListener(listener);
        clearTimeout(timer);
        resolve();
      };
      const listener = map.addListener(event, done);
      const timer = setTimeout(done, timeout);
    });
  const tiles = once("tilesloaded", ms + tilesMs);
  return once("idle", ms)
    .then(() => Promise.race([tiles, new Promise<void>((r) => setTimeout(r, tilesMs))]))
    .then(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/**
 * The flyover full-screen at video size, stepped frame by frame by the
 * server: no controls, the swum-distance badge drawn as HTML (the recorder
 * takes screenshots, so everything on the page is in the video).
 */
export function FlyoverRenderView({ courseData, speed }: { courseData: CourseData; speed: number }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<DistanceLabel | null>(null);

  useEffect(() => {
    const api: FlyoverRenderApi = { ready: false, error: null, frameCount: 0, show: async () => {} };
    window.__flyover = api;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      api.error = `Google Maps rejected the API key for ${window.location.origin}`;
    };

    getPublicConfig()
      .then(async ({ mapsApiKey, mapId }) => {
        await new Loader({ apiKey: mapsApiKey, version: "weekly" }).load();
        if (!mapDivRef.current) return;
        const { totalKm } = getRaceTotalKm(courseData);
        const laps = courseData.laps ?? 1;
        const frames: CameraFrame[] = buildCameraPath(
          courseData.elements,
          flyoverDurationSec(totalKm, speed),
          RENDER_FPS,
          laps
        );
        createFlyoverScene(mapDivRef.current, courseData, mapId || undefined, (scene) => {
          api.frameCount = frames.length;
          api.show = async (i) => {
            const f = frames[i];
            try {
              scene.map.moveCamera({ center: f.center, heading: f.heading, tilt: f.tilt, zoom: f.zoom });
            } catch {
              scene.map.setCenter(f.center);
              scene.map.setZoom(f.zoom);
            }
            scene.moveSwimmer(f.swimmerPos);
            setLabel(distanceLabel(f, totalKm, laps));
            await settle(scene.map, 1500, 250);
          };
          api.ready = frames.length > 0;
          if (!api.ready) api.error = "The course needs at least 2 route points for a flyover";
        });
      })
      .catch((err: Error) => {
        api.error = err.message || "Google Maps could not be loaded";
      });
  }, [courseData, speed]);

  return (
    <div style={{ position: "fixed", inset: 0, width: RENDER_WIDTH, height: RENDER_HEIGHT, overflow: "hidden", background: "#0C3440" }}>
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
      {label && (
        <div className="absolute bottom-6 left-6 z-10 rounded-2xl bg-[#0C3440]/70 px-4 py-3 text-white pointer-events-none tabular-nums">
          <div className="text-3xl font-bold leading-none">{label.distance}</div>
          <div className="mt-1.5 text-sm text-white/80">{label.detail}</div>
        </div>
      )}
      {(courseData.raceLabel || courseData.raceLogo) && (
        <div className="absolute top-4 right-4 z-10 bg-white/80 rounded-lg p-2 max-w-[220px] pointer-events-none">
          {courseData.raceLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={courseData.raceLogo} alt="" className="max-h-12 max-w-full object-contain mb-1" />
          )}
          {courseData.raceLabel && <div className="text-sm font-semibold text-gray-800 leading-tight">{courseData.raceLabel}</div>}
        </div>
      )}
    </div>
  );
}
