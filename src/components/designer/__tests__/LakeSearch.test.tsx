import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseLakeLatLng, LakeSearch } from "../LakeSearch";
import { useCourseStore } from "@/store/courseStore";

// ---------------------------------------------------------------------------
// Google Maps stub — the useEffect in LakeSearch imports the Places library.
// We stub importLibrary so it never resolves, keeping the effect inert.
// ---------------------------------------------------------------------------
const mockSetCenter = jest.fn();
const mockSetZoom = jest.fn();

function freshMockMap() {
  return {
    setCenter: mockSetCenter,
    setZoom: mockSetZoom,
    panTo: jest.fn(),
    fitBounds: jest.fn(),
  } as unknown as google.maps.Map;
}

let mockMap: google.maps.Map;

beforeAll(() => {
  Object.defineProperty(globalThis, "google", {
    writable: true,
    value: {
      maps: {
        importLibrary: jest.fn(() => new Promise(() => {})),
      },
    },
  });
});

beforeEach(() => {
  mockSetCenter.mockClear();
  mockSetZoom.mockClear();
  mockMap = freshMockMap();
  act(() => {
    useCourseStore.getState().resetCourse();
  });
});

// Click the collapsed search icon to reveal the input.
async function expand() {
  await userEvent.click(screen.getByTitle("Search for a lake or region"));
}

describe("parseLakeLatLng", () => {
  it("parses a valid lat,lng string", () => {
    expect(parseLakeLatLng("46.8182,8.2275")).toEqual({
      lat: 46.8182,
      lng: 8.2275,
    });
  });

  it("parses negative coordinates", () => {
    expect(parseLakeLatLng("-33.8688,151.2093")).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it("handles whitespace around the numbers", () => {
    expect(parseLakeLatLng(" 46.8182 , 8.2275 ")).toEqual({
      lat: 46.8182,
      lng: 8.2275,
    });
  });

  it("returns null for an empty string", () => {
    expect(parseLakeLatLng("")).toBeNull();
  });

  it("returns null when lat is not a number", () => {
    expect(parseLakeLatLng("abc,8.2275")).toBeNull();
  });

  it("returns null when lng is not a number", () => {
    expect(parseLakeLatLng("46.8182,xyz")).toBeNull();
  });

  it("returns null when only one part is present (no comma)", () => {
    expect(parseLakeLatLng("46.8182")).toBeNull();
  });

  it("returns null when lng part is empty after comma", () => {
    expect(parseLakeLatLng("46.8182,")).toBeNull();
  });

  it("returns null when lat part is empty before comma", () => {
    expect(parseLakeLatLng(",8.2275")).toBeNull();
  });
});

describe("LakeSearch collapsed state", () => {
  it("renders only the search icon button before expansion", () => {
    render(<LakeSearch map={mockMap} />);
    expect(
      screen.getByTitle("Search for a lake or region")
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search for a lake or region...")
    ).not.toBeInTheDocument();
  });

  it("expands to show the input when clicked", async () => {
    render(<LakeSearch map={mockMap} />);
    await expand();
    expect(
      screen.getByPlaceholderText("Search for a lake or region...")
    ).toBeInTheDocument();
  });
});

describe("LakeSearch search input", () => {
  it("search button is disabled when input is empty", async () => {
    render(<LakeSearch map={mockMap} />);
    await expand();
    expect(screen.getByTitle("Search")).toBeDisabled();
  });

  it("search button is enabled when input has text", async () => {
    render(<LakeSearch map={mockMap} />);
    await expand();
    await userEvent.type(
      screen.getByPlaceholderText("Search for a lake or region..."),
      "Tenero"
    );
    expect(screen.getByTitle("Search")).toBeEnabled();
  });

  it("pre-populates from stored lakeLabel", async () => {
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.getState().setCourseData({
        ...cd,
        lakeLabel: "Lake Zurich",
      });
    });
    render(<LakeSearch map={mockMap} />);
    await expand();
    expect(
      screen.getByPlaceholderText("Search for a lake or region...")
    ).toHaveValue("Lake Zurich");
  });

  it("Enter with no services does not crash", async () => {
    render(<LakeSearch map={mockMap} />);
    await expand();
    const input = screen.getByPlaceholderText(
      "Search for a lake or region..."
    );
    await userEvent.type(input, "Tenero");
    await userEvent.keyboard("{Enter}");
    expect(mockSetCenter).not.toHaveBeenCalled();
    expect(mockSetZoom).not.toHaveBeenCalled();
  });
});

describe("LakeSearch dirty-flag on lake selection", () => {
  it("setCourseData alone sets isDirty to false", () => {
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.getState().setCourseData({
        ...cd,
        lakeLatLng: "46.8182,8.2275",
      });
    });
    expect(useCourseStore.getState().isDirty).toBe(false);
  });

  it("setDirty(true) after setCourseData makes the change persist", () => {
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.getState().setCourseData({
        ...cd,
        lakeLatLng: "46.8182,8.2275",
      });
      useCourseStore.getState().setDirty(true);
    });
    expect(useCourseStore.getState().isDirty).toBe(true);
    expect(useCourseStore.getState().courseData.lakeLatLng).toBe(
      "46.8182,8.2275"
    );
  });
});
