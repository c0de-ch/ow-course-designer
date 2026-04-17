import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildKml } from "@/lib/kml-builder";
import { CourseElement } from "@/store/courseStore";
import { withSpan } from "@/lib/otel/with-span";
import { exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  return withSpan("GET /api/courses/[courseId]/export/kml", async () => {
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

    try {
      const kml = buildKml(
        course.name,
        course.elements.map((el) => ({
          id: el.id,
          type: el.type as CourseElement["type"],
          lat: el.lat,
          lng: el.lng,
          order: el.order,
          label: el.label,
          metadata: el.metadata,
        }))
      );

      const filename = `${course.name.replace(/[^a-z0-9]/gi, "_")}.kml`;
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
