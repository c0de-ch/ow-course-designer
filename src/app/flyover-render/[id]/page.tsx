import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { courseRecordToData } from "@/lib/export/export-helpers";
import { FlyoverRenderView } from "@/components/designer/FlyoverRenderView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The page the server records a flyover video from (src/lib/flyover/render.ts).
 * It answers only while its render job is running, and the job id is the only
 * way to reach it.
 */
export default async function FlyoverRenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.flyoverRender.findUnique({ where: { id } });
  if (!job || job.status !== "rendering") notFound();

  const course = await prisma.course.findUnique({
    where: { id: job.courseId },
    include: { elements: { orderBy: { order: "asc" } } },
  });
  if (!course) notFound();

  return <FlyoverRenderView courseData={courseRecordToData(course)} speed={job.speed} />;
}
