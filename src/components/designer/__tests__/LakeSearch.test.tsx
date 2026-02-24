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
        // Never resolves → services are never constructed
        importLibrary: jest.fn(() => new Promise(() => {})),
      },
    },
  });
});

beforeEach(() => {
  mockSetCenter.mockClear();
  mockSetZoom.mockClear();
  mockMap = freshMockMap();
  // Reset store to clean state before each test
  act(() => {
    useCourseStore.getState().resetCourse();
  });
});

// ---------------------------------------------------------------------------
// Helper — set lakeLatLng in the store (simulates loading a course)
// ---------------------------------------------------------------------------
function setLakeLatLng(value: string | null) {
  act(() => {
    const cd = useCourseStore.getState().courseData;
    useCourseStore.getState().setCourseData({ ...cd, lakeLatLng: value });
  });
}

// ===========================================================================
// parseLakeLatLng — pure function tests
// ===========================================================================
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

// ===========================================================================
// LakeSearch component — button disabled/enabled state
// ===========================================================================
describe("LakeSearch center button", () => {
  it("is disabled when map is null and lakeLatLng is null", () => {
    render(<LakeSearch map={null} />);
    expect(screen.getByTitle("Center map on lake")).toBeDisabled();
  });

  it("is disabled when map is provided but lakeLatLng is null", () => {
    render(<LakeSearch map={mockMap} />);
    expect(screen.getByTitle("Center map on lake")).toBeDisabled();
  });

  it("is disabled when lakeLatLng is set but map is null", () => {
    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={null} />);
    expect(screen.getByTitle("Center map on lake")).toBeDisabled();
  });

  it("is enabled when both map and lakeLatLng are set", () => {
    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={mockMap} />);
    expect(screen.getByTitle("Center map on lake")).toBeEnabled();
  });

  it("becomes enabled when lakeLatLng is set after initial render", () => {
    const { rerender } = render(<LakeSearch map={mockMap} />);
    expect(screen.getByTitle("Center map on lake")).toBeDisabled();

    // Simulate a lake being selected
    setLakeLatLng("46.8182,8.2275");
    rerender(<LakeSearch map={mockMap} />);

    expect(screen.getByTitle("Center map on lake")).toBeEnabled();
  });
});

// ===========================================================================
// LakeSearch component — click centres the map
// ===========================================================================
describe("LakeSearch center button click", () => {
  it("calls map.setCenter with parsed coordinates", async () => {
    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={mockMap} />);

    await userEvent.click(screen.getByTitle("Center map on lake"));

    expect(mockSetCenter).toHaveBeenCalledTimes(1);
    expect(mockSetCenter).toHaveBeenCalledWith({ lat: 46.8182, lng: 8.2275 });
  });

  it("calls map.setZoom(14)", async () => {
    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={mockMap} />);

    await userEvent.click(screen.getByTitle("Center map on lake"));

    expect(mockSetZoom).toHaveBeenCalledTimes(1);
    expect(mockSetZoom).toHaveBeenCalledWith(14);
  });

  it("calls setCenter before setZoom (deterministic order)", async () => {
    const callOrder: string[] = [];
    mockSetCenter.mockImplementation(() => callOrder.push("setCenter"));
    mockSetZoom.mockImplementation(() => callOrder.push("setZoom"));

    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={mockMap} />);

    await userEvent.click(screen.getByTitle("Center map on lake"));

    expect(callOrder).toEqual(["setCenter", "setZoom"]);
  });

  it("does not call map methods when lakeLatLng is unparseable", async () => {
    // "bad,data" is truthy so the button is enabled, but parseLakeLatLng
    // returns null and the handler returns early.
    setLakeLatLng("bad,data");
    render(<LakeSearch map={mockMap} />);

    await userEvent.click(screen.getByTitle("Center map on lake"));

    expect(mockSetCenter).not.toHaveBeenCalled();
    expect(mockSetZoom).not.toHaveBeenCalled();
  });

  it("reads lakeLatLng from the store at click time, not render time", async () => {
    // Start with one lake
    setLakeLatLng("46.8182,8.2275");
    render(<LakeSearch map={mockMap} />);

    // Update the store to a different lake before clicking
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.setState({
        courseData: { ...cd, lakeLatLng: "47.0,9.0" },
      });
    });

    await userEvent.click(screen.getByTitle("Center map on lake"));

    // Should use the latest store value (47.0, 9.0), not the render-time one
    expect(mockSetCenter).toHaveBeenCalledWith({ lat: 47.0, lng: 9.0 });
  });
});

// ===========================================================================
// LakeSearch — lake selection marks the store dirty so it auto-saves
// ===========================================================================
describe("LakeSearch dirty-flag on lake selection", () => {
  it("setCourseData alone sets isDirty to false", () => {
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.getState().setCourseData({
        ...cd,
        lakeLatLng: "46.8182,8.2275",
      });
    });
    // setCourseData is designed for loading from server — isDirty must be false
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

// ===========================================================================
// LakeSearch — search input
// ===========================================================================
describe("LakeSearch search input", () => {
  it("renders with placeholder text", () => {
    render(<LakeSearch map={mockMap} />);
    expect(
      screen.getByPlaceholderText("Search for a lake or region...")
    ).toBeInTheDocument();
  });

  it("search button is disabled when input is empty", () => {
    render(<LakeSearch map={mockMap} />);
    expect(screen.getByTitle("Search")).toBeDisabled();
  });

  it("search button is enabled when input has text", async () => {
    render(<LakeSearch map={mockMap} />);
    await userEvent.type(
      screen.getByPlaceholderText("Search for a lake or region..."),
      "Tenero"
    );
    expect(screen.getByTitle("Search")).toBeEnabled();
  });

  it("pre-populates from stored lakeLabel", () => {
    act(() => {
      const cd = useCourseStore.getState().courseData;
      useCourseStore.getState().setCourseData({
        ...cd,
        lakeLabel: "Lake Zurich",
      });
    });
    render(<LakeSearch map={mockMap} />);
    expect(
      screen.getByPlaceholderText("Search for a lake or region...")
    ).toHaveValue("Lake Zurich");
  });

  it("Enter with no services does not crash", async () => {
    render(<LakeSearch map={mockMap} />);
    const input = screen.getByPlaceholderText(
      "Search for a lake or region..."
    );
    await userEvent.type(input, "Tenero");
    await userEvent.keyboard("{Enter}");
    // No error thrown, no map methods called
    expect(mockSetCenter).not.toHaveBeenCalled();
    expect(mockSetZoom).not.toHaveBeenCalled();
  });
});
