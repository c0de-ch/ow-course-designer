"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { CourseData, getBuoySide, getRouteParts, getFinishMidpoint } from "@/store/courseStore";
import { computeBearing, arcAroundBuoy } from "@/lib/haversine";
import { getMarkerSvg } from "./markers/markerIcons";
import { RaceBranding } from "./RaceBranding";
import { Legend } from "./Legend";

interface Props {
  courseData: CourseData;
  isPrint: boolean;
  token: string;
  flyoverUrl?: string | null;
}

export function ShareView({ courseData, isPrint, token, flyoverUrl }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });
    loader.load().then(() => setMapsLoaded(true));
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

    // Place overlays (all visible elements except rescue zones)
    const visibleElements = courseData.elements.filter((el) => el.type !== "rescue_zone");
    visibleElements.forEach((el) => {
      const svgHtml = getMarkerSvg(el.type, false, el.metadata);
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
    const buoys = parts.buoys;

    if (buoys.length >= 2) {
      const closedBuoys = [...buoys, buoys[0]];
      const offsetPath = closedBuoys.flatMap((b, i) => {
        const pt = { lat: b.lat, lng: b.lng };
        const side = getBuoySide(b.metadata);
        if (side === "directional") return [pt];
        const prev = closedBuoys[(i - 1 + closedBuoys.length) % closedBuoys.length];
        const next = closedBuoys[(i + 1) % closedBuoys.length];
        const bearing = computeBearing(prev, next);
        return arcAroundBuoy(pt, bearing, side);
      });

      new google.maps.Polyline({
        path: offsetPath,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            fillColor: "#FFFFFF",
            fillOpacity: 0.9,
            strokeColor: "#3B82F6",
            strokeWeight: 1,
          },
          offset: "10%",
          repeat: "15%",
        }],
        map,
      });
    }

    // Dashed entry: Start → first buoy
    if (parts.start && buoys.length > 0) {
      new google.maps.Polyline({
        path: [
          { lat: parts.start.lat, lng: parts.start.lng },
          { lat: buoys[0].lat, lng: buoys[0].lng },
        ],
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              fillColor: "#FFFFFF",
              fillOpacity: 0.9,
              strokeColor: "#3B82F6",
              strokeWeight: 1,
            },
            offset: "50%",
            repeat: "0",
          },
        ],
        map,
      });
    }

    // Dashed exit: first buoy → finish midpoint
    const finishMid = getFinishMidpoint(parts);
    if (finishMid && buoys.length > 0) {
      new google.maps.Polyline({
        path: [
          { lat: buoys[0].lat, lng: buoys[0].lng },
          { lat: finishMid.lat, lng: finishMid.lng },
        ],
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "15px",
          },
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              fillColor: "#FFFFFF",
              fillOpacity: 0.9,
              strokeColor: "#3B82F6",
              strokeWeight: 1,
            },
            offset: "50%",
            repeat: "0",
          },
        ],
        map,
      });
    }

    // Finish funnel connecting line
    if (parts.finishFunnelLeft && parts.finishFunnelRight) {
      new google.maps.Polyline({
        path: [
          { lat: parts.finishFunnelLeft.lat, lng: parts.finishFunnelLeft.lng },
          { lat: parts.finishFunnelRight.lat, lng: parts.finishFunnelRight.lng },
        ],
        geodesic: true,
        strokeColor: "#EF4444",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map,
      });
    }

    // Fit bounds to all visible elements
    if (visibleElements.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      visibleElements.forEach((el) =>
        bounds.extend(new google.maps.LatLng(el.lat, el.lng))
      );
      map.fitBounds(bounds, 60);
    }

    // Signal to Puppeteer that map is ready
    const signal = document.createElement("div");
    signal.id = "map-ready";
    signal.style.display = "none";
    document.body.appendChild(signal);
  }, [mapsLoaded, courseData, isPrint]);

  const distanceBadge = courseData.distanceKm != null && courseData.distanceKm > 0
    ? (() => {
        const loop = courseData.distanceKm!;
        const entry = courseData.entryDistKm ?? 0;
        const exit = courseData.exitDistKm ?? 0;
        const laps = courseData.laps ?? 1;
        const total = entry + loop * laps + exit;
        return laps > 1 || entry > 0 || exit > 0
          ? `${total.toFixed(2)} km (${loop.toFixed(2)} km × ${laps} laps)`
          : `${loop.toFixed(2)} km`;
      })()
    : null;

  if (isPrint) {
    return (
      <div className="flex flex-col h-screen bg-base-100">
        <div className="px-6 py-2 flex items-center gap-4">
          <h1 className="text-lg font-bold">{courseData.name}</h1>
          {courseData.lakeLabel && (
            <span className="text-sm text-base-content/60">— {courseData.lakeLabel}</span>
          )}
          {courseData.distanceKm != null && courseData.distanceKm > 0 && (
            <span className="ml-auto font-medium">
              {(() => {
                const loop = courseData.distanceKm!;
                const entry = courseData.entryDistKm ?? 0;
                const exit = courseData.exitDistKm ?? 0;
                const laps = courseData.laps ?? 1;
                const total = entry + loop * laps + exit;
                return laps > 1 || entry > 0 || exit > 0
                  ? `${loop.toFixed(2)} km × ${laps} laps = ${total.toFixed(2)} km`
                  : `${loop.toFixed(2)} km`;
              })()}
            </span>
          )}
        </div>
        <div className="flex-1 relative">
          {!mapsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}
          <div ref={mapDivRef} className="w-full h-full" style={{ minHeight: "500px" }} />
          <RaceBranding readOnly raceLabel={courseData.raceLabel} raceLogo={courseData.raceLogo} />
          <Legend readOnly />
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

      {/* Map fills remaining viewport */}
      <div className="flex-1 relative min-h-0">
        {!mapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" />
        <RaceBranding readOnly raceLabel={courseData.raceLabel} raceLogo={courseData.raceLogo} />
        <Legend readOnly />
        {courseData.distanceKm != null && courseData.distanceKm > 0 && (
          <div className="absolute bottom-3 right-28 bg-white/80 backdrop-blur-sm text-gray-900 px-5 py-3 rounded-lg z-10 text-right shadow-lg">
            {(() => {
              const loop = courseData.distanceKm!;
              const entry = courseData.entryDistKm ?? 0;
              const exit = courseData.exitDistKm ?? 0;
              const laps = courseData.laps ?? 1;
              const total = entry + loop * laps + exit;
              return laps > 1 || entry > 0 || exit > 0 ? (
                <>
                  <div className="text-2xl font-bold">{total.toFixed(2)} km</div>
                  <div className="text-sm text-gray-600">{loop.toFixed(2)} km × {laps} lap{laps > 1 ? "s" : ""}</div>
                </>
              ) : (
                <div className="text-2xl font-bold">{loop.toFixed(2)} km</div>
              );
            })()}
          </div>
        )}
      </div>

    </div>
  );
}
