"use client";

import { useCourseStore } from "@/store/courseStore";

export function CourseStats() {
  const { courseData, setLaps } = useCourseStore();
  const { distanceKm, elements, laps } = courseData;

  const routeElements = elements.filter((el) => el.type !== "rescue_zone" && el.type !== "feeding_platform");
  const totalDistance = distanceKm != null ? distanceKm * laps : null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="badge badge-outline">
        {routeElements.length} marker{routeElements.length !== 1 ? "s" : ""}
      </div>
      {distanceKm != null && distanceKm > 0 && (
        <div className="badge badge-primary">
          {laps > 1
            ? `${distanceKm.toFixed(2)} km × ${laps} = ${totalDistance!.toFixed(2)} km`
            : `${distanceKm.toFixed(2)} km`}
        </div>
      )}
      <div className="flex items-center gap-1">
        <label className="text-xs text-base-content/60">Laps:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={laps}
          onChange={(e) => setLaps(Math.max(1, parseInt(e.target.value) || 1))}
          className="input input-xs w-14 text-center"
        />
      </div>
    </div>
  );
}
