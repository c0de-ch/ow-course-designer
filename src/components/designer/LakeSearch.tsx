"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCourseStore } from "@/store/courseStore";

interface LakeSearchProps {
  map: google.maps.Map | null;
}

/** Parse a "lat,lng" string. Returns null if either part is missing, empty, or non-numeric. */
export function parseLakeLatLng(
  lakeLatLng: string
): { lat: number; lng: number } | null {
  const parts = lakeLatLng.split(",");
  if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

export function LakeSearch({ map }: LakeSearchProps) {
  const setCourseData = useCourseStore((s) => s.setCourseData);
  const setDirty = useCourseStore((s) => s.setDirty);
  const lakeLatLng = useCourseStore((s) => s.courseData.lakeLatLng);
  const lakeLabel = useCourseStore((s) => s.courseData.lakeLabel);

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const placesReady = useRef(false);
  const sessionToken =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the places library once
  useEffect(() => {
    if (!map || !window.google) return;
    (
      google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>
    ).then(() => {
      placesReady.current = true;
      sessionToken.current =
        new google.maps.places.AutocompleteSessionToken();
    });
  }, [map]);

  // Sync input with stored lakeLabel on load
  useEffect(() => {
    if (lakeLabel) setInputValue(lakeLabel);
  }, [lakeLabel]);

  function handleCenterOnLake() {
    const ll = useCourseStore.getState().courseData.lakeLatLng;
    if (!ll || !map) return;
    const coords = parseLakeLatLng(ll);
    if (!coords) return;
    map.setCenter(coords);
    map.setZoom(14);
  }

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (!input.trim() || !placesReady.current) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      debounceTimer.current = setTimeout(async () => {
        try {
          const { suggestions: results } =
            await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
              {
                input,
                sessionToken: sessionToken.current ?? undefined,
              }
            );
          if (results.length > 0) {
            setSuggestions(results);
            setShowDropdown(true);
            setHighlightedIndex(-1);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        } catch {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }, 300);
    },
    []
  );

  const selectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      setShowDropdown(false);
      if (!suggestion.placePrediction || !map) return;

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "location", "formattedAddress", "viewport"],
        });

        const label = place.displayName ?? place.formattedAddress ?? "";
        const loc = place.location;
        const latLng = loc ? `${loc.lat()},${loc.lng()}` : null;

        setInputValue(label);

        const courseData = useCourseStore.getState().courseData;
        setCourseData({ ...courseData, lakeLabel: label, lakeLatLng: latLng });
        setDirty(true);

        // Start a new session for the next search
        sessionToken.current =
          new google.maps.places.AutocompleteSessionToken();

        if (place.viewport) {
          map.fitBounds(place.viewport);
        } else if (loc) {
          map.setCenter(loc);
          map.setZoom(14);
        }
      } catch (err) {
        console.error("[LakeSearch] fetchFields failed:", err);
      }
    },
    [map, setCourseData, setDirty]
  );

  const doSearch = useCallback(async () => {
    if (suggestions.length > 0) {
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
      await selectSuggestion(suggestions[idx]);
    } else if (inputValue.trim() && placesReady.current) {
      // No visible suggestions — do a one-shot fetch and select the first
      try {
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              input: inputValue,
              sessionToken: sessionToken.current ?? undefined,
            }
          );
        if (results.length > 0) {
          await selectSuggestion(results[0]);
        }
      } catch {
        // no results
      }
    }
  }, [suggestions, highlightedIndex, inputValue, selectSuggestion]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    fetchSuggestions(val);
  }

  function handleBlur() {
    // Delay so onMouseDown on dropdown items fires first
    setTimeout(() => setShowDropdown(false), 200);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="flex">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Search for a lake or region..."
            className="input input-sm w-72 border border-gray-300 rounded-r-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={doSearch}
            disabled={!inputValue.trim() || !map}
            title="Search"
            className="btn btn-sm btn-ghost bg-white/80 hover:bg-white border border-l-0 border-gray-300 rounded-l-none disabled:opacity-40"
          >
            🔍
          </button>
        </div>
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={s.placePrediction?.placeId ?? i}
                onMouseDown={() => selectSuggestion(s)}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  i === highlightedIndex
                    ? "bg-blue-100"
                    : "hover:bg-gray-100"
                }`}
              >
                <span className="font-medium">
                  {s.placePrediction?.mainText?.text ?? ""}
                </span>
                {s.placePrediction?.secondaryText?.text && (
                  <span className="text-gray-500 ml-1">
                    {s.placePrediction.secondaryText.text}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={handleCenterOnLake}
        disabled={!lakeLatLng || !map}
        title="Center map on lake"
        className="btn btn-sm btn-ghost bg-white/80 hover:bg-white disabled:opacity-40"
      >
        🎯
      </button>
    </div>
  );
}
