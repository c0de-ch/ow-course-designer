import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ExportQueueTimeoutError,
  courseRecordToData,
  createSnapshotPrintUrl,
  pdfResponse,
  queueBusyResponse,
  renderPdf,
} from "@/lib/export/export-helpers";
import { withSpan } from "@/lib/otel/with-span";
import { exportDurationHistogram, exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  return withSpan("GET /api/courses/[courseId]/export/pdf", async () => {
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
      const pdf = await renderPdf(printUrl);

      exportDurationHistogram.record(Date.now() - start, { format: "pdf" });
      exportsSuccessCounter.add(1, { format: "pdf" });

      return pdfResponse(pdf, course.name);
    } catch (err) {
      exportsFailureCounter.add(1, { format: "pdf" });
      if (err instanceof ExportQueueTimeoutError) return queueBusyResponse();
      throw err;
    }
  });
}
