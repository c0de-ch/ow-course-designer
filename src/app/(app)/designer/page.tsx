"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCourseStore } from "@/store/courseStore";

export default function NewDesignerPage() {
  const router = useRouter();
  const { courseData, resetCourse } = useCourseStore();
  const [creating, setCreating] = useState(true);

  useEffect(() => {
    resetCourse();
    const name = courseData.name || "Untitled Course";

    fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((course) => {
        router.replace(`/designer/${course.id}`);
      })
      .catch(() => {
        setCreating(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!creating) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-dvh bg-base-200 text-center px-6">
        <p className="font-medium">The course could not be created.</p>
        <Link href="/dashboard" className="btn btn-primary btn-sm">Back to my courses</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 h-dvh bg-base-200 text-sm text-base-content/60">
      <span className="loading loading-spinner loading-lg" />
      Creating course…
    </div>
  );
}
