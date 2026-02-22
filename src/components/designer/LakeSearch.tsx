"use client";

import { useEffect, useRef } from "react";
import { useCourseStore } from "@/store/courseStore";

interface LakeSearchProps {
  map: google.maps.Map | null;
}

export function LakeSearch({ map }: LakeSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { courseData, setCourseData } = useCourseStore();

  useEffect(() => {
    if (!map || !inputRef.current || !window.google) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["(regions)"],
      fields: ["geometry", "name", "formatted_address"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.viewport && !place.geometry?.location) return;

      const label = place.name ?? place.formatted_address ?? "";
      const loc = place.geometry.location;
      const lakeLatLng = loc ? `${loc.lat()},${loc.lng()}` : null;

      setCourseData({
        ...courseData,
        lakeLabel: label,
        lakeLatLng,
      });

      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else if (loc) {
        map.setCenter(loc);
        map.setZoom(12);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, courseData, setCourseData]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for a lake or body of water…"
        defaultValue={courseData.lakeLabel ?? ""}
        className="input input-block w-72 shadow"
      />
    </div>
  );
}
