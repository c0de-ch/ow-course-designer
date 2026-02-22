import { CourseElement } from "@/store/courseStore";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGpx(name: string, elements: CourseElement[]): string {
  const routeElements = elements
    .filter((el) => el.type !== "rescue_zone")
    .sort((a, b) => a.order - b.order);

  const waypoints = routeElements
    .map((el) => {
      const label = el.label ?? el.type.replace(/_/g, " ");
      return `  <wpt lat="${el.lat}" lon="${el.lng}">
    <name>${escapeXml(label)}</name>
    <type>${escapeXml(el.type)}</type>
  </wpt>`;
    })
    .join("\n");

  const rtepts = routeElements
    .map((el) => {
      const label = el.label ?? el.type.replace(/_/g, " ");
      return `      <rtept lat="${el.lat}" lon="${el.lng}">
        <name>${escapeXml(label)}</name>
      </rtept>`;
    })
    .join("\n");

  // Closed loop — append first point
  const closePoint =
    routeElements.length > 0
      ? `      <rtept lat="${routeElements[0].lat}" lon="${routeElements[0].lng}">
        <name>Return to start</name>
      </rtept>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OW Parcour Designer"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
${waypoints}
  <rte>
    <name>${escapeXml(name)}</name>
${rtepts}
${closePoint}
  </rte>
</gpx>`;
}
