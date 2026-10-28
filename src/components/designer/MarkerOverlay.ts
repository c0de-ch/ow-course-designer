import { CourseElement } from "@/store/courseStore";
import { createMarkerLabel, getMarkerSvg } from "./markers/markerIcons";

type OnSelect = (id: string) => void;
type OnDragEnd = (id: string, lat: number, lng: number) => void;
type OnContextMenu = (id: string, clientX: number, clientY: number) => void;

export function createMarkerOverlay(
  element: CourseElement,
  isSelected: boolean,
  onSelect: OnSelect,
  onDragEnd: OnDragEnd,
  routeIndex: number | null = null,
  onContextMenu?: OnContextMenu,
  buoyNumber?: number
): google.maps.OverlayView {
  class Impl extends google.maps.OverlayView {
    private el: CourseElement;
    private div: HTMLDivElement | null = null;
    private dragging = false;

    constructor() {
      super();
      this.el = element;
    }

    onAdd() {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.userSelect = "none";
      div.style.cursor = "grab";
      div.style.transform = "translate(-50%, -50%)";
      div.innerHTML = getMarkerSvg(this.el.type, isSelected, this.el.metadata, buoyNumber);

      if (this.el.label) {
        div.appendChild(createMarkerLabel(this.el.label));
      }

      if (routeIndex !== null) {
        const badge = document.createElement("div");
        badge.style.cssText =
          "position:absolute;top:0;right:0;transform:translate(40%,-40%);width:18px;height:18px;border-radius:50%;background:#1e3a5f;color:white;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;pointer-events:none;line-height:1;border:1.5px solid white;";
        badge.textContent = String(routeIndex);
        div.appendChild(badge);
      }

      // Click to select
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(this.el.id);
      });

      // Right-click (long press on touch screens) opens the marker menu
      div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(this.el.id, e.clientX, e.clientY);
      });

      // Drag
      div.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.dragging = true;
        this.div!.style.cursor = "grabbing";
        const panes = this.getPanes();
        if (panes) {
          const rect = this.div!.getBoundingClientRect();
          void rect; // dragOffset not needed — we use map-relative coords
        }

        const onMouseMove = (me: MouseEvent) => {
          if (!this.dragging || !this.div) return;
          const map = this.getMap() as google.maps.Map;
          const projection = this.getProjection();
          const mapDiv = (map as unknown as { getDiv: () => HTMLElement }).getDiv();
          const mapRect = mapDiv.getBoundingClientRect();
          const px = me.clientX - mapRect.left;
          const py = me.clientY - mapRect.top;
          const latLng = projection.fromContainerPixelToLatLng(
            new google.maps.Point(px, py)
          );
          if (latLng) {
            this.el = { ...this.el, lat: latLng.lat(), lng: latLng.lng() };
            this.draw();
          }
        };

        const onMouseUp = () => {
          this.dragging = false;
          if (this.div) this.div.style.cursor = "grab";
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          onDragEnd(this.el.id, this.el.lat, this.el.lng);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      this.div = div;
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      const point = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(this.el.lat, this.el.lng)
      );
      if (point) {
        this.div.style.left = `${point.x}px`;
        this.div.style.top = `${point.y}px`;
      }
    }

    onRemove() {
      this.div?.parentNode?.removeChild(this.div);
      this.div = null;
    }
  }

  return new Impl();
}
