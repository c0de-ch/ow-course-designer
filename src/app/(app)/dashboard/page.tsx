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

/** Race photo used for the side images and, blurred, as the water behind the glass */
const PHOTO = "/hero-bg.webp";

/** Focus point of the side image on the photo (1920×1440): the turn buoy */
const BUOY_FOCUS = { backgroundPosition: "36% 52%" } satisfies React.CSSProperties;

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

  const countLabel = courses?.length
    ? `${courses.length} course${courses.length !== 1 ? "s" : ""}`
    : null;

  return (
    <div className="relative isolate min-h-dvh flex flex-col text-[#0C3440]">
      {/* The water: the race photo, blurred, behind every glass pane */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#14707A]" aria-hidden="true">
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center blur-3xl saturate-150"
          style={{ backgroundImage: `url('${PHOTO}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-[#14707A]/10 to-[#0C3440]/40" />
      </div>

      <AppHeader glass />

      <div className="w-full flex-1 max-w-7xl mx-auto px-3 sm:px-6 pt-5 pb-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        {/* Side image, cut from the race photo: swimmers rounding the turn buoy. A zoomed
            banner on phones; filling the tall side column on large screens */}
        <aside className="mb-5 lg:mb-0">
          <div className="lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:min-h-[30rem]">
            <div
              className="relative h-44 sm:h-56 lg:h-full rounded-[28px] overflow-hidden bg-no-repeat bg-[length:185%] lg:bg-cover ring-1 ring-white/40 shadow-xl shadow-[#0C3440]/20"
              style={{ backgroundImage: `url('${PHOTO}')`, ...BUOY_FOCUS }}
              role="img"
              aria-label="Swimmers rounding turn buoy 3 in a race"
            >
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0C3440]/70 to-transparent" />
              <div className="absolute left-4 right-4 bottom-4 sm:left-6 sm:bottom-6 flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-none">My courses</h1>
                  {countLabel && <p className="mt-2 text-sm text-white/80">{countLabel}</p>}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main>
          <div className="glass rounded-[28px] p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#0C3440]/75 pl-2 max-w-md">
              Open a course to keep designing, or start a new one for your next race.
            </p>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="btn rounded-full border-0 bg-[#FF5B1F] text-white hover:bg-[#E84A10] gap-2 px-5 shadow-md shadow-[#FF5B1F]/30"
              >
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
              className="glass rounded-[20px] p-5 mb-4"
            >
              <label htmlFor="new-course" className="block font-semibold mb-1">
                New course
              </label>
              <p className="text-sm text-[#0C3440]/70 mb-3">
                Give it a name, such as the race and the distance. You can change it later.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="new-course"
                  type="text"
                  className="input input-bordered flex-1 max-w-none bg-white/80 rounded-full"
                  placeholder="e.g. Lake Zurich 3.8 km"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setShowCreate(false)}
                  maxLength={120}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="btn rounded-full border-0 bg-[#FF5B1F] text-white hover:bg-[#E84A10] flex-1 sm:flex-none"
                  >
                    {createMut.isPending ? <span className="loading loading-sm text-white" /> : "Create and open"}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost rounded-full">
                    Cancel
                  </button>
                </div>
              </div>
              {createMut.isError && (
                <p className="text-sm text-red-700 mt-2" role="alert">
                  The course could not be created. Check your connection and try again.
                </p>
              )}
            </form>
          )}

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading courses">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass h-40 rounded-[20px] motion-safe:animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="glass rounded-[20px] p-8 text-center">
              <IconAlert size={28} className="mx-auto text-red-600 mb-2" />
              <p className="font-medium">Your courses could not be loaded.</p>
              <button onClick={() => refetch()} className="btn btn-sm rounded-full border-0 bg-[#0C3440] text-white mt-4">
                Try again
              </button>
            </div>
          ) : !courses?.length ? (
            <div className="glass rounded-[20px] px-6 py-14 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/70 text-[#14707A] flex items-center justify-center mb-4 ring-1 ring-white">
                <IconMap size={26} />
              </div>
              <h2 className="text-lg font-semibold">No courses yet</h2>
              <p className="text-sm text-[#0C3440]/70 mt-1 max-w-sm mx-auto">
                Create your first course, search for the lake, and start placing buoys. It saves automatically.
              </p>
              {!showCreate && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn rounded-full border-0 bg-[#FF5B1F] text-white hover:bg-[#E84A10] gap-2 mt-6"
                >
                  <IconPlus size={16} /> Create your first course
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {courses.map((course) => (
                <li
                  key={course.id}
                  className="glass group relative rounded-[20px] motion-safe:transition-[background-color,transform] hover:bg-white/75 motion-safe:hover:-translate-y-0.5"
                >
                  <Link
                    href={`/designer/${course.id}`}
                    className="flex flex-col h-full p-5 pr-12 rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5B1F]"
                  >
                    <h2 className="font-semibold text-[17px] leading-snug line-clamp-2">{course.name}</h2>
                    <p className="flex items-center gap-1 text-sm text-[#0C3440]/65 truncate mt-1 min-h-[1.25rem]">
                      {course.lakeLabel ? (
                        <>
                          <IconPin size={14} className="shrink-0" />
                          <span className="truncate">{course.lakeLabel}</span>
                        </>
                      ) : (
                        <span className="text-[#0C3440]/45">No lake chosen yet</span>
                      )}
                    </p>
                    <div className="flex items-end justify-between gap-3 mt-auto pt-6">
                      {course.distanceKm != null && course.distanceKm > 0 ? (
                        <span className="text-4xl font-bold tracking-tight tabular-nums leading-none text-[#14707A]">
                          {course.distanceKm.toFixed(2)}
                          <span className="text-base font-semibold text-[#0C3440]/50 ml-1">km</span>
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-[#0C3440]/45">No route yet</span>
                      )}
                      <span className="text-xs text-[#0C3440]/55 whitespace-nowrap">Edited {formatUpdated(course.updatedAt)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      if (deleteMut.isPending) return;
                      if (window.confirm(`Delete "${course.name}"? This cannot be undone.`)) deleteMut.mutate(course.id);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full text-[#0C3440]/40 hover:text-red-600 hover:bg-white/80 transition-colors"
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
      </div>
      <AppFooter className="max-w-7xl text-white/80" />
    </div>
  );
}
