"use client";

import { useState } from "react";
import { useCourseStore, getRaceTotalKm, getRouteParts } from "@/store/courseStore";
import { LapEditorModal } from "./LapEditorModal";

const pill = "bg-white/90 backdrop-blur-sm text-gray-900 h-8 px-3 rounded-lg shadow-lg flex items-center text-sm font-semibold whitespace-nowrap";

export function CourseStats() {
  const { courseData, setLaps } = useCourseStore();
  const { elements, laps } = courseData;

  const routeElements = elements.filter((el) => el.type !== "rescue_zone" && el.type !== "feeding_platform");
  const { totalKm, avgLoopKm } = getRaceTotalKm(courseData);
  const hasBuoys = getRouteParts(elements).buoys.length > 0;
  const [lapEditorOpen, setLapEditorOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite" aria-label="Course statistics">
      <div className={pill} aria-label={`${routeElements.length} ${routeElements.length === 1 ? "marker" : "markers"}`}>
        {routeElements.length} marker{routeElements.length !== 1 ? "s" : ""}
      </div>
      {totalKm > 0 && (
        <div className={pill} aria-label={`Total course distance ${totalKm.toFixed(2)} kilometers`}>
          {totalKm.toFixed(2)} km
        </div>
      )}
      {totalKm > 0 && laps > 1 && (
        <div className={`${pill} text-gray-600`} aria-label={`Average ${avgLoopKm.toFixed(2)} kilometers per lap`}>
          {avgLoopKm.toFixed(2)} km/lap
        </div>
      )}
      <div className={`${pill} gap-1.5`}>
        <label htmlFor="course-stats-laps" className="text-gray-600 text-xs font-medium">Laps:</label>
        <input
          id="course-stats-laps"
          type="number"
          min={1}
          max={100}
          value={laps}
          onChange={(e) => setLaps(Math.max(1, parseInt(e.target.value) || 1))}
          aria-label="Number of laps"
          className="w-12 h-6 text-center text-sm bg-gray-100 text-gray-900 border border-gray-300 rounded outline-none"
        />
        {hasBuoys && (
          <button
            onClick={() => setLapEditorOpen(true)}
            className="ml-1 text-xs font-medium text-sky-700 hover:underline"
            title="Per lap: skip buoys, change their swim side, and set mandatory gates"
          >
            Edit course
          </button>
        )}
      </div>
      {lapEditorOpen && <LapEditorModal onClose={() => setLapEditorOpen(false)} />}
    </div>
  );
}
