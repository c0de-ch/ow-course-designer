"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useCourseStore, BuoySide, getBuoySide } from "@/store/courseStore";
import { createMarkerOverlay } from "./MarkerOverlay";
import { LakeSearch } from "./LakeSearch";
import { computeBearing, offsetPointPerpendicular } from "@/lib/haversine";
import { CourseStats } from "./CourseStats";

export function DesignerCanvas() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const rescuePolyRef = useRef<google.maps.Polygon | null>(null);
  const rescuePreviewRef = useRef<google.maps.Polyline | null>(null);
  const [pendingBuoy, setPendingBuoy] = useState<{lat: number; lng: number} | null>(null);

  const {
    courseData,
    activeTool,
    selectedElementId,
    gateFirstClick,
    rescueZonePoints,
    setSelectedElementId,
    addElement,
    updateElementPosition,
    setGateFirstClick,
    addRescueZonePoint,
    clearRescueZonePoints,
    setActiveTool,
  } = useCourseStore();
  const mapCreatedRef = useRef(false);

  // Load Google Maps — explicitly import the "maps" library so that
  // google.maps.OverlayView (and Polyline, LatLng, etc.) are available
  // before we try to use them.  With the new async bootstrap, Map is
  // bootstrapped automatically but the rest of the maps library is not.
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const loader = new Loader({ apiKey, version: "weekly" });
    loader.importLibrary("maps").then(() => setMapsLoaded(true));
  }, []);

  // Init map (guarded to only create once)
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || mapCreatedRef.current) return;
    mapCreatedRef.current = true;

    const initialCenter = courseData.lakeLatLng
      ? (() => {
          const [lat, lng] = courseData.lakeLatLng!.split(",").map(Number);
          return { lat, lng };
        })()
      : { lat: 46.8182, lng: 8.2275 }; // Switzerland centre

    const m = new google.maps.Map(mapDivRef.current, {
      center: initialCenter,
      zoom: courseData.zoomLevel ?? 14,
      mapTypeId: "satellite",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Sync zoom level back to store so auto-save captures the current view
    m.addListener("idle", () => {
      const zoom = m.getZoom();
      if (zoom == null) return;
      const cd = useCourseStore.getState().courseData;
      if (cd.zoomLevel !== zoom) {
        useCourseStore.setState({
          courseData: { ...cd, zoomLevel: zoom },
          isDirty: true,
        });
      }
    });

    setMap(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // Redraw overlays on element changes
  useEffect(() => {
    if (!map) return;

    // Remove old overlays
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    // Build route-order index map for badges (rescue zones excluded)
    const routeOrder = [...courseData.elements]
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order);
    const idxMap = new Map(routeOrder.map((el, i) => [el.id, i + 1]));

    // Add fresh overlays
    courseData.elements.forEach((el) => {
      const overlay = createMarkerOverlay(
        el,
        selectedElementId === el.id,
        (id) => setSelectedElementId(id),
        (id, lat, lng) => updateElementPosition(id, lat, lng),
        idxMap.get(el.id) ?? null
      );
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    // Redraw polyline (closed loop, excluding rescue zones) with swim-side offset
    const sortedRouteEls = courseData.elements
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order);
    const routePts = sortedRouteEls.map((el) => ({ lat: el.lat, lng: el.lng }));

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (routePts.length >= 2) {
      const closedPts = [...routePts, routePts[0]];
      const offsetPath = closedPts.map((pt, i) => {
        const el = sortedRouteEls[i % sortedRouteEls.length];
        const side = el.type === "buoy" ? getBuoySide(el.metadata) : "directional";
        if (side === "directional") return pt;
        const prev = closedPts[(i - 1 + closedPts.length) % closedPts.length];
        const next = closedPts[(i + 1) % closedPts.length];
        const bearing = computeBearing(prev, next);
        return offsetPointPerpendicular(pt, bearing, 8, side);
      });

      polylineRef.current = new google.maps.Polyline({
        path: offsetPath,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
    }
  }, [map, courseData.elements, selectedElementId, setSelectedElementId, updateElementPosition]);

  // Rescue zone preview polygon
  useEffect(() => {
    if (!map) return;

    if (rescuePreviewRef.current) {
      rescuePreviewRef.current.setMap(null);
      rescuePreviewRef.current = null;
    }

    if (rescueZonePoints.length >= 2 && activeTool === "rescue_zone") {
      rescuePreviewRef.current = new google.maps.Polyline({
        path: rescueZonePoints,
        strokeColor: "#EF4444",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        map,
      });
    }
  }, [map, rescueZonePoints, activeTool]);

  // Map click handler
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      switch (activeTool) {
        case "select":
          setSelectedElementId(null);
          break;

        case "buoy":
          setPendingBuoy({ lat, lng });
          break;

        case "start":
          addElement({ type: "start", lat, lng });
          break;

        case "finish":
          addElement({ type: "finish", lat, lng });
          break;

        case "shore_entry":
          addElement({ type: "shore_entry", lat, lng });
          break;

        case "feeding_platform":
          addElement({ type: "feeding_platform", lat, lng });
          break;

        case "gate":
          if (!gateFirstClick) {
            setGateFirstClick({ lat, lng });
          } else {
            addElement({ type: "gate_left", lat: gateFirstClick.lat, lng: gateFirstClick.lng });
            addElement({ type: "gate_right", lat, lng });
            setGateFirstClick(null);
          }
          break;

        case "rescue_zone":
          addRescueZonePoint({ lat, lng });
          break;
      }
    },
    [activeTool, gateFirstClick, addElement, setGateFirstClick, addRescueZonePoint, setSelectedElementId]
  );

  // Double-click to close rescue zone
  const handleMapDblClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (activeTool !== "rescue_zone" || rescueZonePoints.length < 3) return;
      e.stop?.();

      const vertices = JSON.stringify(rescueZonePoints);
      addElement({
        type: "rescue_zone",
        lat: rescueZonePoints[0].lat,
        lng: rescueZonePoints[0].lng,
        metadata: vertices,
      });
      clearRescueZonePoints();
      setActiveTool("select");
    },
    [activeTool, rescueZonePoints, addElement, clearRescueZonePoints, setActiveTool]
  );

  function confirmBuoySide(side: BuoySide) {
    if (!pendingBuoy) return;
    addElement({
      type: "buoy",
      lat: pendingBuoy.lat,
      lng: pendingBuoy.lng,
      metadata: JSON.stringify({ side }),
    });
    setPendingBuoy(null);
  }

  // Attach/detach map click listeners
  useEffect(() => {
    if (!map) return;

    const clickListener = map.addListener("click", handleMapClick);
    const dblClickListener = map.addListener("dblclick", handleMapDblClick);

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(dblClickListener);
    };
  }, [map, handleMapClick, handleMapDblClick]);

  // Cursor style
  useEffect(() => {
    if (!mapDivRef.current) return;
    mapDivRef.current.style.cursor = activeTool === "select" ? "" : "crosshair";
  }, [activeTool]);

  return (
    <div className="relative w-full h-full">
      {/* Map div */}
      <div ref={mapDivRef} className="w-full h-full" />

      {/* Top toolbar */}
      {mapsLoaded && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          <LakeSearch map={map} />
          <CourseStats />
        </div>
      )}

      {/* Gate hint */}
      {activeTool === "gate" && gateFirstClick && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-base-100 rounded shadow px-4 py-2 text-sm z-10">
          Click to place the second gate post
        </div>
      )}

      {/* Rescue zone hint */}
      {activeTool === "rescue_zone" && rescueZonePoints.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-base-100 rounded shadow px-4 py-2 text-sm z-10">
          {rescueZonePoints.length < 3
            ? `${rescueZonePoints.length} point${rescueZonePoints.length > 1 ? "s" : ""} — keep clicking to add more`
            : "Double-click to close the polygon"}
        </div>
      )}

      {/* Buoy side picker */}
      {pendingBuoy && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-base-100 rounded shadow-lg px-4 py-3 z-20 flex items-center gap-3">
          <span className="text-sm font-medium">Swim side:</span>
          <button className="btn btn-xs" style={{background:"#EF4444",color:"white"}}
            onClick={() => confirmBuoySide("left")}>{"\u2190"} Left</button>
          <button className="btn btn-xs" style={{background:"#FBBF24",color:"black"}}
            onClick={() => confirmBuoySide("directional")}>{"\u2191"} Directional</button>
          <button className="btn btn-xs" style={{background:"#22C55E",color:"white"}}
            onClick={() => confirmBuoySide("right")}>Right {"\u2192"}</button>
          <button className="btn btn-xs btn-ghost"
            onClick={() => setPendingBuoy(null)}>Cancel</button>
        </div>
      )}

      {/* Total distance badge */}
      {courseData.distanceKm != null && courseData.distanceKm > 0 && courseData.laps > 1 && (
        <div className="absolute bottom-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded text-sm font-medium z-10">
          Total: {(courseData.distanceKm * courseData.laps).toFixed(2)} km ({courseData.laps} laps)
        </div>
      )}

      {!mapsLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
    </div>
  );
}
