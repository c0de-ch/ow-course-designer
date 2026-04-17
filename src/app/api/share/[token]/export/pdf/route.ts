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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const snapshot = await prisma.courseSnapshot.findUnique({ where: { token } });
  if (!snapshot) {
    return new NextResponse("Not found", { status: 404 });
  }

  const courseData = decodeCourseData(snapshot.payload);

  try {
    const pdf = await renderPdf(shareTokenPrintUrl(token));
    return pdfResponse(pdf, courseData.name);
  } catch (err) {
    if (err instanceof ExportQueueTimeoutError) return queueBusyResponse();
    throw err;
  }
}
