"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { CourseData, getBuoySide } from "@/store/courseStore";
import { computeBearing, offsetPointPerpendicular } from "@/lib/haversine";
import { getMarkerSvg } from "./markers/markerIcons";
import Link from "next/link";
import { RaceBranding } from "./RaceBranding";

interface Props {
  courseData: CourseData;
  isPrint: boolean;
}

export function ShareView({ courseData, isPrint }: Props) {
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

    // Polyline with swim-side offset (exclude feeding platforms from route)
    const routeElements = visibleElements.filter((el) => el.type !== "feeding_platform");
    if (routeElements.length >= 2) {
      const pts = routeElements.map((el) => ({ lat: el.lat, lng: el.lng }));
      const closedPts = [...pts, pts[0]];
      const offsetPath = closedPts.map((pt, i) => {
        const el = routeElements[i % routeElements.length];
        const side = el.type === "buoy" ? getBuoySide(el.metadata) : "directional";
        if (side === "directional") return pt;
        const prev = closedPts[(i - 1 + closedPts.length) % closedPts.length];
        const next = closedPts[(i + 1) % closedPts.length];
        const bearing = computeBearing(prev, next);
        return offsetPointPerpendicular(pt, bearing, 8, side);
      });

      new google.maps.Polyline({
        path: offsetPath,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });

      // Fit bounds to all visible elements
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

  return (
    <div className={`flex flex-col ${isPrint ? "h-screen" : "min-h-screen"} bg-base-100`}>
      {!isPrint && (
        <header className="flex items-center gap-4 px-6 py-3 bg-base-100 border-b border-base-300">
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Home
          </Link>
          <div>
            <h1 className="text-lg font-bold">{courseData.name}</h1>
            {courseData.lakeLabel && (
              <p className="text-sm text-base-content/60">{courseData.lakeLabel}</p>
            )}
          </div>
          <div className="flex-1" />
          {courseData.distanceKm != null && courseData.distanceKm > 0 && (
            <div className="badge badge-primary badge-lg">
              {(courseData.laps ?? 1) > 1
                ? `${(courseData.distanceKm * (courseData.laps ?? 1)).toFixed(2)} km (${courseData.laps} laps)`
                : `${courseData.distanceKm.toFixed(2)} km`}
            </div>
          )}
        </header>
      )}

      {isPrint && (
        <div className="px-6 py-2 flex items-center gap-4">
          <h1 className="text-lg font-bold">{courseData.name}</h1>
          {courseData.lakeLabel && (
            <span className="text-sm text-base-content/60">— {courseData.lakeLabel}</span>
          )}
          {courseData.distanceKm != null && courseData.distanceKm > 0 && (
            <span className="ml-auto font-medium">
              {(courseData.laps ?? 1) > 1
                ? `${courseData.distanceKm.toFixed(2)} km × ${courseData.laps} laps = ${(courseData.distanceKm * (courseData.laps ?? 1)).toFixed(2)} km`
                : `${courseData.distanceKm.toFixed(2)} km`}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 relative">
        {!mapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" style={{ minHeight: "500px" }} />
        <RaceBranding readOnly raceLabel={courseData.raceLabel} raceLogo={courseData.raceLogo} />
        {courseData.distanceKm != null && courseData.distanceKm > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white px-4 py-2 rounded-lg z-10 text-right">
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
    </div>
  );
}
