import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import { buildGpx } from "@/lib/gpx-builder";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const snapshot = await prisma.courseSnapshot.findUnique({
    where: { token },
  });
  if (!snapshot) {
    return new NextResponse("Not found", { status: 404 });
  }

  const courseData = decodeCourseData(snapshot.payload);
  const gpx = buildGpx(courseData.name, courseData.elements);

  const filename = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}.gpx`;
  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
