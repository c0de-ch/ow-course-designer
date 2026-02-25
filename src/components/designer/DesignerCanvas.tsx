"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useCourseStore, BuoySide, getBuoySide, getRouteParts, getFinishMidpoint } from "@/store/courseStore";
import { createMarkerOverlay } from "./MarkerOverlay";
import { LakeSearch } from "./LakeSearch";
import { getToolCursorSvg } from "./markers/markerIcons";
import { computeBearing, offsetPointPerpendicular, arcAroundBuoy } from "@/lib/haversine";
import { CourseStats } from "./CourseStats";
import { RaceBranding } from "./RaceBranding";
import { Legend } from "./Legend";

export function DesignerCanvas() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const entryLineRef = useRef<google.maps.Polyline | null>(null);
  const exitLineRef = useRef<google.maps.Polyline | null>(null);
  const funnelLinesRef = useRef<google.maps.Polyline[]>([]);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const rescuePolyRef = useRef<google.maps.Polygon | null>(null);
  const rescuePreviewRef = useRef<google.maps.Polyline | null>(null);
  const [pendingBuoy, setPendingBuoy] = useState<{lat: number; lng: number; screenX: number; screenY: number} | null>(null);

  const {
    courseData,
    activeTool,
    selectedElementId,
    gateFirstClick,
    rescueZonePoints,
    setSelectedElementId,
    addElement,
    addFinishGroup,
    removeElement,
    updateElementPosition,
    setGateFirstClick,
    addRescueZonePoint,
    clearRescueZonePoints,
    setActiveTool,
  } = useCourseStore();
  const undo = useCourseStore((s) => s.undo);
  const mapCreatedRef = useRef(false);

  // Ctrl+Z undo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

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

    // Redraw polylines: solid buoy loop + dashed entry/exit
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (entryLineRef.current) { entryLineRef.current.setMap(null); entryLineRef.current = null; }
    if (exitLineRef.current) { exitLineRef.current.setMap(null); exitLineRef.current = null; }
    funnelLinesRef.current.forEach((l) => l.setMap(null));
    funnelLinesRef.current = [];

    const parts = getRouteParts(courseData.elements);
    const buoys = parts.buoys;

    if (buoys.length >= 2) {
      // Build closed buoy loop with swim-side arc offset
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

      polylineRef.current = new google.maps.Polyline({
        path: offsetPath,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: "#FBBF24",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
          offset: "5%",
          repeat: "10%",
        }],
        map,
      });
    }

    // Dashed entry line: Start → first buoy
    if (parts.start && buoys.length > 0) {
      entryLineRef.current = new google.maps.Polyline({
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
              scale: 5,
              fillColor: "#FBBF24",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            },
            offset: "50%",
            repeat: "0",
          },
        ],
        map,
      });
    }

    // Dashed exit line: first buoy → finish midpoint
    const finishMid = getFinishMidpoint(parts);
    if (finishMid && buoys.length > 0) {
      exitLineRef.current = new google.maps.Polyline({
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
              scale: 5,
              fillColor: "#FBBF24",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            },
            offset: "50%",
            repeat: "0",
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

      // Connecting line between funnel posts (the wide opening)
      funnelLinesRef.current.push(new google.maps.Polyline({
        path: [fl, fr],
        geodesic: true,
        strokeColor: "#EF4444",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map,
      }));

      // Left lane: funnel_left → finish endpoint
      funnelLinesRef.current.push(new google.maps.Polyline({
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
      }));

      // Right lane: funnel_right → finish endpoint
      funnelLinesRef.current.push(new google.maps.Polyline({
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
      }));
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

        case "buoy": {
          const mapRect = mapDivRef.current!.getBoundingClientRect();
          const domEvt = e.domEvent as MouseEvent;
          setPendingBuoy({ lat, lng, screenX: domEvt.clientX - mapRect.left, screenY: domEvt.clientY - mapRect.top });
          break;
        }

        case "start": {
          // Remove existing start if any — only one allowed
          const existingStart = courseData.elements.find((el) => el.type === "start");
          if (existingStart) removeElement(existingStart.id);
          addElement({ type: "start", lat, lng });
          setActiveTool("select");
          break;
        }

        case "finish": {
          // Remove existing finish group if any — only one allowed
          const finishTypes = ["finish", "finish_left", "finish_right", "finish_endpoint", "finish_funnel_left", "finish_funnel_right"] as const;
          courseData.elements
            .filter((el) => (finishTypes as readonly string[]).includes(el.type))
            .forEach((el) => removeElement(el.id));
          addFinishGroup(lat, lng);
          setActiveTool("select");
          break;
        }

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
    [activeTool, gateFirstClick, courseData.elements, addElement, addFinishGroup, removeElement, setGateFirstClick, addRescueZonePoint, setSelectedElementId, setActiveTool]
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

  // Cursor style — inject <style> with !important to override Google Maps internal cursor
  const cursorStyleRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (!mapDivRef.current) return;

    // Create style element on first use
    if (!cursorStyleRef.current) {
      cursorStyleRef.current = document.createElement("style");
      document.head.appendChild(cursorStyleRef.current);
    }

    if (activeTool === "select") {
      cursorStyleRef.current.textContent = "";
      return;
    }

    const svg = getToolCursorSvg(activeTool);
    if (svg) {
      const encoded = encodeURIComponent(svg);
      const cursorValue = `url("data:image/svg+xml,${encoded}") 14 14, crosshair`;
      cursorStyleRef.current.textContent =
        `[data-tool-cursor], [data-tool-cursor] * { cursor: ${cursorValue} !important; }`;
    } else {
      cursorStyleRef.current.textContent =
        `[data-tool-cursor], [data-tool-cursor] * { cursor: crosshair !important; }`;
    }

    mapDivRef.current.setAttribute("data-tool-cursor", "true");

    return () => {
      mapDivRef.current?.removeAttribute("data-tool-cursor");
    };
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

      {/* Race branding overlay */}
      <RaceBranding />

      {/* Legend */}
      <Legend />

      {/* Gate / finish channel hint */}
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
        <div className="absolute bg-base-100 rounded shadow-lg px-4 py-3 z-20 flex items-center gap-3"
          style={{ left: pendingBuoy.screenX, top: pendingBuoy.screenY + 20, transform: "translateX(-50%)" }}>
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
      {courseData.distanceKm != null && courseData.distanceKm > 0 && (
        <div className="absolute bottom-3 right-28 bg-white/80 backdrop-blur-sm text-gray-900 px-5 py-3 rounded-lg z-10 text-right shadow-lg">
          {(() => {
            const loop = courseData.distanceKm!;
            const entry = courseData.entryDistKm ?? 0;
            const exit = courseData.exitDistKm ?? 0;
            const total = entry + loop * courseData.laps + exit;
            return courseData.laps > 1 || entry > 0 || exit > 0 ? (
              <>
                <div className="text-2xl font-bold">{total.toFixed(2)} km total</div>
                <div className="text-sm text-gray-600">{loop.toFixed(2)} km × {courseData.laps} lap{courseData.laps > 1 ? "s" : ""}</div>
              </>
            ) : (
              <div className="text-2xl font-bold">{loop.toFixed(2)} km</div>
            );
          })()}
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
