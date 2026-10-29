"use client";

import { useEffect, useRef, useState } from "react";
import { FlyoverModal } from "./FlyoverModal";
import { ExportModal } from "./ExportModal";
import { IconClose, IconDownload, IconLink, IconVideo } from "@/components/ui/icons";

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
  /** The course's latest flyover video, rendered on the server; attached to share links */
  const flyoverUrlRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/flyover/render`)
      .then((r) => (r.ok ? r.json() : null))
      .then((job) => { if (job?.status === "done" && job.url) handleVideoReady(job.url); })
      .catch(() => {});
  }, [courseId]);

  async function handleShare() {
    setShowShareModal(true);
    setShareUrl(null);
    setShareShortUrl(null);
    setShareError(null);
    setShareStep("Creating share link...");

    try {
      // The flyover video is already on the server once rendered
      const flyoverUrl = flyoverUrlRef.current ?? undefined;

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

  function handleVideoReady(url: string) {
    flyoverUrlRef.current = url;
    setHasFlyover(true);
  }

  return (
    <div className="p-3 border-t border-base-300">
      <p className="side-heading">Share &amp; export</p>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => setShowExportModal(true)}
          aria-label="Open export dialog"
          className="btn btn-sm h-9 btn-ghost justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="w-6 flex justify-center" aria-hidden="true"><IconDownload /></span>
          <span>Export (PDF, GPX, …)</span>
        </button>

        <button
          onClick={() => setShowFlyover(true)}
          aria-label={hasFlyover ? "Preview the flyover or create a new video (video ready)" : "Preview the flyover or create a video"}
          className="btn btn-sm h-9 btn-ghost justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="w-6 flex justify-center" aria-hidden="true"><IconVideo /></span>
          <span>Flyover Video</span>
          {hasFlyover && <span className="badge badge-xs badge-success ml-auto">ready</span>}
        </button>

        <button
          onClick={handleShare}
          aria-label={hasFlyover ? "Share course with flyover" : "Generate shareable link"}
          className="btn btn-sm h-9 btn-primary justify-start gap-3 w-full font-normal transition-all duration-150"
        >
          <span className="w-6 flex justify-center" aria-hidden="true"><IconLink /></span>
          <span>{hasFlyover ? "Share link (+ flyover)" : "Share link"}</span>
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
          courseId={courseId}
          onClose={() => setShowFlyover(false)}
          onVideoReady={handleVideoReady}
        />
      )}

      {/* Share modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowShareModal(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowShareModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-title"
        >
          <div className="bg-base-100 text-base-content rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h3 id="share-title" className="text-lg font-semibold">Share course</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-base-content"
                aria-label="Close share dialog"
                autoFocus
              >
                <IconClose />
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
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700" role="alert">
                    {shareError}
                  </div>
                  <p className="text-xs text-base-content/55">
                    Make sure the course is saved and you are still signed in, then try again.
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
                    Anyone with this link can view the course and download it as PDF, GPX or KML.
                    The link shows the course as it is now; share again after changes.
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
