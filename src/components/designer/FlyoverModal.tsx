"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCourseStore } from "@/store/courseStore";
import { getMarkerSvg } from "./markers/markerIcons";
import { buildCameraPath, type CameraFrame } from "@/lib/flyover/cameraPath";

const SWIMMER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="16" cy="4" r="2" fill="#3B82F6" stroke="#3B82F6"/>
  <path d="M2 20c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0 3.5 1 5 0" stroke="#3B82F6" stroke-width="2.5"/>
  <path d="M6 16l2-2 4.5-1.5L15 10" stroke="#3B82F6" stroke-width="2"/>
  <path d="M11.5 12.5L9 15" stroke="#3B82F6" stroke-width="2"/>
</svg>`;

interface FlyoverModalProps {
  onClose: () => void;
}

export function FlyoverModal({ onClose }: FlyoverModalProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [duration, setDuration] = useState(20);
  const [status, setStatus] = useState<"idle" | "previewing" | "recording" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Initializing map...");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const framesRef = useRef<CameraFrame[]>([]);
  const abortRef = useRef(false);
  const swimmerOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const swimmerDivRef = useRef<HTMLDivElement | null>(null);
  const swimmerPosRef = useRef<google.maps.LatLng | null>(null);

  const { courseData } = useCourseStore();
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;

  // Initialize map — google.maps is already loaded by DesignerCanvas
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    if (typeof google === "undefined" || !google.maps) {
      setError("Google Maps not loaded. Open the designer first.");
      return;
    }

    // All visible elements (for markers) and route elements (for polyline/path)
    const visibleElements = courseData.elements
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order);
    const routeElements = visibleElements.filter((el) => el.type !== "feeding_platform");

    // Center on start element, or first element, or lake
    const startEl = routeElements.find((el) => el.type === "start");
    const center = startEl
      ? { lat: startEl.lat, lng: startEl.lng }
      : routeElements.length > 0
        ? { lat: routeElements[0].lat, lng: routeElements[0].lng }
        : courseData.lakeLatLng
          ? (() => {
              const [lat, lng] = courseData.lakeLatLng!.split(",").map(Number);
              return { lat, lng };
            })()
          : { lat: 46.8182, lng: 8.2275 };

    const opts: google.maps.MapOptions = {
      center,
      zoom: courseData.zoomLevel ?? 14,
      mapTypeId: "satellite",
      disableDefaultUI: true,
    };
    if (mapId && mapId.length > 5) {
      opts.mapId = mapId;
    }

    const map = new google.maps.Map(mapDivRef.current, opts);
    mapRef.current = map;

    // Fit bounds to all visible elements with 500m padding
    if (visibleElements.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      visibleElements.forEach((el) => bounds.extend({ lat: el.lat, lng: el.lng }));

      // Extend bounds by ~500m on each side
      // 500m ≈ 0.0045° latitude, longitude varies by cos(lat)
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latPad = 0.0045; // ~500m
      const lngPad = 0.0045 / Math.cos((ne.lat() + sw.lat()) / 2 * Math.PI / 180);
      bounds.extend({ lat: ne.lat() + latPad, lng: ne.lng() + lngPad });
      bounds.extend({ lat: sw.lat() - latPad, lng: sw.lng() - lngPad });

      map.fitBounds(bounds);
    }

    // Wait for map to be fully loaded
    map.addListener("idle", () => {
      setMapReady(true);

      // Draw route polyline
      if (routeElements.length >= 2) {
        const path = routeElements.map((el) => ({ lat: el.lat, lng: el.lng }));
        path.push(path[0]);
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });
      }

      // Draw markers (all visible elements including feeding platforms)
      visibleElements.forEach((el) => {
        const svgHtml = getMarkerSvg(el.type, false, el.metadata);
        const overlay = new google.maps.OverlayView();
        overlay.onAdd = function () {
          const div = document.createElement("div");
          div.style.cssText =
            "position:absolute;transform:translate(-50%,-50%);pointer-events:none;";
          div.innerHTML = svgHtml;
          this.getPanes()!.overlayLayer.appendChild(div);
          (this as unknown as { _div: HTMLDivElement })._div = div;
        };
        overlay.draw = function () {
          const pt = this.getProjection().fromLatLngToDivPixel(
            new google.maps.LatLng(el.lat, el.lng)
          );
          const div = (this as unknown as { _div: HTMLDivElement })._div;
          if (pt && div) {
            div.style.left = `${pt.x}px`;
            div.style.top = `${pt.y}px`;
          }
        };
        overlay.onRemove = function () {
          const div = (this as unknown as { _div: HTMLDivElement })._div;
          div?.parentNode?.removeChild(div);
        };
        overlay.setMap(map);
      });

      // Create swimmer overlay
      const swimmerOverlay = new google.maps.OverlayView();
      swimmerOverlay.onAdd = function () {
        const div = document.createElement("div");
        div.style.cssText =
          "position:absolute;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6));display:none;";
        div.innerHTML = SWIMMER_SVG;
        this.getPanes()!.overlayLayer.appendChild(div);
        swimmerDivRef.current = div;
      };
      swimmerOverlay.draw = function () {
        if (!swimmerPosRef.current || !swimmerDivRef.current) return;
        const pt = this.getProjection().fromLatLngToDivPixel(swimmerPosRef.current);
        if (pt) {
          swimmerDivRef.current.style.left = `${pt.x}px`;
          swimmerDivRef.current.style.top = `${pt.y}px`;
        }
      };
      swimmerOverlay.onRemove = function () {
        swimmerDivRef.current?.parentNode?.removeChild(swimmerDivRef.current);
        swimmerDivRef.current = null;
      };
      swimmerOverlay.setMap(map);
      swimmerOverlayRef.current = swimmerOverlay;

      // Build camera path (with laps)
      const routePts = routeElements.map((el) => ({
        lat: el.lat,
        lng: el.lng,
      }));
      const laps = courseData.laps ?? 1;
      framesRef.current = buildCameraPath(routePts, duration, 30, laps);

      if (framesRef.current.length === 0) {
        setStatusMsg("Need at least 2 route points for flyover");
      } else {
        setStatusMsg(`Ready — ${duration}s, ${laps} lap${laps > 1 ? "s" : ""}`);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild frames when duration changes
  useEffect(() => {
    if (!mapReady) return;
    const routeEls = courseData.elements
      .filter((el) => el.type !== "rescue_zone" && el.type !== "feeding_platform")
      .sort((a, b) => a.order - b.order);
    const routePts = routeEls.map((el) => ({ lat: el.lat, lng: el.lng }));
    const laps = courseData.laps ?? 1;
    framesRef.current = buildCameraPath(routePts, duration, 30, laps);
    if (framesRef.current.length > 0) {
      setStatusMsg(`Ready — ${duration}s, ${laps} lap${laps > 1 ? "s" : ""}`);
    }
  }, [duration, mapReady, courseData.elements, courseData.laps]);

  const moveSwimmer = useCallback((pos: google.maps.LatLngLiteral) => {
    swimmerPosRef.current = new google.maps.LatLng(pos.lat, pos.lng);
    if (swimmerDivRef.current) {
      swimmerDivRef.current.style.display = "block";
    }
    swimmerOverlayRef.current?.draw();
  }, []);

  const hideSwimmer = useCallback(() => {
    if (swimmerDivRef.current) {
      swimmerDivRef.current.style.display = "none";
    }
  }, []);

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

    for (let i = 0; i < frames.length; i++) {
      if (abortRef.current) break;
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
      setProgress(i / frames.length);
      await new Promise((r) => setTimeout(r, interval));
    }
    setProgress(1);
    hideSwimmer();
    setStatusMsg("Preview complete");
    if (!abortRef.current) setStatus("idle");
  }, [moveSwimmer, hideSwimmer]);

  const handleRecord = useCallback(async () => {
    const map = mapRef.current;
    if (!map || framesRef.current.length === 0) return;
    setStatus("recording");
    setProgress(0);
    setError(null);
    setStatusMsg("Preparing recording...");

    const canvas = map.getDiv().querySelector("canvas");
    if (!canvas) {
      setError(
        "Cannot access map canvas. Recording requires a Vector Map ID. " +
          "Preview still works — use screen recording software to capture it."
      );
      setStatus("idle");
      return;
    }

    try {
      const fps = 30;
      const frames = framesRef.current;
      const stream = canvas.captureStream(fps);

      const codecs = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mimeType =
        codecs.find((c) => MediaRecorder.isTypeSupported(c)) ?? "video/webm";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<void>((r) => {
        recorder.onstop = () => r();
      });

      recorder.start(100);
      setStatusMsg("Recording...");

      for (let i = 0; i < frames.length; i++) {
        if (abortRef.current) break;
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

        // Wait for tiles
        await new Promise<void>((resolve) => {
          const listener = map.addListener("tilesloaded", () => {
            google.maps.event.removeListener(listener);
            resolve();
          });
          setTimeout(resolve, 300);
        });

        await new Promise((r) => setTimeout(r, 1000 / fps));
        setProgress((i + 1) / frames.length);

        if (i % 30 === 0) {
          setStatusMsg(
            `Recording... ${Math.round(((i + 1) / frames.length) * 100)}%`
          );
        }
      }

      hideSwimmer();
      setStatusMsg("Finalizing video...");
      recorder.stop();
      await stopped;

      const rawBlob = new Blob(chunks, { type: mimeType });

      let finalBlob = rawBlob;
      try {
        const { default: fixWebmDuration } = await import(
          "fix-webm-duration"
        );
        const durationMs = (frames.length / fps) * 1000;
        finalBlob = await fixWebmDuration(rawBlob, durationMs, {
          logger: false,
        });
      } catch {
        // use raw blob
      }

      const url = URL.createObjectURL(finalBlob);
      setVideoUrl(url);
      setStatus("done");
      setStatusMsg("Recording complete!");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  }, [moveSwimmer, hideSwimmer]);

  function handleDownload() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}_flyover.webm`;
    a.click();
  }

  function handleClose() {
    abortRef.current = true;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    onClose();
  }

  const hasFrames = framesRef.current.length > 0;
  const busy = status === "previewing" || status === "recording";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-lg shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
          <h2 className="text-lg font-bold">Flyover</h2>
          <span className="text-xs text-base-content/50 truncate flex-1">
            {statusMsg}
          </span>
          <button onClick={handleClose} className="btn btn-sm btn-ghost">
            Close
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

          {/* Branding overlay (top-left) */}
          {(courseData.raceLabel || courseData.raceLogo) && (
            <div className="absolute top-3 left-3 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-2 max-w-[200px] pointer-events-none">
              {courseData.raceLogo && (
                <img src={courseData.raceLogo} alt="Race logo" className="max-h-12 max-w-full object-contain mb-1" />
              )}
              {courseData.raceLabel && (
                <div className="text-sm font-semibold text-gray-800 leading-tight">{courseData.raceLabel}</div>
              )}
            </div>
          )}

          {/* Distance + laps overlay (bottom-right) */}
          {courseData.distanceKm != null && courseData.distanceKm > 0 && (
            <div className="absolute bottom-3 right-3 z-10 bg-black/70 text-white px-4 py-2 rounded-lg text-right pointer-events-none">
              {(courseData.laps ?? 1) > 1 ? (
                <>
                  <div className="text-lg font-bold">{(courseData.distanceKm * (courseData.laps ?? 1)).toFixed(2)} km</div>
                  <div className="text-xs opacity-80">{courseData.distanceKm.toFixed(2)} km × {courseData.laps} laps</div>
                </>
              ) : (
                <div className="text-lg font-bold">{courseData.distanceKm.toFixed(2)} km</div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-base-300">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Duration:</label>
            <select
              className="select select-sm"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={busy}
            >
              <option value={10}>10s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={handlePreview}
            disabled={busy || !mapReady || !hasFrames}
            className="btn btn-sm btn-primary"
          >
            {status === "previewing" ? "Previewing..." : "Preview"}
          </button>

          <button
            onClick={handleRecord}
            disabled={busy || !mapReady || !hasFrames}
            className="btn btn-sm btn-secondary"
          >
            {status === "recording" ? "Recording..." : "Record"}
          </button>

          {status === "done" && (
            <button onClick={handleDownload} className="btn btn-sm btn-success">
              Download WebM
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
