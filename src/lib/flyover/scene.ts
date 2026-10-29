import { CourseData, getRouteParts, getBuoyNumbers } from "@/store/courseStore";
import { buildRouteLines, ROUTE_COLOR } from "@/lib/route-geometry";
import { getMarkerSvg } from "@/components/designer/markers/markerIcons";

// Swimmer marker: an orange dot with a white ring and a light halo. On a
// vector map it is drawn on the map itself (circles), because a canvas
// recording captures only the map canvas; on a raster map it is an HTML
// overlay, which redraws cleanly while the camera moves.
const SWIMMER_COLOR = "#F97316";
const TRAIL_POINTS = 45;
const SWIMMER_DOT_CSS =
  "position:absolute;transform:translate(-50%,-50%);pointer-events:none;display:none;" +
  `width:22px;height:22px;border-radius:50%;background:${SWIMMER_COLOR};border:3px solid #fff;` +
  "box-shadow:0 0 0 9px rgba(255,255,255,0.35),0 2px 6px rgba(0,0,0,0.5);";

/** The flyover's map with the route, the markers and a swimmer that can be moved */
export interface FlyoverScene {
  map: google.maps.Map;
  moveSwimmer: (pos: google.maps.LatLngLiteral) => void;
  hideSwimmer: () => void;
}

/**
 * Creates the flyover map in `container`, fitted to the course, and draws the
 * route, the markers and the (hidden) swimmer once the map is first ready;
 * `onReady` then receives the scene. Used by the flyover dialog and by the
 * page the server renders videos from, so both show the same picture.
 */
export function createFlyoverScene(
  container: HTMLElement,
  courseData: CourseData,
  mapId: string | undefined,
  onReady: (scene: FlyoverScene) => void
): google.maps.Map {
  let trail: google.maps.Polyline | null = null;
  let halo: google.maps.Circle | null = null;
  let dot: google.maps.Circle | null = null;
  let trailPoints: google.maps.LatLng[] = [];
  let domSwimmer: google.maps.OverlayView | null = null;
  let swimmerDiv: HTMLDivElement | null = null;
  let swimmerPos: google.maps.LatLng | null = null;

  // All visible elements (for markers) and route elements (for polyline/path)
  const buoyNumbers = getBuoyNumbers(courseData.elements);
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

  const map = new google.maps.Map(container, opts);

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

  // Draw the scene once, when the map is first ready. Not on every "idle":
  // the map goes idle again and again while the camera flies, and each time
  // a new swimmer (and another copy of the route and markers) was drawn
  // while the old swimmer stayed behind as a white dot.
  google.maps.event.addListenerOnce(map, "idle", () => {

    // Draw route polylines (solid buoy loop + dashed entry/exit)
    const parts = getRouteParts(courseData.elements);
    const route = buildRouteLines(courseData.elements, courseData.laps ?? 1);

    for (const l of [route.loop, ...route.lapSegments]) {
      if (!l) continue;
      new google.maps.Polyline({
        path: l.path,
        geodesic: true,
        strokeColor: l.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
    }

    for (const l of [route.startLine, route.finishLine]) {
      if (!l) continue;
      new google.maps.Polyline({
        path: l.path,
        geodesic: true,
        strokeColor: ROUTE_COLOR,
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "15px",
        }],
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

    // Draw markers (all visible elements including feeding platforms)
    visibleElements.forEach((el) => {
      const svgHtml = getMarkerSvg(el.type, false, el.metadata, buoyNumbers.get(el.id));
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

    // Swimmer: a short wake line and an orange dot with a white ring and a
    // light halo, drawn on the map (not as HTML) so they show in recordings.
    // Sizes are in metres, about the old pixel size at the flyover's fixed
    // zoom (18).
    trail = new google.maps.Polyline({
      map,
      visible: false,
      geodesic: true,
      strokeColor: SWIMMER_COLOR,
      strokeOpacity: 0.6,
      strokeWeight: 5,
      zIndex: 900,
    });
    halo = new google.maps.Circle({
      map,
      visible: false,
      radius: 8,
      fillColor: "#FFFFFF",
      fillOpacity: 0.35,
      strokeWeight: 0,
      clickable: false,
      zIndex: 901,
    });
    dot = new google.maps.Circle({
      map,
      visible: false,
      radius: 4,
      fillColor: SWIMMER_COLOR,
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeOpacity: 1,
      strokeWeight: 3,
      clickable: false,
      zIndex: 902,
    });

    const swimmerOverlay = new google.maps.OverlayView();
    swimmerOverlay.onAdd = function () {
      const div = document.createElement("div");
      div.style.cssText = SWIMMER_DOT_CSS;
      this.getPanes()!.overlayLayer.appendChild(div);
      swimmerDiv = div;
    };
    swimmerOverlay.draw = function () {
      if (!swimmerPos || !swimmerDiv) return;
      const pt = this.getProjection().fromLatLngToDivPixel(swimmerPos);
      if (pt) {
        swimmerDiv.style.left = `${pt.x}px`;
        swimmerDiv.style.top = `${pt.y}px`;
      }
    };
    swimmerOverlay.onRemove = function () {
      swimmerDiv?.parentNode?.removeChild(swimmerDiv);
      swimmerDiv = null;
    };
    swimmerOverlay.setMap(map);
    domSwimmer = swimmerOverlay;

    onReady(scene);
  });

  const scene: FlyoverScene = {
    map,
    moveSwimmer(pos) {
      const point = new google.maps.LatLng(pos.lat, pos.lng);
      if (map.getRenderingType() !== google.maps.RenderingType.VECTOR) {
        swimmerPos = point;
        if (swimmerDiv) swimmerDiv.style.display = "block";
        domSwimmer?.draw();
        return;
      }
      // The wake: the whole path in one update per frame
      trailPoints = [...trailPoints.slice(-(TRAIL_POINTS - 1)), point];
      for (const shape of [trail, halo, dot]) {
        if (shape && !shape.getVisible()) shape.setVisible(true);
      }
      trail?.setPath(trailPoints);
      halo?.setCenter(point);
      dot?.setCenter(point);
    },
    hideSwimmer() {
      trail?.setVisible(false);
      trail?.setPath([]);
      halo?.setVisible(false);
      dot?.setVisible(false);
      trailPoints = [];
      if (swimmerDiv) swimmerDiv.style.display = "none";
    },
  };

  return map;
}
