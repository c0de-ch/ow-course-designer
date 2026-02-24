"use client";

import { useState } from "react";

interface ExportPanelProps {
  courseId: string;
}

export function ExportPanel({ courseId }: ExportPanelProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleShare() {
    setExporting("share");
    try {
      const res = await fetch(`/api/courses/${courseId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("Share failed");
      const data = await res.json();
      setShareUrl(data.url);
    } finally {
      setExporting(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  function downloadFrom(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.click();
  }

  return (
    <div className="p-2 border-t border-base-300">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide px-2 py-1">
        Export
      </p>

      <button
        onClick={() => downloadFrom(`/api/courses/${courseId}/export/gpx`)}
        className="btn btn-ghost btn-sm justify-start gap-2 w-full font-normal"
      >
        <span className="text-base">📍</span> GPX
      </button>

      <button
        onClick={() => downloadFrom(`/api/courses/${courseId}/export/kml`)}
        className="btn btn-ghost btn-sm justify-start gap-2 w-full font-normal"
      >
        <span className="text-base">🌍</span> KML
      </button>

      <button
        onClick={async () => {
          setExporting("pdf");
          downloadFrom(`/api/courses/${courseId}/export/pdf`);
          setTimeout(() => setExporting(null), 3000);
        }}
        disabled={exporting === "pdf"}
        className="btn btn-ghost btn-sm justify-start gap-2 w-full font-normal"
      >
        <span className="text-base">📄</span>
        {exporting === "pdf" ? "Generating…" : "PDF"}
      </button>

      <button
        onClick={async () => {
          setExporting("png");
          downloadFrom(`/api/courses/${courseId}/export/png`);
          setTimeout(() => setExporting(null), 3000);
        }}
        disabled={exporting === "png"}
        className="btn btn-ghost btn-sm justify-start gap-2 w-full font-normal"
      >
        <span className="text-base">🖼</span>
        {exporting === "png" ? "Generating…" : "PNG"}
      </button>

      <button
        onClick={handleShare}
        disabled={exporting === "share"}
        className="btn btn-ghost btn-sm justify-start gap-2 w-full font-normal"
      >
        <span className="text-base">🔗</span>
        {exporting === "share" ? "Creating…" : "Share link"}
      </button>

      {shareUrl && (
        <div className="mt-2 p-2 bg-base-200 rounded text-xs break-all">
          <p className="font-medium mb-1">Share URL:</p>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="input input-xs w-full mb-2 text-base-content/70 bg-base-100"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={copyShareUrl}
            className="btn btn-xs btn-outline w-full"
          >
            {copying ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
