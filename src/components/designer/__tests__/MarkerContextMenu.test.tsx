import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkerContextMenu } from "../MarkerContextMenu";
import { useCourseStore, getBuoySide, type CourseData } from "@/store/courseStore";

function seed() {
  useCourseStore.getState().setCourseData({
    name: "Test",
    lakeLabel: null,
    lakeLatLng: null,
    zoomLevel: 14,
    distanceKm: null,
    laps: 1,
    elements: [
      { id: "b1", type: "buoy", lat: 47.1, lng: 8.1, order: 0, label: "Old", metadata: null },
      { id: "s1", type: "start", lat: 47.2, lng: 8.2, order: 1, label: null, metadata: null },
    ],
  } as unknown as CourseData);
}

const el = (id: string) => useCourseStore.getState().courseData.elements.find((e) => e.id === id);

describe("MarkerContextMenu", () => {
  beforeEach(seed);

  it("saves the label on Enter and closes", async () => {
    const onClose = jest.fn();
    render(<MarkerContextMenu elementId="b1" x={10} y={10} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/buoy 1/i);
    expect(input).toHaveValue("Old");
    await userEvent.clear(input);
    await userEvent.type(input, "Turn A{Enter}");
    expect(el("b1")?.label).toBe("Turn A");
    expect(onClose).toHaveBeenCalled();
  });

  it("changes a buoy's swim side", async () => {
    render(<MarkerContextMenu elementId="b1" x={10} y={10} onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /left/i }));
    expect(getBuoySide(el("b1")?.metadata)).toBe("left");
  });

  it("shows no swim side for other markers", () => {
    render(<MarkerContextMenu elementId="s1" x={10} y={10} onClose={jest.fn()} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.queryByText(/swim side/i)).not.toBeInTheDocument();
  });

  it("deletes the marker", async () => {
    const onClose = jest.fn();
    render(<MarkerContextMenu elementId="b1" x={10} y={10} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(el("b1")).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = jest.fn();
    render(<MarkerContextMenu elementId="b1" x={10} y={10} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/buoy 1/i);
    await userEvent.type(input, " changed");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
