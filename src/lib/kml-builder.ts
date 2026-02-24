import { CourseElement } from "@/store/courseStore";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function iconHref(type: string): string {
  const icons: Record<string, string> = {
    buoy: "https://maps.google.com/mapfiles/kml/shapes/sailing.png",
    start: "https://maps.google.com/mapfiles/kml/paddle/go.png",
    finish: "https://maps.google.com/mapfiles/kml/paddle/stop.png",
    gate_left: "https://maps.google.com/mapfiles/kml/shapes/flag.png",
    gate_right: "https://maps.google.com/mapfiles/kml/shapes/flag.png",
    shore_entry: "https://maps.google.com/mapfiles/kml/shapes/beach.png",
    feeding_platform: "https://maps.google.com/mapfiles/kml/shapes/dining.png",
    rescue_zone: "https://maps.google.com/mapfiles/kml/shapes/hospitals.png",
  };
  return icons[type] ?? "https://maps.google.com/mapfiles/kml/paddle/wht-blank.png";
}

function colorForType(type: string): string {
  const colors: Record<string, string> = {
    buoy: "ff00bfff",
    start: "ff00ff00",
    finish: "ff0000ff",
    gate_left: "ffff6633",
    gate_right: "ffff6633",
    shore_entry: "ff0080ff",
    feeding_platform: "ffed3a7c",
    rescue_zone: "ff4444ef",
  };
  return colors[type] ?? "ffffffff";
}

export function buildKml(name: string, elements: CourseElement[]): string {
  const routeElements = elements
    .filter((el) => el.type !== "rescue_zone")
    .sort((a, b) => a.order - b.order);

  const rescueZones = elements.filter((el) => el.type === "rescue_zone");

  // Build styles
  const styleTypes = [...new Set(elements.map((el) => el.type))];
  const styles = styleTypes
    .map(
      (type) => `    <Style id="style-${escapeXml(type)}">
      <IconStyle>
        <color>${colorForType(type)}</color>
        <scale>1.0</scale>
        <Icon><href>${iconHref(type)}</href></Icon>
      </IconStyle>
    </Style>`
    )
    .join("\n");

  const routeStyle = `    <Style id="route-line">
      <LineStyle>
        <color>fff68235</color>
        <width>3</width>
      </LineStyle>
    </Style>`;

  const rescueStyle = `    <Style id="rescue-zone">
      <PolyStyle>
        <color>554444ef</color>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>ff4444ef</color>
        <width>2</width>
      </LineStyle>
    </Style>`;

  // Build placemarks for each element
  const placemarks = routeElements
    .map((el) => {
      const label = el.label ?? el.type.replace(/_/g, " ");
      return `    <Placemark>
      <name>${escapeXml(label)}</name>
      <description>${escapeXml(el.type)}</description>
      <styleUrl>#style-${escapeXml(el.type)}</styleUrl>
      <Point>
        <coordinates>${el.lng},${el.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("\n");

  // Route line (closed loop)
  const routeCoords = routeElements
    .map((el) => `${el.lng},${el.lat},0`)
    .concat(
      routeElements.length > 0
        ? [`${routeElements[0].lng},${routeElements[0].lat},0`]
        : []
    )
    .join("\n          ");

  const routePlacemark =
    routeElements.length >= 2
      ? `    <Placemark>
      <name>Route</name>
      <styleUrl>#route-line</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${routeCoords}
        </coordinates>
      </LineString>
    </Placemark>`
      : "";

  // Rescue zone polygons
  const rescuePlacemarks = rescueZones
    .map((rz) => {
      let vertices: { lat: number; lng: number }[] = [];
      try {
        vertices = JSON.parse(rz.metadata ?? "[]");
      } catch {}
      if (vertices.length < 3) return "";
      const coords = [...vertices, vertices[0]]
        .map((v) => `${v.lng},${v.lat},0`)
        .join("\n            ");
      return `    <Placemark>
      <name>Rescue Zone</name>
      <styleUrl>#rescue-zone</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
            ${coords}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    })
    .filter(Boolean)
    .join("\n");

  // Camera LookAt (center of route)
  let lookAt = "";
  if (routeElements.length > 0) {
    const avgLat =
      routeElements.reduce((s, el) => s + el.lat, 0) / routeElements.length;
    const avgLng =
      routeElements.reduce((s, el) => s + el.lng, 0) / routeElements.length;
    lookAt = `    <LookAt>
      <longitude>${avgLng}</longitude>
      <latitude>${avgLat}</latitude>
      <altitude>0</altitude>
      <range>1500</range>
      <tilt>45</tilt>
      <heading>0</heading>
    </LookAt>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
${styles}
${routeStyle}
${rescueStyle}
${lookAt}
${placemarks}
${routePlacemark}
${rescuePlacemarks}
  </Document>
</kml>`;
}
