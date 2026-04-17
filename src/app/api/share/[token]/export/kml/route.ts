import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import { buildKml } from "@/lib/kml-builder";
import { withSpan } from "@/lib/otel/with-span";
import { exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return withSpan("GET /api/share/[token]/export/kml", async () => {
    const { token } = await params;

    const snapshot = await prisma.courseSnapshot.findUnique({
      where: { token },
    });
    if (!snapshot) {
      return new NextResponse("Not found", { status: 404 });
    }

    try {
      const courseData = decodeCourseData(snapshot.payload);
      const kml = buildKml(courseData.name, courseData.elements);

      const filename = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}.kml`;
      exportsSuccessCounter.add(1, { format: "kml" });
      return new NextResponse(kml, {
        headers: {
          "Content-Type": "application/vnd.google-earth.kml+xml",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (err) {
      exportsFailureCounter.add(1, { format: "kml" });
      throw err;
    }
  });
}
