"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useCourseStore } from "@/store/courseStore";
import { MarkerOverlay } from "./MarkerOverlay";
import { LakeSearch } from "./LakeSearch";
import { CourseStats } from "./CourseStats";

export function DesignerCanvas() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const overlaysRef = useRef<MarkerOverlay[]>([]);
  const rescuePolyRef = useRef<google.maps.Polygon | null>(null);
  const rescuePreviewRef = useRef<google.maps.Polyline | null>(null);

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

  // Load Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places", "drawing"],
    });

    loader.load().then(() => setMapsLoaded(true));
  }, []);

  // Init map
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current) return;

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

    setMap(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  // Redraw overlays on element changes
  useEffect(() => {
    if (!map) return;

    // Remove old overlays
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    // Add fresh overlays
    const routeElements = courseData.elements;
    routeElements.forEach((el) => {
      const overlay = new MarkerOverlay(
        el,
        selectedElementId === el.id,
        (id) => setSelectedElementId(id),
        (id, lat, lng) => updateElementPosition(id, lat, lng)
      );
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    // Redraw polyline (closed loop, excluding rescue zones)
    const routePts = courseData.elements
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order)
      .map((el) => ({ lat: el.lat, lng: el.lng }));

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (routePts.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: [...routePts, routePts[0]],
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.8,
        strokeWeight: 2,
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
          addElement({ type: "buoy", lat, lng });
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

      {!mapsLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
    </div>
  );
}
