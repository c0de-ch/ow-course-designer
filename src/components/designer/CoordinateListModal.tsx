"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useCourseStore, getBuoyNumbers, buoyName, type CourseElement, type ElementType } from "@/store/courseStore";
import { buildGpx } from "@/lib/gpx-builder";
import { IconClose } from "@/components/ui/icons";

const TYPE_LABELS: Record<ElementType, string> = {
  buoy: "Buoy",
  start: "Start",
  finish: "Finish",
  finish_left: "Finish Left",
  finish_right: "Finish Right",
  finish_endpoint: "Finish Endpoint",
  finish_funnel_left: "Finish Funnel Left",
  finish_funnel_right: "Finish Funnel Right",
  gate_left: "Gate Left",
  gate_right: "Gate Right",
  shore_entry: "Shore Entry",
  rescue_zone: "Rescue Zone",
  feeding_platform: "Feeding Platform",
  freehand: "Drawing",
};

/** Degrees and decimal minutes, as marine GPS units show them: N 46° 01.234' */
export function formatDegMin(value: number, axis: "lat" | "lng"): string {
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.round((abs - deg) * 60 * 1000) / 1000;
  if (min >= 60) { deg += 1; min = 0; }
  const degStr = String(deg).padStart(axis === "lat" ? 2 : 3, "0");
  return `${hemi} ${degStr}° ${min.toFixed(3).padStart(6, "0")}'`;
}

interface CoordinateRow {
  el: CourseElement;
  name: string;
}

/** Point marks in route order; turn buoys numbered like on the map (Buoy 1, 2, …) */
export function coordinateRows(elements: CourseElement[]): CoordinateRow[] {
  const numbers = getBuoyNumbers(elements);
  return [...elements]
    .filter((el) => el.type !== "rescue_zone" && el.type !== "freehand")
    .sort((a, b) => a.order - b.order)
    .map((el) => ({ el, name: el.type === "buoy" ? buoyName({ ...el, label: null }, numbers, elements) : TYPE_LABELS[el.type] }));
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface CoordinateListModalProps {
  onClose: () => void;
}

export function CoordinateListModal({ onClose }: CoordinateListModalProps) {
  const courseData = useCourseStore((s) => s.courseData);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rows = coordinateRows(courseData.elements);
  const baseName = courseData.name.replace(/[^a-z0-9]/gi, "_");
  const csv = (v: string) => `"${v.replace(/"/g, '""')}"`;

  function copy(row: CoordinateRow) {
    navigator.clipboard?.writeText(`${row.el.lat.toFixed(6)}, ${row.el.lng.toFixed(6)}`).then(() => {
      setCopiedId(row.el.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function handleDownloadCsv() {
    const header = "#,Mark,Label,Latitude,Longitude,Latitude (DM),Longitude (DM)";
    const lines = rows.map(({ el, name }, i) =>
      [
        i + 1,
        name,
        el.label ? csv(el.label) : "",
        el.lat.toFixed(6),
        el.lng.toFixed(6),
        csv(formatDegMin(el.lat, "lat")),
        csv(formatDegMin(el.lng, "lng")),
      ].join(",")
    );
    download(`${baseName}_coordinates.csv`, [header, ...lines].join("\n"), "text/csv;charset=utf-8;");
  }

  function handleDownloadGpx() {
    // Waypoint names as listed here, so a GPS shows "Buoy 3" rather than "buoy"
    const named = rows.map(({ el, name }) => ({ ...el, label: el.label ? `${name} – ${el.label}` : name }));
    download(`${baseName}_waypoints.gpx`, buildGpx(courseData.name, named), "application/gpx+xml");
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString();
    const h = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rowsHtml = rows
      .map(
        ({ el, name }, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${h(name)}</td>
            <td>${h(el.label ?? "")}</td>
            <td>${el.lat.toFixed(6)}</td>
            <td>${el.lng.toFixed(6)}</td>
            <td>${formatDegMin(el.lat, "lat")} ${formatDegMin(el.lng, "lng")}</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Coordinates — ${h(courseData.name)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2cm; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 13px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  td:nth-child(n+4), th:nth-child(n+4) { font-family: monospace; }
  @media print { body { margin: 1cm; } }
</style></head><body>
<h1>${h(courseData.name)}</h1>
<div class="sub">${courseData.lakeLabel ? h(courseData.lakeLabel) + " — " : ""}${date} — WGS84</div>
<table>
  <thead><tr><th>#</th><th>Mark</th><th>Label</th><th>Latitude</th><th>Longitude</th><th>Degrees, minutes</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.addEventListener("afterprint", () => w.close());
      w.print();
    }
  }

  // Portal: opened from the sidebar, but covers the whole page
  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinates-title"
    >
      <div className="bg-base-100 text-base-content rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h3 id="coordinates-title" className="text-lg font-semibold">GPS Coordinates</h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              {courseData.name}
              {courseData.lakeLabel ? ` — ${courseData.lakeLabel}` : ""} · WGS84
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-base-content" aria-label="Close" autoFocus>
            <IconClose />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-4">
          {rows.length === 0 ? (
            <p className="text-sm text-base-content/50 py-8 text-center">
              No elements placed yet.
            </p>
          ) : (
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Mark</th>
                  <th>Label</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Degrees, minutes</th>
                  <th className="w-16"><span className="sr-only">Copy</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.el.id}>
                    <td className="text-base-content/50">{i + 1}</td>
                    <td className="whitespace-nowrap">{row.name}</td>
                    <td className="text-base-content/60">{row.el.label ?? ""}</td>
                    <td className="font-mono text-sm">{row.el.lat.toFixed(6)}</td>
                    <td className="font-mono text-sm">{row.el.lng.toFixed(6)}</td>
                    <td className="font-mono text-xs text-base-content/60 whitespace-nowrap">
                      {formatDegMin(row.el.lat, "lat")}<br />{formatDegMin(row.el.lng, "lng")}
                    </td>
                    <td>
                      <button onClick={() => copy(row)} className="btn btn-xs btn-ghost" title="Copy latitude, longitude">
                        {copiedId === row.el.id ? "Copied" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-base-200">
          <button onClick={handleDownloadCsv} disabled={rows.length === 0} className="btn btn-sm btn-primary">
            Download CSV
          </button>
          <button onClick={handleDownloadGpx} disabled={rows.length === 0} className="btn btn-sm btn-outline" title="Waypoints for a handheld or boat GPS">
            Download GPX
          </button>
          <button onClick={handlePrint} disabled={rows.length === 0} className="btn btn-sm btn-ghost">
            Print / PDF
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
