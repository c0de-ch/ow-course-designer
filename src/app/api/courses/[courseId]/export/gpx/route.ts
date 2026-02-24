import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildGpx } from "@/lib/gpx-builder";
import { CourseElement } from "@/store/courseStore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
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

  const gpx = buildGpx(
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

  const filename = `${course.name.replace(/[^a-z0-9]/gi, "_")}.gpx`;
  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
