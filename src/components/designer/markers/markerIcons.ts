import { ElementType } from "@/store/courseStore";

const COLORS: Record<ElementType, string> = {
  buoy: "#FBBF24",
  start: "#22C55E",
  finish: "#EF4444",
  gate_left: "#6366F1",
  gate_right: "#6366F1",
  shore_entry: "#F97316",
  rescue_zone: "#EF4444",
};

const SHAPES: Record<ElementType, string> = {
  buoy: "circle",
  start: "triangle",
  finish: "square",
  gate_left: "pole",
  gate_right: "pole",
  shore_entry: "diamond",
  rescue_zone: "zone",
};

function circleSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.4)";
  const sw = selected ? 2.5 : 1.5;
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="11" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
    ${selected ? '<circle cx="14" cy="14" r="5" fill="white" opacity="0.6"/>' : ""}
  </svg>`;
}

function triangleSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.4)";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <polygon points="14,3 25,25 3,25" fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2.5 : 1.5}"/>
    ${selected ? '<text x="14" y="22" text-anchor="middle" fill="white" font-size="9" font-weight="bold">S</text>' : ""}
  </svg>`;
}

function squareSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.4)";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="22" height="22" fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2.5 : 1.5}" rx="3"/>
    ${selected ? '<text x="14" y="19" text-anchor="middle" fill="white" font-size="9" font-weight="bold">F</text>' : ""}
  </svg>`;
}

function poleSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.4)";
  return `<svg width="16" height="36" viewBox="0 0 16 36" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="4" height="28" fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2 : 1}"/>
    <circle cx="8" cy="4" r="5" fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2 : 1}"/>
  </svg>`;
}

function diamondSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.4)";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <polygon points="14,2 26,14 14,26 2,14" fill="${color}" stroke="${stroke}" stroke-width="${selected ? 2.5 : 1.5}"/>
  </svg>`;
}

function zoneSvg(color: string, selected: boolean): string {
  const stroke = selected ? "#fff" : "rgba(0,0,0,0.5)";
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="0.3" stroke="${stroke}" stroke-width="${selected ? 2.5 : 1.5}" stroke-dasharray="4 2"/>
    <text x="12" y="16" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold">R</text>
  </svg>`;
}

export function getMarkerSvg(type: ElementType, selected: boolean): string {
  const color = COLORS[type];
  const shape = SHAPES[type];

  switch (shape) {
    case "circle":   return circleSvg(color, selected);
    case "triangle": return triangleSvg(color, selected);
    case "square":   return squareSvg(color, selected);
    case "pole":     return poleSvg(color, selected);
    case "diamond":  return diamondSvg(color, selected);
    case "zone":     return zoneSvg(color, selected);
    default:         return circleSvg(color, selected);
  }
}
