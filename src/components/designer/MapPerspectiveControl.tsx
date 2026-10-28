"use client";

import { useEffect, useState } from "react";
import { IconRotateLeft, IconRotateRight } from "@/components/ui/icons";

const TILT_STEPS = [0, 45, 67.5];
const ROTATE_STEP = 45;

interface Props {
  map: google.maps.Map;
}

/**
 * Tilt and rotate the designer map. Needs a vector map (a Map ID set to
 * vector in Google Cloud); on a raster map Google ignores tilt and heading.
 */
export function MapPerspectiveControl({ map }: Props) {
  const [tilt, setTilt] = useState(map.getTilt() ?? 0);
  const [heading, setHeading] = useState(map.getHeading() ?? 0);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const listeners = [
      map.addListener("tilt_changed", () => setTilt(map.getTilt() ?? 0)),
      map.addListener("heading_changed", () => setHeading(map.getHeading() ?? 0)),
    ];
    return () => listeners.forEach((l) => l.remove());
  }, [map]);

  const nextTilt = () => {
    const i = TILT_STEPS.findIndex((t) => tilt < t - 1);
    const target = i === -1 ? 0 : TILT_STEPS[i];
    map.moveCamera({ tilt: target });
    // Raster maps silently keep tilt at 0
    if (target > 0 && !(map.getTilt() ?? 0)) setUnsupported(true);
  };
  const rotate = (delta: number) => map.moveCamera({ heading: (heading + delta + 360) % 360 });
  const reset = () => map.moveCamera({ tilt: 0, heading: 0 });

  const btn = "w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors";
  const tilted = tilt > 1;
  const rotated = Math.round(heading) % 360 !== 0;

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-end gap-2">
      <div className="flex flex-col bg-white/95 rounded-lg shadow overflow-hidden divide-y divide-gray-200" role="group" aria-label="Map perspective">
        <button
          onClick={nextTilt}
          className={`${btn} text-xs font-semibold ${tilted ? "text-sky-700" : ""}`}
          title={tilted ? `Tilted ${Math.round(tilt)}°: click to tilt more or go back to flat` : "Tilt the map (3D view)"}
          aria-pressed={tilted}
        >
          {tilted ? "3D" : "2D"}
        </button>
        <button onClick={() => rotate(-ROTATE_STEP)} className={btn} title="Rotate left">
          <IconRotateLeft size={16} />
        </button>
        <button onClick={() => rotate(ROTATE_STEP)} className={btn} title="Rotate right">
          <IconRotateRight size={16} />
        </button>
        <button
          onClick={reset}
          disabled={!tilted && !rotated}
          className={`${btn} disabled:opacity-40`}
          title="Back to flat, north up"
          aria-label="Reset to flat, north up"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: `rotate(${-heading}deg)` }} aria-hidden="true">
            <path d="M12 2l4 10h-8z" fill="#DC2626" />
            <path d="M12 22l-4-10h8z" fill="#9CA3AF" />
          </svg>
        </button>
      </div>
      {unsupported && (
        <div className="max-w-[220px] bg-white/95 rounded-lg shadow px-3 py-2 text-xs text-gray-700">
          This map can’t be tilted: Google showed the flat (raster) map. That needs a vector Map ID
          (GOOGLE_MAPS_MAP_ID) and a browser with hardware graphics (WebGL) enabled.
        </div>
      )}
    </div>
  );
}
