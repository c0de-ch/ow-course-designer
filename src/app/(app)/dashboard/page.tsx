"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AppHeader } from "@/components/ui/AppHeader";
import { AppFooter } from "@/components/ui/AppFooter";
import { IconAlert, IconMap, IconPin, IconPlus, IconTrash } from "@/components/ui/icons";

interface CourseListItem {
  id: string;
  name: string;
  lakeLabel: string | null;
  distanceKm: number | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchCourses(): Promise<CourseListItem[]> {
  const res = await fetch("/api/courses");
  if (!res.ok) throw new Error("Failed to load courses");
  return res.json();
}

async function createCourse(name: string): Promise<CourseListItem> {
  const res = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create course");
  return res.json();
}

async function deleteCourse(id: string): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete course");
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatUpdated(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin > -1) return "just now";
  if (diffMin > -60) return relativeTime.format(diffMin, "minute");
  if (diffMin > -60 * 24) return relativeTime.format(Math.round(diffMin / 60), "hour");
  if (diffMin > -60 * 24 * 7) return relativeTime.format(Math.round(diffMin / 1440), "day");
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [newCourseName, setNewCourseName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses,
  });

  const createMut = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setShowCreate(false);
      setNewCourseName("");
      router.push(`/designer/${course.id}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  const handleCreate = () => {
    const name = newCourseName.trim() || "Untitled Course";
    createMut.mutate(name);
  };

  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <AppHeader />

      <main className="w-full flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My courses</h1>
            {!!courses?.length && (
              <p className="text-sm text-base-content/60 mt-0.5">
                {courses.length} course{courses.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2">
              <IconPlus size={16} /> New course
            </button>
          )}
        </div>

        {showCreate && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="bg-base-100 rounded-xl shadow-sm ring-1 ring-base-300 p-5 mb-6"
          >
            <label htmlFor="new-course" className="block font-semibold mb-1">
              New course
            </label>
            <p className="text-sm text-base-content/60 mb-3">
              Give it a name, such as the race and the distance. You can change it later.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="new-course"
                type="text"
                className="input input-bordered flex-1 max-w-none"
                placeholder="e.g. Lake Zurich 3.8 km"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setShowCreate(false)}
                maxLength={120}
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" disabled={createMut.isPending} className="btn btn-primary flex-1 sm:flex-none">
                  {createMut.isPending ? <span className="loading loading-sm text-white" /> : "Create and open"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
            {createMut.isError && (
              <p className="text-sm text-red-600 mt-2" role="alert">
                The course could not be created. Please try again.
              </p>
            )}
          </form>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading courses">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-base-100 ring-1 ring-base-300 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-base-100 rounded-xl ring-1 ring-base-300 p-8 text-center">
            <IconAlert size={28} className="mx-auto text-red-500 mb-2" />
            <p className="font-medium">Your courses could not be loaded.</p>
            <button onClick={() => refetch()} className="btn btn-sm btn-primary mt-4">
              Try again
            </button>
          </div>
        ) : !courses?.length ? (
          <div className="bg-base-100 rounded-xl ring-1 ring-base-300 px-6 py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
              <IconMap size={26} />
            </div>
            <h2 className="text-lg font-semibold">No courses yet</h2>
            <p className="text-sm text-base-content/60 mt-1 max-w-sm mx-auto">
              Create your first course, search for the lake, and start placing buoys. It saves automatically.
            </p>
            {!showCreate && (
              <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2 mt-6">
                <IconPlus size={16} /> Create your first course
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li
                key={course.id}
                className="group relative bg-base-100 rounded-xl ring-1 ring-base-300 shadow-sm hover:shadow-md hover:ring-sky-300 transition-all"
              >
                <Link href={`/designer/${course.id}`} className="block p-5 pr-12 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  <h2 className="font-semibold truncate group-hover:text-sky-700">{course.name}</h2>
                  <p className="flex items-center gap-1 text-sm text-base-content/60 truncate mt-1 min-h-[1.25rem]">
                    {course.lakeLabel ? (
                      <>
                        <IconPin size={14} className="shrink-0" />
                        <span className="truncate">{course.lakeLabel}</span>
                      </>
                    ) : (
                      <span className="italic text-base-content/40">No location yet</span>
                    )}
                  </p>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-2xl font-bold text-sky-700 tabular-nums">
                      {course.distanceKm != null && course.distanceKm > 0 ? (
                        <>
                          {course.distanceKm.toFixed(2)}
                          <span className="text-sm font-medium text-base-content/50 ml-1">km</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-base-content/40">No route yet</span>
                      )}
                    </span>
                    <span className="text-xs text-base-content/50">Edited {formatUpdated(course.updatedAt)}</span>
                  </div>
                </Link>
                <button
                  onClick={() => {
                    if (deleteMut.isPending) return;
                    if (window.confirm(`Delete "${course.name}"? This cannot be undone.`)) deleteMut.mutate(course.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-lg text-base-content/40 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label={`Delete ${course.name}`}
                  title="Delete course"
                >
                  <IconTrash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
