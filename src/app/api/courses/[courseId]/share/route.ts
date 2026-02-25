import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeCourseData } from "@/lib/course-encoder";
import { CourseData } from "@/store/courseStore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized — please log in" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { courseId } = await params;

  // Optional flyover video URL from request body
  let flyoverUrl: string | null = null;
  try {
    const body = await req.json();
    if (body?.flyoverUrl && typeof body.flyoverUrl === "string") {
      flyoverUrl = body.flyoverUrl;
    }
  } catch {
    // No body or invalid JSON — that's fine
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
      include: { elements: { orderBy: { order: "asc" } } },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found. Make sure it is saved first." },
        { status: 404 }
      );
    }

    const courseData: CourseData = {
      id: course.id,
      name: course.name,
      lakeLabel: course.lakeLabel,
      lakeLatLng: course.lakeLatLng,
      zoomLevel: course.zoomLevel,
      distanceKm: course.distanceKm,
      laps: course.laps ?? 1,
      raceLabel: course.raceLabel ?? null,
      raceLogo: course.raceLogo ?? null,
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
      data: { courseId, payload, flyoverUrl },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({
      token: snapshot.token,
      url: `${appUrl}/share/${snapshot.token}`,
    });
  } catch (err) {
    console.error("[share] Failed to create snapshot:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    // If it's a Prisma error about missing column, it's likely a migration issue
    if (message.includes("flyoverUrl") || message.includes("column")) {
      return NextResponse.json(
        { error: "Database schema outdated. Run: npx prisma migrate dev" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Failed to create share link: ${message}` },
      { status: 500 }
    );
  }
}
