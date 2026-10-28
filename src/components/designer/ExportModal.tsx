"use client";

import React, { useState } from "react";
import { useCourseStore, type ElementType } from "@/store/courseStore";
import { IconCheck, IconClose, IconFile, IconGlobe, IconImage, IconPin, IconTable } from "@/components/ui/icons";

type ExportFormat = "gpx" | "kml" | "csv" | "pdf" | "png";

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const FORMATS: FormatOption[] = [
  { id: "gpx", label: "GPX", description: "GPS exchange format for navigation apps", icon: <IconPin /> },
  { id: "kml", label: "KML", description: "Google Earth / Maps format", icon: <IconGlobe /> },
  { id: "csv", label: "Coordinates (CSV)", description: "Spreadsheet with marker positions", icon: <IconTable /> },
  { id: "pdf", label: "PDF", description: "Printable map document", icon: <IconFile /> },
  { id: "png", label: "PNG", description: "Map image for presentations", icon: <IconImage /> },
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
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div className="bg-base-100 text-base-content rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 id="export-title" className="text-lg font-semibold">Export course</h3>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-base-content" aria-label="Close" autoFocus>
            <IconClose />
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
                    ? "bg-sky-50 ring-2 ring-sky-500/60"
                    : "hover:bg-base-200"
                }`}
              >
                <span className={`w-7 flex justify-center shrink-0 ${selected === fmt.id ? "text-sky-600" : "text-base-content/50"}`}>{fmt.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{fmt.label}</div>
                  <div className="text-xs text-base-content/55">{fmt.description}</div>
                </div>
                {selected === fmt.id && (
                  <IconCheck size={16} className="shrink-0 text-sky-600" />
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700" role="alert">
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
