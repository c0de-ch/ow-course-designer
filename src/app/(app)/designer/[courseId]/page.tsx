"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/store/courseStore";
import { DesignerCanvas } from "@/components/designer/DesignerCanvas";
import { ToolPanel } from "@/components/designer/ToolPanel";
import { RoutePanel } from "@/components/designer/RoutePanel";
import { ExportPanel } from "@/components/designer/ExportPanel";
import { VersionTag } from "@/components/ui/VersionTag";
import Link from "next/link";
import { IconAlert, IconArrowLeft, IconCheck, IconCloud, IconMenu, IconPencil } from "@/components/ui/icons";

interface Props {
  params: Promise<{ courseId: string }>;
}

export default function DesignerPage({ params }: Props) {
  const { courseId } = use(params);
  const router = useRouter();
  const { courseData, isDirty, autoSaveEnabled, setAutoSaveEnabled, setCourseData, setDirty, setLastSavedAt, setStatusMessage, lastSavedAt, statusMessage } = useCourseStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // null, or why the last save failed
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load course on mount
  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setCourseData({
          id: data.id,
          name: data.name,
          lakeLabel: data.lakeLabel,
          lakeLatLng: data.lakeLatLng,
          zoomLevel: data.zoomLevel,
          distanceKm: data.distanceKm,
          elements: data.elements,
          laps: data.laps ?? 1,
          raceLabel: data.raceLabel ?? null,
          raceLogo: data.raceLogo ?? null,
        });
        setCourseName(data.name);
        setLoading(false);
      })
      .catch(() => router.push("/dashboard"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Auto-save with debounce
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || loading) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCourse();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, courseData, autoSaveEnabled]);

  // Collapse the sidebar by default on small screens so the map stays usable
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);

  // Warn before leaving with changes that are not saved yet
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function saveCourse() {
    setSaving(true);
    setStatusMessage("Saving...");
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: courseData.name,
          lakeLabel: courseData.lakeLabel,
          lakeLatLng: courseData.lakeLatLng,
          zoomLevel: courseData.zoomLevel,
          distanceKm: courseData.distanceKm,
          elements: courseData.elements,
          laps: courseData.laps,
          raceLabel: courseData.raceLabel,
          raceLogo: courseData.raceLogo,
        }),
      });
      if (!res.ok) {
        setSaveError(`Not saved, the server refused it (${res.status})`);
        return;
      }
      setDirty(false);
      setSaveError(null);
      setLastSavedAt(new Date());
    } catch {
      setSaveError("Not saved, check your connection");
    } finally {
      setStatusMessage(null);
      setSaving(false);
    }
  }

  function startRename() {
    setNameDraft(courseData.name || "");
    setEditingName(true);
  }

  function commitRename() {
    setEditingName(false);
    const newName = nameDraft.trim();
    if (!newName || newName === courseData.name) return;
    setCourseData({ ...courseData, name: newName });
    setCourseName(newName);
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-dvh bg-base-200 text-sm text-base-content/60">
        <span className="loading loading-spinner loading-lg" />
        Loading course…
      </div>
    );
  }

  const savedAt = lastSavedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-dvh bg-base-100">
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-14 bg-base-100 border-b border-base-300 z-20 shrink-0">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="btn btn-ghost btn-sm btn-circle md:hidden"
          aria-label={sidebarOpen ? "Hide tools" : "Show tools"}
          aria-expanded={sidebarOpen}
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" className="btn btn-ghost btn-sm gap-1.5" title="Back to my courses" aria-label="Back to dashboard">
          <IconArrowLeft size={16} />
          <span className="hidden sm:inline">My courses</span>
        </Link>

        <div className="h-6 w-px bg-base-300 hidden sm:block" />

        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditingName(false);
            }}
            maxLength={120}
            aria-label="Course name"
            className="input input-sm input-bordered font-semibold w-full max-w-xs"
          />
        ) : (
          <button
            onClick={startRename}
            className="group flex items-center gap-2 min-w-0 rounded-md px-2 py-1 hover:bg-base-200 transition-colors"
            title="Rename course"
            aria-label={`Course name: ${courseName || "Untitled Course"}. Click to rename.`}
          >
            <span className="font-semibold truncate max-w-[40vw] sm:max-w-xs">
              {courseName || "Untitled Course"}
            </span>
            <IconPencil size={14} className="shrink-0 text-base-content/40 group-hover:text-base-content/70" />
          </button>
        )}

        <div className="flex-1" />

        {/* Save status */}
        <span
          className={`hidden sm:flex items-center gap-1.5 text-xs ${saveError ? "text-red-600" : "text-base-content/55"}`}
          role="status"
          aria-live="polite"
        >
          {saveError ? (
            <><IconAlert size={14} /> {saveError}</>
          ) : saving || statusMessage ? (
            <><span className="loading loading-xs" /> Saving…</>
          ) : isDirty ? (
            <><IconCloud size={14} /> Unsaved changes</>
          ) : savedAt ? (
            <><IconCheck size={14} className="text-green-600" /> Saved {savedAt}</>
          ) : null}
        </span>

        {/* Auto-save toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs" title="Save automatically 2 seconds after each change">
          <span className="text-base-content/60 hidden sm:inline">Auto-save</span>
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={autoSaveEnabled}
            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            aria-label="Auto-save"
          />
        </label>

        {(!autoSaveEnabled || saveError) && (
          <button
            onClick={saveCourse}
            disabled={saving || (!isDirty && !saveError)}
            className="btn btn-sm btn-primary"
            aria-label={saving ? "Saving course" : "Save course"}
          >
            {saving ? "Saving…" : saveError ? "Retry" : "Save"}
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar */}
        <aside
          // Slides with `left`, not a transform: a transform would trap the
          // fixed-position dialogs (export, share, flyover) inside the sidebar.
          className={`w-64 bg-base-100 border-r border-base-300 flex flex-col overflow-y-auto z-30 shrink-0
            absolute inset-y-0 md:static transition-[left] duration-200 shadow-xl md:shadow-none
            ${sidebarOpen ? "left-0" : "-left-64"}`}
          aria-label="Designer controls"
        >
          <ToolPanel />
          <RoutePanel />
          <div className="flex-1" />
          <ExportPanel courseId={courseId} />
          <p className="px-4 py-2 border-t border-base-300 text-xs text-base-content/50">
            <VersionTag />
          </p>
        </aside>
        {sidebarOpen && (
          <div
            className="absolute inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Map canvas */}
        <main className="flex-1 relative overflow-hidden">
          <DesignerCanvas />
        </main>
      </div>
    </div>
  );
}
