"use client";

import { useCourseStore } from "@/store/courseStore";

export function CourseStats() {
  const { courseData } = useCourseStore();
  const { distanceKm, elements } = courseData;

  const routeElements = elements.filter((el) => el.type !== "rescue_zone");

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="badge badge-outline">
        {routeElements.length} marker{routeElements.length !== 1 ? "s" : ""}
      </div>
      {distanceKm != null && distanceKm > 0 && (
        <div className="badge badge-primary">
          {distanceKm.toFixed(2)} km
        </div>
      )}
    </div>
  );
}
