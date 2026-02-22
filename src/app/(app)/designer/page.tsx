"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      .then((r) => r.json())
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-error">Failed to create course. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}
