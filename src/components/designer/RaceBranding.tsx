"use client";

import { useState, useRef } from "react";
import { useCourseStore } from "@/store/courseStore";

interface RaceBrandingProps {
  readOnly?: boolean;
  raceLabel?: string | null;
  raceLogo?: string | null;
}

export function RaceBranding({ readOnly = false, raceLabel: propLabel, raceLogo: propLogo }: RaceBrandingProps) {
  const store = useCourseStore();
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const raceLabel = readOnly ? propLabel : store.courseData.raceLabel;
  const raceLogo = readOnly ? propLogo : store.courseData.raceLogo;

  if (!raceLabel && !raceLogo && readOnly) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Logo must be under 500KB");
      return;
    }
    if (!["image/png", "image/gif"].includes(file.type)) {
      alert("Only PNG and GIF images are accepted");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      store.setRaceLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="absolute top-3 left-3 z-10">
      <div
        className="bg-white/80 backdrop-blur-sm rounded-lg p-2 max-w-[200px] cursor-pointer"
        onClick={() => !readOnly && setEditing(!editing)}
      >
        {raceLogo && (
          <img src={raceLogo} alt="Race logo" className="max-h-12 max-w-full object-contain mb-1" />
        )}
        {raceLabel && (
          <div className="text-sm font-semibold text-gray-800 leading-tight">{raceLabel}</div>
        )}
        {!raceLogo && !raceLabel && !readOnly && (
          <div className="text-xs text-gray-400 italic">Click to add branding</div>
        )}
      </div>

      {editing && !readOnly && (
        <div className="mt-1 bg-base-100 rounded-lg shadow-lg p-3 w-56">
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium">Logo (PNG/GIF, max 500KB)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/gif"
                onChange={handleFileChange}
                className="file-input file-input-xs w-full mt-1"
              />
              {raceLogo && (
                <button
                  onClick={(e) => { e.stopPropagation(); store.setRaceLogo(null); }}
                  className="btn btn-xs btn-ghost text-error mt-1"
                >
                  Clear logo
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-medium">Race label</label>
              <input
                type="text"
                value={raceLabel ?? ""}
                onChange={(e) => store.setRaceLabel(e.target.value || null)}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. 5km Knock Out"
                className="input input-xs w-full mt-1"
              />
              {raceLabel && (
                <button
                  onClick={(e) => { e.stopPropagation(); store.setRaceLabel(null); }}
                  className="btn btn-xs btn-ghost text-error mt-1"
                >
                  Clear label
                </button>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(false); }}
              className="btn btn-xs btn-primary w-full"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
