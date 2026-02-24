"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useCourseStore } from "@/store/courseStore";
import { DesignerCanvas } from "@/components/designer/DesignerCanvas";
import { ToolPanel } from "@/components/designer/ToolPanel";
import { RoutePanel } from "@/components/designer/RoutePanel";
import { ExportPanel } from "@/components/designer/ExportPanel";
import { StatusBar } from "@/components/designer/StatusBar";
import Link from "next/link";

interface Props {
  params: Promise<{ courseId: string }>;
}

export default function DesignerPage({ params }: Props) {
  const { courseId } = use(params);
  const router = useRouter();
  const { courseData, isDirty, autoSaveEnabled, setCourseData, setDirty, setLastSavedAt, setStatusMessage } = useCourseStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseName, setCourseName] = useState("");
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

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function saveCourse() {
    setSaving(true);
    setStatusMessage("Saving...");
    try {
      await fetch(`/api/courses/${courseId}`, {
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
        }),
      });
      setDirty(false);
      setLastSavedAt(new Date());
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    const newName = window.prompt("Course name:", courseData.name);
    if (!newName || newName === courseData.name) return;
    setCourseData({ ...courseData, name: newName });
    setCourseName(newName);
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-base-100 border-b border-base-300 z-20">
        <Link href="/dashboard" className="btn btn-ghost btn-sm">
          ← Dashboard
        </Link>

        <button
          onClick={handleRename}
          className="text-base font-semibold hover:underline cursor-pointer truncate max-w-xs"
          title="Click to rename"
        >
          {courseName || "Untitled Course"}
        </button>

        <div className="flex-1" />

        <button
          onClick={saveCourse}
          disabled={saving || !isDirty}
          className="btn btn-sm btn-primary"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-48 bg-base-100 border-r border-base-300 flex flex-col overflow-y-auto z-10">
          <ToolPanel />
          <RoutePanel />
          <div className="flex-1" />
          <ExportPanel courseId={courseId} />
        </aside>

        {/* Map canvas */}
        <main className="flex-1 relative overflow-hidden">
          <DesignerCanvas />
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
