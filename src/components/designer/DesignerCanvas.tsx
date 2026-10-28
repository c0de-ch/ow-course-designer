"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useCourseStore, BuoySide, getRouteParts, getDifferingLaps, parseFreehand, getRaceTotalKm, getBuoyNumbers } from "@/store/courseStore";
import { createMarkerOverlay } from "./MarkerOverlay";
import { LakeSearch } from "./LakeSearch";
import { getToolCursorSvg } from "./markers/markerIcons";
import { CourseStats } from "./CourseStats";
import { RaceBranding } from "./RaceBranding";
import { Legend } from "./Legend";
import { TOOLS } from "./ToolPanel";
import { MarkerContextMenu } from "./MarkerContextMenu";
import { getPublicConfig } from "@/lib/public-config";
import { MapPerspectiveControl } from "./MapPerspectiveControl";
import { coursePoints } from "@/lib/course-bounds";
import { buildRouteLines, RouteLine } from "@/lib/route-geometry";
import { IconAlert } from "@/components/ui/icons";

export function DesignerCanvas() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [markerMenu, setMarkerMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const lapPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const arrowPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const startLineRef = useRef<google.maps.Polyline | null>(null);
  const entryLineRef = useRef<google.maps.Polyline | null>(null);
  const exitLineRef = useRef<google.maps.Polyline | null>(null);
  const funnelLinesRef = useRef<google.maps.Polyline[]>([]);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const rescuePolyRef = useRef<google.maps.Polygon | null>(null);
  const rescuePreviewRef = useRef<google.maps.Polyline | null>(null);
  const freehandPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const freehandDrawingRef = useRef(false);
  const freehandPointsRef = useRef<{lat: number; lng: number}[]>([]);
  const freehandPreviewRef = useRef<google.maps.Polyline | null>(null);
  const [pendingBuoy, setPendingBuoy] = useState<{lat: number; lng: number; screenX: number; screenY: number} | null>(null);
  const [pendingFreehand, setPendingFreehand] = useState<{path: {lat: number; lng: number}[]; screenX: number; screenY: number} | null>(null);
  const [freehandLabel, setFreehandLabel] = useState("");
  const [freehandColor, setFreehandColor] = useState("#FFFFFF");

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
  const mapIdRef = useRef<string | null>(null);

  // The marker menu is positioned in screen space: close it when the map moves
  useEffect(() => {
    if (!map || !markerMenu) return;
    const close = () => setMarkerMenu(null);
    const listeners = [map.addListener("dragstart", close), map.addListener("zoom_changed", close)];
    return () => listeners.forEach((l) => l.remove());
  }, [map, markerMenu]);

  // Keyboard: Ctrl+Z undo, tool shortcuts, Esc back to Select, Del removes the selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const state = useCourseStore.getState();
      if (e.key === "Escape") {
        state.setActiveTool("select");
        state.setSelectedElementId(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedElementId) {
        e.preventDefault();
        state.removeElement(state.selectedElementId);
        return;
      }
      const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
      if (tool) state.setActiveTool(tool.id);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  // Load Google Maps — explicitly import the "maps" library so that
  // google.maps.OverlayView (and Polyline, LatLng, etc.) are available
  // before we try to use them.  With the new async bootstrap, Map is
  // bootstrapped automatically but the rest of the maps library is not.
  useEffect(() => {
    getPublicConfig()
      .then(({ mapsApiKey, mapId }) => {
        if (!mapsApiKey) throw new Error("No Google Maps API key is configured.");
        mapIdRef.current = mapId;
        return new Loader({ apiKey: mapsApiKey, version: "weekly" }).importLibrary("maps");
      })
      .then(() => setMapsLoaded(true))
      .catch((err: Error) => setMapsError(err.message || "Google Maps could not be loaded."));
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
      // A Map ID gives a vector map, which can be tilted and rotated
      ...(mapIdRef.current && {
        mapId: mapIdRef.current,
        renderingType: google.maps.RenderingType.VECTOR,
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true,
      }),
    });

    // Sync zoom level back to store so auto-save captures the current view
    m.addListener("idle", () => {
      const raw = m.getZoom();
      if (raw == null) return;
      // The vector map zooms in fractions; the course stores a whole level
      const zoom = Math.round(raw);
      const cd = useCourseStore.getState().courseData;
      if (cd.zoomLevel !== zoom) {
        useCourseStore.setState({
          courseData: { ...cd, zoomLevel: zoom },
          isDirty: true,
        });
      }
    });

    // Open on the course itself rather than on the searched lake, which may
    // be far from where the markers were actually placed
    const points = coursePoints(courseData.elements);
    if (points.length === 1) {
      m.setCenter(points[0]);
    } else if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      m.fitBounds(bounds, 60);
    }

    setMap(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // Redraw overlays on element changes
  useEffect(() => {
    if (!map) return;

    // Remove old overlays
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    // Build route-order index map for badges (rescue zones and freehand excluded)
    const routeOrder = [...courseData.elements]
      .filter((el) => el.type !== "rescue_zone" && el.type !== "freehand")
      .sort((a, b) => a.order - b.order);
    const idxMap = new Map(routeOrder.map((el, i) => [el.id, i + 1]));
    const buoyNumbers = getBuoyNumbers(courseData.elements);

    // Add fresh overlays (skip freehand — rendered as polylines below)
    courseData.elements.filter((el) => el.type !== "freehand").forEach((el) => {
      const overlay = createMarkerOverlay(
        el,
        selectedElementId === el.id,
        (id) => setSelectedElementId(id),
        (id, lat, lng) => updateElementPosition(id, lat, lng),
        idxMap.get(el.id) ?? null,
        (id, clientX, clientY) => {
          const rect = mapDivRef.current?.getBoundingClientRect();
          if (!rect) return;
          setSelectedElementId(id);
          setMarkerMenu({ id, x: clientX - rect.left, y: clientY - rect.top });
        },
        buoyNumbers.get(el.id)
      );
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    // Redraw polylines: solid buoy loop + dashed entry/exit
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    lapPolylinesRef.current.forEach((l) => l.setMap(null));
    lapPolylinesRef.current = [];
    arrowPolylinesRef.current.forEach((l) => l.setMap(null));
    arrowPolylinesRef.current = [];
    if (startLineRef.current) { startLineRef.current.setMap(null); startLineRef.current = null; }
    if (entryLineRef.current) { entryLineRef.current.setMap(null); entryLineRef.current = null; }
    if (exitLineRef.current) { exitLineRef.current.setMap(null); exitLineRef.current = null; }
    funnelLinesRef.current.forEach((l) => l.setMap(null));
    funnelLinesRef.current = [];
    freehandPolylinesRef.current.forEach((l) => l.setMap(null));
    freehandPolylinesRef.current = [];

    // Render freehand annotation lines
    courseData.elements.filter((el) => el.type === "freehand").forEach((el) => {
      const fh = parseFreehand(el.metadata);
      if (fh.path.length >= 2) {
        const pl = new google.maps.Polyline({
          path: fh.path,
          geodesic: true,
          strokeColor: fh.color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          zIndex: 5,
          map,
        });
        freehandPolylinesRef.current.push(pl);
      }
    });

    const parts = getRouteParts(courseData.elements);
    const route = buildRouteLines(courseData.elements, courseData.laps ?? 1);

    // Direction arrows: invisible lines with an arrow at the midpoint, above the route
    function addArrows(line: RouteLine) {
      for (const [from, to] of line.arrows) {
        arrowPolylinesRef.current.push(new google.maps.Polyline({
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
        }));
      }
    }

    // Standard loop (blue), then the segments where a lap deviates, in that lap's colour
    if (route.loop) {
      polylineRef.current = new google.maps.Polyline({
        path: route.loop.path,
        geodesic: true,
        strokeColor: route.loop.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        zIndex: 1,
        map,
      });
      addArrows(route.loop);
    }
    for (const seg of route.lapSegments) {
      lapPolylinesRef.current.push(new google.maps.Polyline({
        path: seg.path,
        geodesic: true,
        strokeColor: seg.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      }));
      addArrows(seg);
    }

    // Start → first buoy of lap 1 (orange), through any start gate
    if (route.startLine) {
      startLineRef.current = new google.maps.Polyline({
        path: route.startLine.path,
        geodesic: true,
        strokeColor: route.startLine.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        zIndex: 1,
        map,
      });
      addArrows(route.startLine);
    }

    // Dashed entry line: shore_entry → start (green, no arrow — walk/approach)
    if (parts.shoreEntry && parts.start) {
      entryLineRef.current = new google.maps.Polyline({
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

    // Last buoy of the last lap → finish (orange), through any finish gate
    if (route.finishLine) {
      exitLineRef.current = new google.maps.Polyline({
        path: route.finishLine.path,
        geodesic: true,
        strokeColor: route.finishLine.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        zIndex: 1,
        map,
      });
      addArrows(route.finishLine);
    }

    // Finish funnel lanes: lines from each funnel post to the finish endpoint
    if (parts.finishEndpoint && parts.finishFunnelLeft && parts.finishFunnelRight) {
      const ep = { lat: parts.finishEndpoint.lat, lng: parts.finishEndpoint.lng };
      const fl = { lat: parts.finishFunnelLeft.lat, lng: parts.finishFunnelLeft.lng };
      const fr = { lat: parts.finishFunnelRight.lat, lng: parts.finishFunnelRight.lng };

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

  // Update freehand preview polyline color when user picks a swatch
  useEffect(() => {
    if (freehandPreviewRef.current && pendingFreehand) {
      freehandPreviewRef.current.setOptions({ strokeColor: freehandColor });
    }
  }, [freehandColor, pendingFreehand]);

  // Freehand drawing mode
  useEffect(() => {
    if (!map) return;
    if (activeTool !== "freehand") {
      map.setOptions({ draggable: true });
      return;
    }
    map.setOptions({ draggable: false });

    const onDown = map.addListener("mousedown", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      freehandDrawingRef.current = true;
      freehandPointsRef.current = [{ lat: e.latLng.lat(), lng: e.latLng.lng() }];
      freehandPreviewRef.current = new google.maps.Polyline({
        path: freehandPointsRef.current,
        geodesic: true,
        strokeColor: "#FFFFFF",
        strokeOpacity: 0.85,
        strokeWeight: 4,
        zIndex: 20,
        map,
      });
    });

    const onMove = map.addListener("mousemove", (e: google.maps.MapMouseEvent) => {
      if (!freehandDrawingRef.current || !e.latLng) return;
      freehandPointsRef.current.push({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      freehandPreviewRef.current?.setPath(freehandPointsRef.current);
    });

    // Use document-level mouseup/pointerup — Google Maps' mouseup is unreliable on macOS
    function finishDrawing(e: MouseEvent) {
      if (!freehandDrawingRef.current) return;
      freehandDrawingRef.current = false;
      const pts = freehandPointsRef.current;
      if (pts.length >= 2) {
        // Simplify: keep at most ~150 points
        const simplified = pts.length <= 150 ? pts : (() => {
          const step = Math.ceil(pts.length / 150);
          const result = [pts[0]];
          for (let i = step; i < pts.length - 1; i += step) result.push(pts[i]);
          result.push(pts[pts.length - 1]);
          return result;
        })();
        const mapRect = mapDivRef.current?.getBoundingClientRect();
        const sx = mapRect ? e.clientX - mapRect.left : e.clientX;
        const sy = mapRect ? e.clientY - mapRect.top : e.clientY;
        setPendingFreehand({ path: simplified, screenX: sx, screenY: sy });
        setFreehandLabel("");
        setFreehandColor("#FFFFFF");
        // Keep preview polyline visible — don't remove it
      } else {
        freehandPreviewRef.current?.setMap(null);
        freehandPreviewRef.current = null;
      }
      freehandPointsRef.current = [];
    }
    document.addEventListener("mouseup", finishDrawing);
    document.addEventListener("pointerup", finishDrawing);

    return () => {
      google.maps.event.removeListener(onDown);
      google.maps.event.removeListener(onMove);
      document.removeEventListener("mouseup", finishDrawing);
      document.removeEventListener("pointerup", finishDrawing);
      map.setOptions({ draggable: true });
      if (freehandPreviewRef.current) {
        freehandPreviewRef.current.setMap(null);
        freehandPreviewRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeTool]);

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

  function confirmFreehand() {
    if (!pendingFreehand) return;
    addElement({
      type: "freehand",
      lat: pendingFreehand.path[0].lat,
      lng: pendingFreehand.path[0].lng,
      metadata: JSON.stringify({ path: pendingFreehand.path, label: freehandLabel || undefined, color: freehandColor }),
    });
    freehandPreviewRef.current?.setMap(null);
    freehandPreviewRef.current = null;
    setPendingFreehand(null);
  }

  function cancelFreehand() {
    freehandPreviewRef.current?.setMap(null);
    freehandPreviewRef.current = null;
    setPendingFreehand(null);
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
        <div className="absolute top-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 flex flex-wrap items-center gap-2 sm:gap-3 z-10">
          <LakeSearch map={map} />
          <CourseStats />
        </div>
      )}

      {map && <MapPerspectiveControl map={map} />}

      {/* Race branding overlay */}
      <RaceBranding />

      {/* Legend */}
      <Legend
        lapColors={getDifferingLaps(courseData.elements, courseData.laps ?? 1)}
        usedTypes={new Set(courseData.elements.map(e => e.type))}
        freehandEntries={courseData.elements
          .filter((el) => el.type === "freehand")
          .map((el) => parseFreehand(el.metadata))
          .filter((fh): fh is typeof fh & { label: string } => !!fh.label)
          .map((fh) => ({ label: fh.label, color: fh.color }))}
      />

      {/* What a click does with the active tool */}
      {mapsLoaded && !pendingBuoy && !pendingFreehand && (() => {
        let hint: string | null = null;
        if (activeTool === "gate" && gateFirstClick) hint = "Now click to place the right gate post";
        else if (activeTool === "rescue_zone" && rescueZonePoints.length > 0)
          hint = rescueZonePoints.length < 3
            ? `${rescueZonePoints.length} corner${rescueZonePoints.length > 1 ? "s" : ""} placed. Keep clicking to add more`
            : "Double-click to close the rescue zone";
        else if (activeTool !== "select") hint = TOOLS.find((t) => t.id === activeTool)?.hint ?? null;
        else if (courseData.elements.length === 0)
          hint = "Search for your lake above, then pick a tool on the left to start placing markers";
        if (!hint) return null;
        return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-gray-900/85 text-white backdrop-blur-sm rounded-full shadow-lg pl-4 pr-2 py-1.5 text-sm max-w-[calc(100%-2rem)]">
            <span className="truncate">{hint}</span>
            {activeTool !== "select" && (
              <button
                onClick={() => setActiveTool("select")}
                className="shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-2.5 py-0.5 text-xs"
                title="Stop placing (Esc)"
              >
                Done <span className="opacity-60">Esc</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Right-click menu on a marker */}
      {markerMenu && (
        <MarkerContextMenu
          key={markerMenu.id}
          elementId={markerMenu.id}
          x={markerMenu.x}
          y={markerMenu.y}
          onClose={() => setMarkerMenu(null)}
        />
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

      {/* Freehand drawing popup */}
      {pendingFreehand && (
        <div className="absolute bg-base-100 rounded shadow-lg px-4 py-3 z-20 flex flex-col gap-2 w-56"
          style={{ left: Math.min(pendingFreehand.screenX, (mapDivRef.current?.clientWidth ?? 800) - 240), top: pendingFreehand.screenY + 20 }}>
          <input
            type="text"
            value={freehandLabel}
            onChange={(e) => setFreehandLabel(e.target.value)}
            placeholder="Label (optional)"
            className="input input-sm input-bordered w-full"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") confirmFreehand(); }}
          />
          <div className="flex items-center gap-1.5">
            {["#FFFFFF","#EF4444","#22C55E","#3B82F6","#FBBF24","#7C3AED"].map((c) => (
              <button key={c} onClick={() => setFreehandColor(c)}
                className="w-6 h-6 rounded-full border-2 shrink-0"
                style={{ background: c, borderColor: freehandColor === c ? "#3B82F6" : "rgba(0,0,0,0.15)" }}
                title={c} />
            ))}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button className="btn btn-xs btn-ghost" onClick={cancelFreehand}>Cancel</button>
            <button className="btn btn-xs btn-primary" onClick={confirmFreehand}>Save</button>
          </div>
        </div>
      )}

      {/* Total distance badge */}
      {(() => {
        const { totalKm, avgLoopKm } = getRaceTotalKm(courseData);
        return totalKm > 0 ? (
          <div className="hidden sm:block absolute bottom-3 right-28 bg-white/80 backdrop-blur-sm text-gray-900 px-5 py-3 rounded-lg z-10 text-right shadow-lg">
            {courseData.laps > 1 ? (
              <>
                <div className="text-2xl font-bold">{totalKm.toFixed(2)} km total</div>
                <div className="text-sm text-gray-600">{avgLoopKm.toFixed(2)} km/lap × {courseData.laps} laps</div>
              </>
            ) : (
              <div className="text-2xl font-bold">{totalKm.toFixed(2)} km</div>
            )}
          </div>
        ) : null;
      })()}

      {!mapsLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          {mapsError ? (
            <div className="max-w-sm text-center px-6">
              <IconAlert size={32} className="mx-auto text-red-500 mb-3" />
              <p className="font-semibold mb-1">The map could not be loaded</p>
              <p className="text-sm text-base-content/60 mb-4">{mapsError}</p>
              <button onClick={() => window.location.reload()} className="btn btn-sm btn-primary">
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-lg" />
              Loading map…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
