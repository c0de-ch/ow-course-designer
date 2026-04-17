import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import { buildGpx } from "@/lib/gpx-builder";
import { withSpan } from "@/lib/otel/with-span";
import { exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return withSpan("GET /api/share/[token]/export/gpx", async () => {
    const { token } = await params;

    const snapshot = await prisma.courseSnapshot.findUnique({
      where: { token },
    });
    if (!snapshot) {
      return new NextResponse("Not found", { status: 404 });
    }

    try {
      const courseData = decodeCourseData(snapshot.payload);
      const gpx = buildGpx(courseData.name, courseData.elements);

      const filename = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}.gpx`;
      exportsSuccessCounter.add(1, { format: "gpx" });
      return new NextResponse(gpx, {
        headers: {
          "Content-Type": "application/gpx+xml",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (err) {
      exportsFailureCounter.add(1, { format: "gpx" });
      throw err;
    }
  });
}
