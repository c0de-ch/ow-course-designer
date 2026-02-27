"use client";

import { useState } from "react";
import { useCourseStore, type ElementType } from "@/store/courseStore";

type ExportFormat = "gpx" | "kml" | "csv" | "pdf" | "png";

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: string;
}

const FORMATS: FormatOption[] = [
  { id: "gpx", label: "GPX", description: "GPS exchange format for navigation apps", icon: "📍" },
  { id: "kml", label: "KML", description: "Google Earth / Maps format", icon: "🌍" },
  { id: "csv", label: "Coordinates (CSV)", description: "Spreadsheet with marker positions", icon: "📋" },
  { id: "pdf", label: "PDF", description: "Printable map document", icon: "📄" },
  { id: "png", label: "PNG", description: "Map image for presentations", icon: "🖼" },
];

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

interface ExportModalProps {
  courseId: string;
  onClose: () => void;
}

export function ExportModal({ courseId, onClose }: ExportModalProps) {
  const [selected, setSelected] = useState<ExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const courseData = useCourseStore((s) => s.courseData);

  function downloadFrom(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadCsv() {
    const elements = [...courseData.elements]
      .filter((el) => el.type !== "rescue_zone")
      .sort((a, b) => a.order - b.order);

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

  async function handleExport() {
    if (!selected) return;
    setError(null);

    try {
      if (selected === "csv") {
        downloadCsv();
        onClose();
        return;
      }

      if (selected === "gpx" || selected === "kml") {
        downloadFrom(`/api/courses/${courseId}/export/${selected}`);
        onClose();
        return;
      }

      // PDF and PNG are slow — show spinner
      setExporting(true);
      downloadFrom(`/api/courses/${courseId}/export/${selected}`);
      // Give the browser a moment to start the download
      setTimeout(() => {
        setExporting(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError((err as Error).message || "Export failed");
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-black/50 rounded-2xl shadow-2xl ring-1 ring-white/15 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold">Export Course</h3>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle text-base-content/40 hover:text-base-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Format list */}
        <div className="px-6 pb-4">
          <div className="flex flex-col gap-1">
            {FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelected(fmt.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100 cursor-pointer ${
                  selected === fmt.id
                    ? "bg-primary/15 ring-2 ring-primary/50"
                    : "hover:bg-base-200/60"
                }`}
              >
                <span className="text-lg w-7 text-center shrink-0 opacity-70">{fmt.icon}</span>
                <div className="min-w-0 flex-1 whitespace-nowrap">
                  <span className="font-medium text-sm">{fmt.label}</span>
                  <span className="text-xs text-base-content/45 ml-2">{fmt.description}</span>
                </div>
                {selected === fmt.id && (
                  <svg className="shrink-0 text-primary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-error/10 border border-error/20 rounded-lg p-3 text-sm text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-base-200">
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!selected || exporting}
            className="btn btn-sm btn-primary"
          >
            {exporting ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
