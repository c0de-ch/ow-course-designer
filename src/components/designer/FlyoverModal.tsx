"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCourseStore, CourseData, getRaceTotalKm } from "@/store/courseStore";
import { createFlyoverScene, type FlyoverScene } from "@/lib/flyover/scene";
import { distanceLabel, type DistanceLabel } from "@/lib/flyover/distanceOverlay";
import { buildCameraPath, flyoverDurationSec, FLYOVER_SPEEDS, type CameraFrame } from "@/lib/flyover/cameraPath";
import { getLoadedPublicConfig } from "@/lib/public-config";

interface FlyoverModalProps {
  onClose: () => void;
  courseDataProp?: CourseData;
  /** The course's id: offers "Create video" (rendered on the server) for its owner */
  courseId?: string;
  /** Called with the video's URL once a server render is done */
  onVideoReady?: (url: string) => void;
}

/** A flyover video rendered on the server (GET/POST /api/courses/[id]/flyover/render) */
interface RenderJob {
  id: string;
  status: "queued" | "rendering" | "done" | "failed";
  progress: number;
  speed: number;
  error: string | null;
  url: string | null;
}

export function FlyoverModal({ onClose, courseDataProp, courseId, onVideoReady }: FlyoverModalProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const sceneRef = useRef<FlyoverScene | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "previewing">("idle");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Initializing map...");
  const [job, setJob] = useState<RenderJob | null>(null);
  const isDirty = useCourseStore((s) => s.isDirty);
  const [error, setError] = useState<string | null>(null);
  const framesRef = useRef<CameraFrame[]>([]);
  const abortRef = useRef(false);

  const storeCourseData = useCourseStore((s) => s.courseData);
  const courseData = courseDataProp ?? storeCourseData;
  const mapId = getLoadedPublicConfig().mapId || undefined;

  // Route distance and flyover length (~6 s/100 m, divided by the speed)
  const { totalKm, avgLoopKm } = getRaceTotalKm(courseData);
  const [speed, setSpeed] = useState(1);
  const duration = flyoverDurationSec(totalKm, speed);
  const laps = courseData.laps ?? 1;
  /** The swum-distance counter while the flyover plays (top bar, map, video) */
  const [swum, setSwum] = useState<DistanceLabel | null>(null);
  const showSwum = useCallback((frame: CameraFrame | null) => {
    const label = frame ? distanceLabel(frame, totalKm, laps) : null;
    setSwum(label);
  }, [totalKm, laps]);

  // Initialize map — google.maps is already loaded by DesignerCanvas
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    if (typeof google === "undefined" || !google.maps) {
      setError("Google Maps not loaded. Open the designer first.");
      return;
    }
    mapRef.current = createFlyoverScene(mapDivRef.current, courseData, mapId, (scene) => {
      sceneRef.current = scene;
      setMapReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the camera path (with laps); rebuilt when the speed changes
  useEffect(() => {
    if (!mapReady) return;
    const laps = courseData.laps ?? 1;
    framesRef.current = buildCameraPath(courseData.elements, duration, 30, laps);

    if (framesRef.current.length === 0) {
      setStatusMsg("Need at least 2 route points for flyover");
    } else {
      setStatusMsg(`Ready — ${duration}s, ${laps} lap${laps > 1 ? "s" : ""}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, duration]);

  const moveSwimmer = useCallback((pos: google.maps.LatLngLiteral) => sceneRef.current?.moveSwimmer(pos), []);
  const hideSwimmer = useCallback(() => sceneRef.current?.hideSwimmer(), []);

  const handlePreview = useCallback(async () => {
    const map = mapRef.current;
    if (!map || framesRef.current.length === 0) return;
    abortRef.current = false;
    setStatus("previewing");
    setProgress(0);
    setError(null);
    setStatusMsg("Previewing...");

    const frames = framesRef.current;
    const interval = 1000 / 30;

    // Follow the clock rather than counting frames: when the map is slow to
    // draw, frames are skipped instead of the whole preview slowing down
    const startedAt = performance.now();
    let shown = -1;
    for (;;) {
      if (abortRef.current) break;
      const i = Math.floor((performance.now() - startedAt) / interval);
      if (i >= frames.length) break;
      if (i !== shown) {
        shown = i;
        const f = frames[i];
        try {
          map.moveCamera({
            center: f.center,
            heading: f.heading,
            tilt: f.tilt,
            zoom: f.zoom,
          });
        } catch {
          map.setCenter(f.center);
          map.setZoom(f.zoom);
        }
        moveSwimmer(f.swimmerPos);
        showSwum(f);
        setProgress(i / frames.length);
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    setProgress(1);
    hideSwimmer();
    showSwum(null);
    setStatusMsg("Preview complete");
    if (!abortRef.current) setStatus("idle");
  }, [moveSwimmer, hideSwimmer, showSwum]);

  // The course's latest server render; polled while it is queued or rendering
  useEffect(() => {
    if (!courseId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/flyover/render`);
        const next: RenderJob | null = res.ok ? await res.json() : null;
        if (stopped) return;
        setJob(next);
        if (next?.status === "done" && next.url) onVideoReady?.(next.url);
        if (next && (next.status === "queued" || next.status === "rendering")) timer = setTimeout(poll, 2000);
      } catch {
        if (!stopped) timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  // Re-poll when a new render starts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, job?.id]);

  async function handleCreateVideo() {
    if (!courseId) return;
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/flyover/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      });
      if (!res.ok) throw new Error(`The server refused the video (${res.status})`);
      setJob(await res.json());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const rendering = job?.status === "queued" || job?.status === "rendering";

  function handleClose() {
    abortRef.current = true;
    onClose();
  }

  const hasFrames = framesRef.current.length > 0;
  const busy = status === "previewing";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Flyover</h2>
          <span className="text-xs text-base-content/45 truncate flex-1">
            {statusMsg}
          </span>
          {swum && (
            <span className="flex items-baseline gap-2 tabular-nums" aria-live="off">
              <span className="text-xs text-base-content/55">Swum</span>
              <span className="text-lg font-semibold">{swum.distance}</span>
              <span className="text-xs text-base-content/55">{swum.detail}</span>
            </span>
          )}
          <button onClick={handleClose} className="btn btn-sm btn-ghost btn-circle text-base-content/40 hover:text-base-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Progress bar */}
        {busy && (
          <div className="w-full bg-base-300 h-1.5 shrink-0">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-error/10 text-error text-sm shrink-0">
            {error}
          </div>
        )}

        {/* Map area */}
        <div className="flex-1 min-h-0 relative" style={{ minHeight: "400px" }}>
          <div ref={mapDivRef} className="absolute inset-0" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-200">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}

          {/* Swum distance while playing; server-rendered videos show the same badge */}
          {busy && swum && (
            <div className="absolute bottom-6 left-6 z-10 rounded-2xl bg-[#0C3440]/70 px-4 py-3 text-white pointer-events-none tabular-nums">
              <div className="text-3xl font-bold leading-none">{swum.distance}</div>
              <div className="mt-1.5 text-sm text-white/80">{swum.detail}</div>
            </div>
          )}

          {/* Branding overlay (top-right) — hidden during the preview */}
          {!busy && (courseData.raceLabel || courseData.raceLogo) && (
            <div className="absolute top-3 right-3 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-2 max-w-[200px] pointer-events-none">
              {courseData.raceLogo && (
                <img src={courseData.raceLogo} alt="Race logo" className="max-h-12 max-w-full object-contain mb-1" />
              )}
              {courseData.raceLabel && (
                <div className="text-sm font-semibold text-gray-800 leading-tight">{courseData.raceLabel}</div>
              )}
            </div>
          )}

          {/* Distance + laps overlay — hidden during the preview */}
          {!busy && totalKm > 0 && (
            <div className="absolute bottom-3 right-28 z-10 bg-white/80 backdrop-blur-sm text-gray-900 px-5 py-3 rounded-lg text-right pointer-events-none shadow-lg">
              {(courseData.laps ?? 1) > 1 ? (
                <>
                  <div className="text-2xl font-bold">{totalKm.toFixed(2)} km</div>
                  <div className="text-sm text-gray-600">{avgLoopKm.toFixed(2)} km/lap × {courseData.laps} laps</div>
                </>
              ) : (
                <div className="text-2xl font-bold">{totalKm.toFixed(2)} km</div>
              )}
            </div>
          )}
        </div>

        {/* Server-rendered video */}
        {courseId && job && (
          <div className="flex items-center gap-3 px-6 py-2 border-t border-base-200 text-sm" aria-live="polite">
            {job.status === "queued" && <span className="text-base-content/60">Video queued, it starts shortly. You can close this window.</span>}
            {job.status === "rendering" && (
              <>
                <span className="text-base-content/70 whitespace-nowrap">Creating video… {Math.round(job.progress * 100)}%</span>
                <div className="flex-1 h-1.5 rounded-full bg-base-300 overflow-hidden">
                  <div className="h-full bg-secondary transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                </div>
                <span className="text-xs text-base-content/50 whitespace-nowrap">You can close this window</span>
              </>
            )}
            {job.status === "done" && job.url && (
              <>
                <span className="text-success">Video ready ({job.speed}×)</span>
                <div className="flex-1" />
                <a href={job.url} download className="btn btn-sm btn-success">Download MP4</a>
              </>
            )}
            {job.status === "failed" && <span className="text-error">The video could not be created: {job.error ?? "unknown error"}</span>}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-base-200">
          <label className="flex items-center gap-2 text-sm text-base-content/70">
            Speed
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={busy}
              className="select select-sm w-24"
              aria-label="Flyover speed"
            >
              {FLYOVER_SPEEDS.map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>
          </label>
          <span className="text-sm text-base-content/50">{duration}s</span>
          <div className="flex-1" />

          <button
            onClick={handlePreview}
            disabled={busy || !mapReady || !hasFrames}
            className="btn btn-sm btn-primary"
          >
            {status === "previewing" ? "Previewing..." : "Preview"}
          </button>

          {courseId && (
            <button
              onClick={handleCreateVideo}
              disabled={busy || rendering || !hasFrames || isDirty}
              className="btn btn-sm btn-secondary"
              title={isDirty ? "Wait for the course to be saved: the video shows the saved course" : "Renders an MP4 on the server; you can close this window meanwhile"}
            >
              Create video
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
