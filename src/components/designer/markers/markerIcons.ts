import { ElementType, BuoySide, getBuoySide } from "@/store/courseStore";

function buoySvg(selected: boolean, side: BuoySide): string {
  const color = side === "left" ? "#EF4444" : side === "right" ? "#22C55E" : "#FBBF24";
  const ring = selected
    ? '<circle cx="14" cy="14" r="13" fill="none" stroke="white" stroke-width="2.5"/>'
    : "";

  let arrow: string;
  if (side === "left") {
    arrow = `<path d="M18,14 L8,14 M12,10 L8,14 L12,18" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (side === "right") {
    arrow = `<path d="M10,14 L20,14 M16,10 L20,14 L16,18" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else {
    arrow = `<path d="M14,20 L14,8 M10,12 L14,8 L18,12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }

  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <circle cx="14" cy="14" r="11" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    ${arrow}
  </svg>`;
}

function startSvg(selected: boolean): string {
  const ring = selected
    ? '<circle cx="14" cy="14" r="13" fill="none" stroke="white" stroke-width="2.5"/>'
    : "";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <circle cx="14" cy="14" r="11" fill="#22C55E" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    <polygon points="9,8 22,14 9,20" fill="white"/>
  </svg>`;
}

function finishSvg(selected: boolean): string {
  const ring = selected
    ? '<rect x="1" y="1" width="26" height="26" fill="none" stroke="white" stroke-width="2.5" rx="3"/>'
    : "";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <rect x="3" y="3" width="22" height="22" rx="2" fill="#111111"/>
    <rect x="3" y="3" width="11" height="11" fill="#EF4444"/>
    <rect x="14" y="14" width="11" height="11" fill="#EF4444"/>
  </svg>`;
}

function gateLeftSvg(selected: boolean): string {
  const ring = selected
    ? '<circle cx="9" cy="5" r="8" fill="none" stroke="white" stroke-width="2"/>'
    : "";
  return `<svg width="18" height="42" viewBox="0 0 18 42" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <rect x="7" y="9" width="4" height="31" fill="#6366F1" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="9" cy="5" r="6" fill="#6366F1" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <path d="M9,5 L2,2" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M9,5 L2,8" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function gateRightSvg(selected: boolean): string {
  const ring = selected
    ? '<circle cx="9" cy="5" r="8" fill="none" stroke="white" stroke-width="2"/>'
    : "";
  return `<svg width="18" height="42" viewBox="0 0 18 42" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <rect x="7" y="9" width="4" height="31" fill="#6366F1" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="9" cy="5" r="6" fill="#6366F1" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <path d="M9,5 L16,2" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M9,5 L16,8" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function shoreEntrySvg(selected: boolean): string {
  const ring = selected
    ? '<circle cx="14" cy="14" r="13" fill="none" stroke="white" stroke-width="2.5"/>'
    : "";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <circle cx="14" cy="14" r="11" fill="#F97316" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    <path d="M5,12 Q8,9 11,12 Q14,15 17,12 Q20,9 23,12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M5,17 Q8,14 11,17 Q14,20 17,17 Q20,14 23,17" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function rescueZoneSvg(selected: boolean): string {
  const ring = selected
    ? '<circle cx="14" cy="14" r="13" fill="none" stroke="white" stroke-width="2.5"/>'
    : "";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <circle cx="14" cy="14" r="11" fill="#EF4444" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <rect x="11.5" y="7" width="3" height="14" fill="white"/>
    <rect x="7" y="11.5" width="14" height="3" fill="white"/>
  </svg>`;
}

function feedingPlatformSvg(selected: boolean): string {
  const ring = selected
    ? '<rect x="1" y="1" width="26" height="26" fill="none" stroke="white" stroke-width="2.5" rx="4"/>'
    : "";
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    ${ring}
    <rect x="3" y="3" width="22" height="22" rx="3" fill="#7C3AED" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    <path d="M9,20 L9,15 L19,15 L19,20 Q14,22 9,20 Z" fill="white" fill-opacity="0.9"/>
    <path d="M19,16 Q23,16 23,18 Q23,20 19,20" fill="none" stroke="white" stroke-width="1.5"/>
    <path d="M12,14 Q11,12 12,10" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M16,14 Q15,12 16,10" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

export function getMarkerSvg(type: ElementType, selected: boolean, metadata?: string | null): string {
  switch (type) {
    case "buoy":             return buoySvg(selected, getBuoySide(metadata));
    case "start":            return startSvg(selected);
    case "finish":           return finishSvg(selected);
    case "gate_left":        return gateLeftSvg(selected);
    case "gate_right":       return gateRightSvg(selected);
    case "shore_entry":      return shoreEntrySvg(selected);
    case "rescue_zone":      return rescueZoneSvg(selected);
    case "feeding_platform": return feedingPlatformSvg(selected);
  }
}
