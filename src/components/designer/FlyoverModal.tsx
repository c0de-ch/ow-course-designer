"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useCourseStore } from "@/store/courseStore";
import { getMarkerSvg } from "./markers/markerIcons";
import { buildCameraPath, CameraFrame } from "@/lib/flyover/cameraPath";
import { previewFlyover, recordFlyover } from "@/lib/flyover/flyoverController";

interface FlyoverModalProps {
  onClose: () => void;
}

export function FlyoverModal({ onClose }: FlyoverModalProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [duration, setDuration] = useState(20);
  const [status, setStatus] = useState<"idle" | "previewing" | "recording" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const framesRef = useRef<CameraFrame[]>([]);
  const abortRef = useRef(false);

  const { courseData } = useCourseStore();

  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const loader = new Loader({ apiKey, version: "weekly" });
    loader.importLibrary("maps").then(() => setMapsLoaded(true));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || mapRef.current) return;

    const center = courseData.lakeLatLng
      ? (() => {
          const [lat, lng] = courseData.lakeLatLng!.split(",").map(Number);
          return { lat, lng };
        })()
      : { lat: 46.8182, lng: 8.2275 };

    const mapOptions: google.maps.MapOptions = {
      center,
      zoom: courseData.zoomLevel ?? 14,
      mapTypeId: "satellite",
      disableDefaultUI: true,
    };

    // Only pass mapId if it looks like a valid ID (not a placeholder)
    if (mapId && mapId.length > 5) {
      mapOptions.mapId = mapId;
    }

    const map = new google.maps.Map(mapDivRef.current, mapOptions);
    mapRef.current = map;

    // Draw route polyline
    const routeElements = courseData.elements
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order);

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

    // Draw markers
    routeElements.forEach((el) => {
      const svgHtml = getMarkerSvg(el.type, false, el.metadata);
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function () {
        const div = document.createElement("div");
        div.style.cssText = "position:absolute;transform:translate(-50%,-50%);pointer-events:none;";
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

    // Build camera path
    const routePts = routeElements.map((el) => ({ lat: el.lat, lng: el.lng }));
    framesRef.current = buildCameraPath(routePts, duration);

    if (framesRef.current.length === 0) {
      setStatusMsg("Need at least 2 route points for flyover");
    } else {
      setStatusMsg(`Ready — ${framesRef.current.length} frames (${duration}s)`);
    }
  }, [mapsLoaded, courseData, mapId, duration]);

  const handlePreview = useCallback(async () => {
    if (!mapRef.current || framesRef.current.length === 0) return;
    abortRef.current = false;
    setStatus("previewing");
    setProgress(0);
    setError(null);
    try {
      await previewFlyover(mapRef.current, framesRef.current, 30, setProgress, setStatusMsg);
    } catch (err) {
      setError((err as Error).message);
    }
    if (!abortRef.current) setStatus("idle");
  }, []);

  const handleRecord = useCallback(async () => {
    if (!mapRef.current || framesRef.current.length === 0) return;
    setStatus("recording");
    setProgress(0);
    setError(null);
    try {
      const blob = await recordFlyover(mapRef.current, framesRef.current, 30, setProgress, setStatusMsg);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus("done");
      setStatusMsg("Recording complete! Click Download.");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  }, []);

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

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-base-100">
        <h2 className="text-lg font-bold">Flyover</h2>

        {/* Status message */}
        {statusMsg && (
          <span className="text-xs text-base-content/60 truncate">
            {statusMsg}
          </span>
        )}

        <div className="flex-1" />

        {(!mapId || mapId.length <= 5) && (
          <span className="text-xs text-warning">
            Set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID for 3D + recording
          </span>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm">Duration:</label>
          <select
            className="select select-xs"
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              // Rebuild frames on next render via useEffect
              mapRef.current = null;
            }}
            disabled={status !== "idle"}
          >
            <option value={10}>10s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
          </select>
        </div>

        <button
          onClick={handlePreview}
          disabled={status !== "idle" || !hasFrames}
          className="btn btn-sm btn-primary"
        >
          {status === "previewing" ? "Previewing..." : "Preview"}
        </button>

        <button
          onClick={handleRecord}
          disabled={status !== "idle" || !hasFrames}
          className="btn btn-sm btn-secondary"
        >
          {status === "recording" ? "Recording..." : "Record"}
        </button>

        {status === "done" && (
          <button onClick={handleDownload} className="btn btn-sm btn-success">
            Download WebM
          </button>
        )}

        <button onClick={handleClose} className="btn btn-sm btn-ghost">
          Close
        </button>
      </div>

      {/* Progress bar */}
      {(status === "previewing" || status === "recording") && (
        <div className="w-full bg-base-300 h-1.5">
          <div
            className="h-full bg-primary transition-all duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapDivRef} className="w-full h-full" />
        {!mapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
