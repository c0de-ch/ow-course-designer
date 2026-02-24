import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeCourseData } from "@/lib/course-encoder";
import { CourseData } from "@/store/courseStore";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { courseId } = await params;

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    include: { elements: { orderBy: { order: "asc" } } },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const courseData: CourseData = {
    id: course.id,
    name: course.name,
    lakeLabel: course.lakeLabel,
    lakeLatLng: course.lakeLatLng,
    zoomLevel: course.zoomLevel,
    distanceKm: course.distanceKm,
    laps: course.laps ?? 1,
    elements: course.elements.map((el) => ({
      id: el.id,
      type: el.type as CourseData["elements"][0]["type"],
      lat: el.lat,
      lng: el.lng,
      order: el.order,
      label: el.label,
      metadata: el.metadata,
    })),
  };

  const payload = encodeCourseData(courseData);
  const snapshot = await prisma.courseSnapshot.create({
    data: { courseId, payload },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    token: snapshot.token,
    url: `${appUrl}/share/${snapshot.token}`,
  });
}
