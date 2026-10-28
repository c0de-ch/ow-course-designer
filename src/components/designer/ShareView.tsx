"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { getPublicConfig } from "@/lib/public-config";
import { CourseData, getRouteParts, parseFreehand, getRaceTotalKm, getBuoyNumbers } from "@/store/courseStore";
import { coursePoints } from "@/lib/course-bounds";
import { buildRouteLines, getLegendLaps, RouteLine } from "@/lib/route-geometry";
import { createMarkerLabel, getMarkerSvg } from "./markers/markerIcons";
import { RaceBranding } from "./RaceBranding";
import { Legend, ENTRIES as LEGEND_ENTRIES } from "./Legend";
import { FlyoverModal } from "./FlyoverModal";

interface Props {
  courseData: CourseData;
  isPrint: boolean;
  token: string;
  flyoverUrl?: string | null;
}

function PrintLegendIcon({ color, shape, arrow }: { color: string; shape: string; arrow?: string }) {
  const s = 20;
  if (shape === "circle") {
    return (
      <svg width={s} height={s} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        {arrow && <text x="9" y="13" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{arrow}</text>}
      </svg>
    );
  }
  if (shape === "rect") return <svg width={s} height={s} viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14" rx="2" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" /></svg>;
  if (shape === "rect-pair") return <svg width={s} height={s} viewBox="0 0 18 18"><rect x="1" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" /><rect x="12" y="3" width="5" height="12" rx="1" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" /></svg>;
  if (shape === "line-solid") return <svg width={s} height={s} viewBox="0 0 18 18"><line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.8" /></svg>;
  if (shape === "line-dashed") return <svg width={s} height={s} viewBox="0 0 18 18"><line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth="3" strokeOpacity="0.6" strokeDasharray="3,3" /></svg>;
  return null;
}

export function ShareView({ courseData, isPrint, token, flyoverUrl }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [showFlyover, setShowFlyover] = useState(false);

  useEffect(() => {
    // Tell the PDF/PNG exporter (and nobody else) that the map failed, so it
    // can report an error instead of capturing Google's "Oops" page.
    const signalError = (message: string) => {
      if (document.getElementById("map-error")) return;
      const el = document.createElement("div");
      el.id = "map-error";
      el.dataset.message = message;
      el.style.display = "none";
      document.body.appendChild(el);
    };
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () =>
      signalError(`Google Maps rejected the API key for ${window.location.origin}`);

    getPublicConfig()
      .then(({ mapsApiKey }) => new Loader({ apiKey: mapsApiKey, version: "weekly", libraries: ["places"] }).load())
      .then(() => setMapsLoaded(true))
      .catch((err: Error) => signalError(err.message || "Google Maps could not be loaded"));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current) return;

    const center = courseData.lakeLatLng
      ? (() => {
          const [lat, lng] = courseData.lakeLatLng!.split(",").map(Number);
          return { lat, lng };
        })()
      : { lat: 46.8182, lng: 8.2275 };

    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: courseData.zoomLevel ?? 14,
      mapTypeId: "satellite",
      disableDefaultUI: isPrint,
      zoomControl: !isPrint,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapRef.current = map;

    // Render freehand annotation lines
    courseData.elements.filter((el) => el.type === "freehand").forEach((el) => {
      const fh = parseFreehand(el.metadata);
      if (fh.path.length >= 2) {
        new google.maps.Polyline({
          path: fh.path,
          geodesic: true,
          strokeColor: fh.color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          zIndex: 5,
          map,
        });
      }
    });

    // Place overlays (all visible elements except rescue zones and freehand)
    const visibleElements = courseData.elements.filter((el) => el.type !== "rescue_zone" && el.type !== "freehand");
    const buoyNumbers = getBuoyNumbers(courseData.elements);
    visibleElements.forEach((el) => {
      const svgHtml = getMarkerSvg(el.type, false, el.metadata, buoyNumbers.get(el.id));
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = svgHtml;
      const svgEl = tempDiv.firstElementChild as SVGSVGElement;
      const w = parseInt(svgEl.getAttribute("width") ?? "28");
      const h = parseInt(svgEl.getAttribute("height") ?? "28");

      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function () {
        const div = document.createElement("div");
        div.style.cssText = `position:absolute;transform:translate(-50%,-50%);pointer-events:none;`;
        div.innerHTML = svgHtml;
        if (el.label) div.appendChild(createMarkerLabel(el.label));
        this.getPanes()!.overlayLayer.appendChild(div);
        (this as unknown as { _div: HTMLDivElement })._div = div;
        void w; void h;
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

    // Polyline: solid buoy loop + dashed entry/exit
    const parts = getRouteParts(courseData.elements);
    const route = buildRouteLines(courseData.elements, courseData.laps ?? 1);

    // Direction arrows: invisible lines with an arrow at the midpoint
    function addArrows(line: RouteLine) {
      for (const [from, to] of line.arrows) {
        new google.maps.Polyline({
          path: [from, to],
          geodesic: true,
          strokeOpacity: 0,
          strokeWeight: 0,
          zIndex: 10,
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: line.color,
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            },
            offset: "50%",
            repeat: "0",
          }],
          map,
        });
      }
    }

    // Standard loop (blue), the per-lap deviations, and the start/finish legs (orange)
    for (const l of [route.loop, ...route.lapSegments, route.startLine, route.finishLine]) {
      if (!l) continue;
      new google.maps.Polyline({
        path: l.path,
        geodesic: true,
        strokeColor: l.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        zIndex: l === route.loop || l === route.startLine || l === route.finishLine ? 1 : undefined,
        map,
      });
      addArrows(l);
    }

    // Dashed entry: shore_entry → start (green, no arrow — walk/approach)
    if (parts.shoreEntry && parts.start) {
      new google.maps.Polyline({
        path: [
          { lat: parts.shoreEntry.lat, lng: parts.shoreEntry.lng },
          { lat: parts.start.lat, lng: parts.start.lng },
        ],
        geodesic: true,
        strokeColor: "#22C55E",
        strokeOpacity: 0.6,
        strokeWeight: 3,
        zIndex: 10,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
        ],
        map,
      });
    }

    // Finish funnel lanes: lines from each funnel post to the finish endpoint
    if (parts.finishEndpoint && parts.finishFunnelLeft && parts.finishFunnelRight) {
      const ep = { lat: parts.finishEndpoint.lat, lng: parts.finishEndpoint.lng };
      const fl = { lat: parts.finishFunnelLeft.lat, lng: parts.finishFunnelLeft.lng };
      const fr = { lat: parts.finishFunnelRight.lat, lng: parts.finishFunnelRight.lng };

      // Left lane: funnel_left → finish endpoint
      new google.maps.Polyline({
        path: [fl, ep],
        geodesic: true,
        strokeColor: "#EF4444",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
          offset: "0",
          repeat: "10px",
        }],
        map,
      });

      // Right lane: funnel_right → finish endpoint
      new google.maps.Polyline({
        path: [fr, ep],
        geodesic: true,
        strokeColor: "#EF4444",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
          offset: "0",
          repeat: "10px",
        }],
        map,
      });
    }

    // Fit bounds to all visible elements
    const points = coursePoints(courseData.elements);
    if (points.length === 1) {
      map.setCenter(points[0]);
    } else if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 60);
    }

    // Signal to Puppeteer that the map is ready once its tiles have loaded
    // (with a fallback, so an export never hangs on a slow tile)
    const signalReady = () => {
      if (document.getElementById("map-ready")) return;
      const signal = document.createElement("div");
      signal.id = "map-ready";
      signal.style.display = "none";
      document.body.appendChild(signal);
    };
    google.maps.event.addListenerOnce(map, "tilesloaded", signalReady);
    setTimeout(signalReady, 10000);
  }, [mapsLoaded, courseData, isPrint]);

  // Compute lap colors for legend (only laps that differ from the standard route)
  const lapColorsForLegend = getLegendLaps(courseData.elements, courseData.laps ?? 1);

  // Compute freehand entries for legend (only labeled drawings)
  const freehandEntriesForLegend = courseData.elements
    .filter((el) => el.type === "freehand")
    .map((el) => parseFreehand(el.metadata))
    .filter((fh): fh is typeof fh & { label: string } => !!fh.label)
    .map((fh) => ({ label: fh.label, color: fh.color }));

  const usedTypes = new Set(courseData.elements.map(e => e.type));

  const { totalKm: raceTotalKm, avgLoopKm: raceAvgLoopKm } = getRaceTotalKm(courseData);
  const distanceBadge = raceTotalKm > 0
    ? ((courseData.laps ?? 1) > 1
        ? `${raceTotalKm.toFixed(2)} km (${raceAvgLoopKm.toFixed(2)} km/lap × ${courseData.laps} laps)`
        : `${raceTotalKm.toFixed(2)} km`)
    : null;

  if (isPrint) {
    const laps = courseData.laps ?? 1;
    return (
      <div className="flex flex-col h-screen bg-base-100">
        {/* Header: title + branding + distance */}
        <div className="px-6 py-2 flex items-center gap-4 shrink-0">
          <h1 className="text-lg font-bold">{courseData.name}</h1>
          {courseData.lakeLabel && (
            <span className="text-sm text-base-content/60">— {courseData.lakeLabel}</span>
          )}
          {raceTotalKm > 0 && (
            <span className="ml-auto font-medium">
              {laps > 1
                ? `${raceTotalKm.toFixed(2)} km total — ${raceAvgLoopKm.toFixed(2)} km/lap × ${laps} laps`
                : `${raceTotalKm.toFixed(2)} km`}
            </span>
          )}
          {(courseData.raceLogo || courseData.raceLabel) && (
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {courseData.raceLogo && (
                <img src={courseData.raceLogo} alt="Race logo" className="max-h-10 max-w-[120px] object-contain" />
              )}
              {courseData.raceLabel && (
                <span className="text-sm font-semibold text-base-content/80">{courseData.raceLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          {!mapsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}
          <div ref={mapDivRef} className="w-full h-full" style={{ minHeight: "500px" }} />
        </div>

        {/* Footer: legend in document flow */}
        <div className="px-6 py-2 shrink-0 flex items-start gap-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(() => {
              const filtered = usedTypes
                ? LEGEND_ENTRIES.filter((e) => !e.types || e.types.some((t) => usedTypes.has(t)))
                : LEGEND_ENTRIES;
              const lapEntries = lapColorsForLegend.map((lc) => ({
                color: lc.color, label: `Lap ${lc.lap} route`, shape: "line-solid" as const,
              }));
              const fhEntries = freehandEntriesForLegend.map((fh) => ({
                color: fh.color, label: fh.label, shape: "line-solid" as const,
              }));
              return [...filtered, ...lapEntries, ...fhEntries].map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <PrintLegendIcon color={entry.color} shape={entry.shape} arrow={"arrow" in entry ? (entry as { arrow?: string }).arrow : undefined} />
                  <span className="text-sm text-gray-700 whitespace-nowrap">{entry.label}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Compact header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-base-100 border-b border-base-300 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{courseData.name}</h1>
          {courseData.lakeLabel && (
            <p className="text-xs text-base-content/60 truncate">{courseData.lakeLabel}</p>
          )}
        </div>

        {distanceBadge && (
          <div className="badge badge-primary badge-lg font-semibold shrink-0">
            {distanceBadge}
          </div>
        )}

        <div className="flex-1" />

        {/* Export buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={`/api/share/${token}/export/pdf`}
            className="btn btn-sm btn-outline"
            title="Download PDF"
          >
            PDF
          </a>
          <a
            href={`/api/share/${token}/export/png`}
            className="btn btn-sm btn-outline"
            title="Download PNG"
          >
            PNG
          </a>
          <a
            href={`/api/share/${token}/export/gpx`}
            className="btn btn-sm btn-outline"
            title="Download GPX"
          >
            GPX
          </a>
          <a
            href={`/api/share/${token}/export/kml`}
            className="btn btn-sm btn-outline"
            title="Download KML"
          >
            KML
          </a>
          <button
            onClick={() => setShowFlyover(true)}
            className="btn btn-sm btn-outline"
            title="Watch flyover"
          >
            Flyover
          </button>
          {flyoverUrl && (
            <a
              href={flyoverUrl}
              download
              className="btn btn-sm btn-outline"
              title="Download flyover video"
            >
              Download
            </a>
          )}
        </div>
      </header>

      {/* Flyover video player */}
      {flyoverUrl && (
        <div className="bg-base-200 border-b border-base-300 px-4 py-3 flex items-center gap-4 shrink-0">
          <video
            controls
            src={flyoverUrl}
            className="rounded-lg max-h-48 max-w-md"
          />
          <a
            href={flyoverUrl}
            download
            className="btn btn-sm btn-outline shrink-0"
            title="Download flyover video"
          >
            Download
          </a>
        </div>
      )}

      {/* Flyover modal */}
      {showFlyover && (
        <FlyoverModal
          courseDataProp={courseData}
          onClose={() => setShowFlyover(false)}
        />
      )}

      {/* Map fills remaining viewport */}
      <div className="flex-1 relative min-h-0">
        {!mapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full isolate" />
        <RaceBranding readOnly raceLabel={courseData.raceLabel} raceLogo={courseData.raceLogo} />
        <Legend readOnly lapColors={lapColorsForLegend} usedTypes={usedTypes} freehandEntries={freehandEntriesForLegend} />
        {raceTotalKm > 0 && (
          <div className="absolute bottom-3 right-28 bg-white/80 backdrop-blur-sm text-gray-900 px-5 py-3 rounded-lg z-10 text-right shadow-lg">
            {(courseData.laps ?? 1) > 1 ? (
              <>
                <div className="text-2xl font-bold">{raceTotalKm.toFixed(2)} km</div>
                <div className="text-sm text-gray-600">{raceAvgLoopKm.toFixed(2)} km/lap × {courseData.laps} laps</div>
              </>
            ) : (
              <div className="text-2xl font-bold">{raceTotalKm.toFixed(2)} km</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
