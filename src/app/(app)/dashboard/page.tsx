"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

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

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [newCourseName, setNewCourseName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: courses, isLoading } = useQuery({
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
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow">
        <div className="flex-1">
          <Link href="/" className="btn btn-ghost text-xl font-bold">
            OW Parcour Designer
          </Link>
        </div>
        <div className="flex-none gap-2">
          <span className="text-sm hidden sm:block">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn btn-ghost btn-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Courses</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
          >
            + New Course
          </button>
        </div>

        {showCreate && (
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title text-lg">New course</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-block flex-1"
                  placeholder="Course name"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={createMut.isPending}
                  className="btn btn-primary"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !courses?.length ? (
          <div className="text-center py-16 text-base-content/50">
            <p className="text-lg">No courses yet.</p>
            <p className="text-sm mt-1">Create your first swim course to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <div key={course.id} className="card bg-base-100 shadow hover:shadow-md transition-shadow">
                <div className="card-body">
                  <h2 className="card-title text-base truncate">{course.name}</h2>
                  {course.lakeLabel && (
                    <p className="text-sm text-base-content/60 truncate">{course.lakeLabel}</p>
                  )}
                  {course.distanceKm != null && (
                    <p className="text-sm font-medium text-primary">
                      {course.distanceKm.toFixed(2)} km
                    </p>
                  )}
                  <p className="text-xs text-base-content/40">
                    {new Date(course.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="card-actions justify-end mt-2">
                    <button
                      onClick={() =>
                        deleteMut.isPending
                          ? undefined
                          : window.confirm(`Delete "${course.name}"?`) &&
                            deleteMut.mutate(course.id)
                      }
                      className="btn btn-ghost btn-xs text-error"
                    >
                      Delete
                    </button>
                    <Link
                      href={`/designer/${course.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
