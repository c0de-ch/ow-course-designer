"use client";

import { useRef, useState } from "react";
import { FlyoverModal } from "./FlyoverModal";
import { ExportModal } from "./ExportModal";

interface ExportPanelProps {
  courseId: string;
}

export function ExportPanel({ courseId }: ExportPanelProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareShortUrl, setShareShortUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareStep, setShareStep] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [showFlyover, setShowFlyover] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasFlyover, setHasFlyover] = useState(false);
  const flyoverBlobRef = useRef<Blob | null>(null);

  async function handleShare() {
    setShowShareModal(true);
    setShareUrl(null);
    setShareShortUrl(null);
    setShareError(null);
    setShareStep("Creating share link...");

    try {
      // If a flyover video was recorded, upload it first
      let flyoverUrl: string | undefined;
      if (flyoverBlobRef.current) {
        setShareStep("Uploading flyover video...");
        const formData = new FormData();
        formData.append("video", flyoverBlobRef.current, "flyover.webm");
        const uploadRes = await fetch(`/api/courses/${courseId}/flyover`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          flyoverUrl = uploadData.url;
        }
      }

      setShareStep("Generating snapshot...");
      const shareBody: Record<string, string> = {};
      if (flyoverUrl) shareBody.flyoverUrl = flyoverUrl;

      const res = await fetch(`/api/courses/${courseId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shareBody),
      });

      if (!res.ok) {
        let msg = `Server returned ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) msg = errData.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const data = await res.json();
      setShareUrl(data.url);
      setShareShortUrl(data.shortUrl ?? null);
      setShareStep(null);
    } catch (err) {
      setShareError((err as Error).message || "Something went wrong");
      setShareStep(null);
    }
  }

  async function copyShareUrl() {
    const urlToCopy = shareShortUrl || shareUrl;
    if (!urlToCopy) return;
    try {
      await navigator.clipboard.writeText(urlToCopy);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = urlToCopy;
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

  function handleVideoReady(blob: Blob) {
    flyoverBlobRef.current = blob;
    setHasFlyover(true);
  }

  return (
    <div className="p-3 border-t border-base-300">
      <p className="text-sm font-bold text-base-content/70 uppercase tracking-wide px-2 py-1">
        Actions
      </p>

      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setShowExportModal(true)}
          className="btn btn-primary justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="text-lg w-6 text-center">📦</span>
          <span>Export</span>
        </button>

        <button
          onClick={() => setShowFlyover(true)}
          className="btn btn-ghost justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="text-lg w-6 text-center">🎬</span>
          <span>Flyover Video</span>
          {hasFlyover && <span className="badge badge-xs badge-success ml-auto">ready</span>}
        </button>

        <button
          onClick={handleShare}
          className="btn btn-ghost justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="text-lg w-6 text-center">🔗</span>
          <span>{hasFlyover ? "Share (+ flyover)" : "Share Link"}</span>
        </button>
      </div>

      {showExportModal && (
        <ExportModal
          courseId={courseId}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showFlyover && (
        <FlyoverModal
          onClose={() => setShowFlyover(false)}
          onVideoReady={handleVideoReady}
        />
      )}

      {/* Share modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-black/50 rounded-2xl shadow-2xl ring-1 ring-white/15 w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h3 className="text-lg font-semibold">Share Course</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="btn btn-sm btn-ghost btn-circle text-base-content/40 hover:text-base-content"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-6 pb-6">
              {/* Loading state */}
              {shareStep && !shareUrl && !shareError && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className="loading loading-spinner loading-lg text-primary" />
                  <p className="text-sm text-base-content/60 font-medium">{shareStep}</p>
                </div>
              )}

              {/* Error state */}
              {shareError && (
                <div className="space-y-4">
                  <div className="bg-error/10 border border-error/20 rounded-lg p-3 text-sm text-error">
                    {shareError}
                  </div>
                  <p className="text-xs text-base-content/45">
                    Make sure the course is saved and you are logged in. If running locally,
                    check that the database migration has been applied:{" "}
                    <code className="bg-base-200 px-1 rounded text-base-content/60">npx prisma migrate dev</code>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleShare} className="btn btn-sm btn-primary">
                      Retry
                    </button>
                    <button onClick={() => setShowShareModal(false)} className="btn btn-sm btn-ghost">
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Success state */}
              {shareUrl && (
                <div className="space-y-4">
                  <p className="text-sm text-base-content/60">
                    Your course is ready to share. Copy the link below:
                  </p>
                  <input
                    type="text"
                    readOnly
                    value={shareShortUrl || shareUrl}
                    className="input input-bordered w-full text-sm font-mono bg-base-200/50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={copyShareUrl}
                      className="btn btn-sm btn-primary flex-1"
                    >
                      {copying ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost"
                    >
                      Open
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
