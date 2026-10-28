import type { SVGProps } from "react";

// Stroke icons (24×24 grid, 2px stroke) shared across the UI. SVG instead of
// emoji so they render the same everywhere, including headless Chromium exports.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);
export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></Icon>
);
export const IconPencil = (p: IconProps) => (
  <Icon {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>
);
export const IconDownload = (p: IconProps) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>
);
export const IconVideo = (p: IconProps) => (
  <Icon {...p}><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></Icon>
);
export const IconLink = (p: IconProps) => (
  <Icon {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);
export const IconCloud = (p: IconProps) => (
  <Icon {...p}><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 17.7" /><path d="M6 19h11.5" /></Icon>
);
export const IconAlert = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Icon>
);
export const IconMenu = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
);
export const IconMap = (p: IconProps) => (
  <Icon {...p}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></Icon>
);
export const IconWaves = (p: IconProps) => (
  <Icon {...p}><path d="M2 7c2 0 2-1.5 4-1.5S8 7 10 7s2-1.5 4-1.5S16 7 18 7s2-1.5 4-1.5M2 13c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /></Icon>
);
export const IconFile = (p: IconProps) => (
  <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></Icon>
);
export const IconImage = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Icon>
);
export const IconTable = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></Icon>
);
export const IconGlobe = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>
);
export const IconRotateLeft = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>
);
export const IconRotateRight = (p: IconProps) => (
  <Icon {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></Icon>
);
export const IconPin = (p: IconProps) => (
  <Icon {...p}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></Icon>
);

// Colored marker icons for the tool palette (match the markers drawn on the map).
export const ToolIconFinish = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <line x1="4" y1="2" x2="4" y2="18" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="4.8" y="3" width="12" height="8" fill="#fff" stroke="#111" strokeWidth="0.8" />
    <path d="M4.8 3h3v2.67h-3zM10.8 3h3v2.67h-3zM7.8 5.67h3v2.67h-3zM13.8 5.67h3v2.67h-3zM4.8 8.33h3V11h-3zM10.8 8.33h3V11h-3z" fill="#111" />
  </svg>
);
export const ToolIconShore = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M2 14c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" fill="none" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M2 17.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" fill="none" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="10" cy="6" r="3.6" fill="#F97316" stroke="#C2410C" strokeWidth="1" />
    <path d="M10 4.2v3.6M8.4 6.4 10 8l1.6-1.6" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ToolIconRescue = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M3 5l7-3 7 3-1 11-6 2-6-2z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="2 1.5" />
    <rect x="8.5" y="5.5" width="3" height="9" rx="0.5" fill="#EF4444" />
    <rect x="5.5" y="8.5" width="9" height="3" rx="0.5" fill="#EF4444" />
  </svg>
);
export const ToolIconFeeding = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <rect x="2" y="11" width="16" height="4" rx="1" fill="#7C3AED" stroke="#5B21B6" strokeWidth="0.8" />
    <path d="M6 11V7h3v4M11 11V5h3v6" fill="#DDD6FE" stroke="#5B21B6" strokeWidth="0.8" strokeLinejoin="round" />
    <path d="M2 18c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1" fill="none" stroke="#0EA5E9" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
