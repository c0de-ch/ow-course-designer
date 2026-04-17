import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import {
  ExportQueueTimeoutError,
  pdfResponse,
  queueBusyResponse,
  renderPdf,
  shareTokenPrintUrl,
} from "@/lib/export/export-helpers";
import { withSpan } from "@/lib/otel/with-span";
import { exportDurationHistogram, exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return withSpan("GET /api/share/[token]/export/pdf", async () => {
    const start = Date.now();
    const { token } = await params;

    const snapshot = await prisma.courseSnapshot.findUnique({ where: { token } });
    if (!snapshot) {
      return new NextResponse("Not found", { status: 404 });
    }

    const courseData = decodeCourseData(snapshot.payload);

    try {
      const pdf = await renderPdf(shareTokenPrintUrl(token));
      exportDurationHistogram.record(Date.now() - start, { format: "pdf" });
      exportsSuccessCounter.add(1, { format: "pdf" });
      return pdfResponse(pdf, courseData.name);
    } catch (err) {
      exportsFailureCounter.add(1, { format: "pdf" });
      if (err instanceof ExportQueueTimeoutError) return queueBusyResponse();
      throw err;
    }
  });
}
