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
import { tracer } from "@/lib/otel/tracer";
import { exportDurationHistogram, exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const start = Date.now();
  return await tracer.startActiveSpan("GET /api/courses/:id/export/pdf", async (span) => {
    try {
      const session = await auth();
      if (!session?.user) {
        span.setStatus({ code: 2, message: "Unauthorized" });
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const userId = (session.user as { id: string }).id;
      const { courseId } = await params;

      const course = await prisma.course.findFirst({
        where: { id: courseId, userId },
        include: { elements: { orderBy: { order: "asc" } } },
      });

      if (!course) {
        span.setStatus({ code: 2, message: "Not found" });
        return new NextResponse("Not found", { status: 404 });
      }

      const courseData = courseRecordToData(course);
      const printUrl = await createSnapshotPrintUrl(courseId, courseData);
      const pdf = await renderPdf(printUrl);

      exportDurationHistogram.record(Date.now() - start, { format: "pdf" });
      exportsSuccessCounter.add(1, { format: "pdf" });
      span.setStatus({ code: 0 });

      return pdfResponse(pdf, course.name);
    } catch (err) {
      exportsFailureCounter.add(1, { format: "pdf" });
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      if (err instanceof ExportQueueTimeoutError) return queueBusyResponse();
      throw err;
    } finally {
      span.end();
    }
  });
}
