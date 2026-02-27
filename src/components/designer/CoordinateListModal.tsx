"use client";

import { useCourseStore, type ElementType } from "@/store/courseStore";

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

interface CoordinateListModalProps {
  onClose: () => void;
}

export function CoordinateListModal({ onClose }: CoordinateListModalProps) {
  const courseData = useCourseStore((s) => s.courseData);

  const elements = [...courseData.elements]
    .filter((el) => el.type !== "rescue_zone")
    .sort((a, b) => a.order - b.order);

  function handleDownloadCsv() {
    const header = "#,Type,Label,Latitude,Longitude";
    const rows = elements.map((el, i) => {
      const label = el.label ? `"${el.label.replace(/"/g, '""')}"` : "";
      return `${i + 1},${TYPE_LABELS[el.type]},${label},${el.lat.toFixed(6)},${el.lng.toFixed(6)}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}_coordinates.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString();
    const rowsHtml = elements
      .map(
        (el, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${TYPE_LABELS[el.type]}</td>
            <td>${el.label ?? ""}</td>
            <td>${el.lat.toFixed(6)}</td>
            <td>${el.lng.toFixed(6)}</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Coordinates — ${courseData.name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2cm; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 13px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  td:nth-child(4), td:nth-child(5), th:nth-child(4), th:nth-child(5) { font-family: monospace; }
  @media print { body { margin: 1cm; } }
</style></head><body>
<h1>${courseData.name}</h1>
<div class="sub">${courseData.lakeLabel ? courseData.lakeLabel + " — " : ""}${date}</div>
<table>
  <thead><tr><th>#</th><th>Type</th><th>Label</th><th>Latitude</th><th>Longitude</th></tr></thead>
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-black/50 rounded-2xl shadow-2xl ring-1 ring-white/15 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h3 className="text-lg font-semibold">GPS Coordinates</h3>
            <p className="text-xs text-base-content/45 mt-0.5">
              {courseData.name}
              {courseData.lakeLabel ? ` — ${courseData.lakeLabel}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle text-base-content/40 hover:text-base-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-4">
          {elements.length === 0 ? (
            <p className="text-sm text-base-content/45 py-8 text-center">
              No elements placed yet.
            </p>
          ) : (
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Type</th>
                  <th>Label</th>
                  <th className="font-mono">Latitude</th>
                  <th className="font-mono">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el, i) => (
                  <tr key={el.id}>
                    <td className="text-base-content/45">{i + 1}</td>
                    <td>{TYPE_LABELS[el.type]}</td>
                    <td className="text-base-content/60">{el.label ?? ""}</td>
                    <td className="font-mono text-sm">{el.lat.toFixed(6)}</td>
                    <td className="font-mono text-sm">{el.lng.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-base-200">
          <button
            onClick={handleDownloadCsv}
            disabled={elements.length === 0}
            className="btn btn-sm btn-primary"
          >
            Download CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={elements.length === 0}
            className="btn btn-sm btn-ghost"
          >
            Print / PDF
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
