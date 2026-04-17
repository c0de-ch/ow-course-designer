import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ExportQueueTimeoutError,
  courseRecordToData,
  createSnapshotPrintUrl,
  pngResponse,
  queueBusyResponse,
  renderPng,
} from "@/lib/export/export-helpers";
import { withSpan } from "@/lib/otel/with-span";
import { exportDurationHistogram, exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  return withSpan("GET /api/courses/[courseId]/export/png", async () => {
    const start = Date.now();
    try {
      const session = await auth();
      if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const userId = (session.user as { id: string }).id;
      const { courseId } = await params;

      const course = await prisma.course.findFirst({
        where: { id: courseId, userId },
        include: { elements: { orderBy: { order: "asc" } } },
      });

      if (!course) {
        return new NextResponse("Not found", { status: 404 });
      }

      const courseData = courseRecordToData(course);
      const printUrl = await createSnapshotPrintUrl(courseId, courseData);
      const screenshot = await renderPng(printUrl);

      exportDurationHistogram.record(Date.now() - start, { format: "png" });
      exportsSuccessCounter.add(1, { format: "png" });

      return pngResponse(screenshot, course.name);
    } catch (err) {
      exportsFailureCounter.add(1, { format: "png" });
      if (err instanceof ExportQueueTimeoutError) return queueBusyResponse();
      throw err;
    }
  });
}
