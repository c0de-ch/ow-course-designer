"use client";

import { useCourseStore, getRaceTotalKm } from "@/store/courseStore";

const pill = "bg-white/80 backdrop-blur-sm text-gray-900 h-8 px-3 rounded-lg shadow-lg flex items-center text-sm font-semibold";

export function CourseStats() {
  const { courseData, setLaps } = useCourseStore();
  const { elements, laps } = courseData;

  const routeElements = elements.filter((el) => el.type !== "rescue_zone" && el.type !== "feeding_platform");
  const { totalKm, avgLoopKm } = getRaceTotalKm(courseData);

  return (
    <div className="flex items-center gap-2">
      <div className={pill}>
        {routeElements.length} marker{routeElements.length !== 1 ? "s" : ""}
      </div>
      {totalKm > 0 && (
        <div className={pill}>
          {totalKm.toFixed(2)} km
        </div>
      )}
      {totalKm > 0 && laps > 1 && (
        <div className={`${pill} text-gray-600`}>
          {avgLoopKm.toFixed(2)} km/lap
        </div>
      )}
      <div className={`${pill} gap-1.5`}>
        <span className="text-gray-600 text-xs font-medium">Laps:</span>
        <input
          type="number"
          min={1}
          max={100}
          value={laps}
          onChange={(e) => setLaps(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-12 h-6 text-center text-sm bg-gray-100 text-gray-900 border border-gray-300 rounded outline-none"
        />
      </div>
    </div>
  );
}
