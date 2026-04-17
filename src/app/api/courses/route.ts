import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withSpan } from "@/lib/otel/with-span";
import { coursesCreatedCounter } from "@/lib/otel/metrics";

export async function GET() {
  return withSpan("GET /api/courses", async () => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const courses = await prisma.course.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        lakeLabel: true,
        distanceKm: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(courses);
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  lakeLabel: z.string().optional(),
  lakeLatLng: z.string().optional(),
  zoomLevel: z.number().int().min(1).max(22).optional(),
});

export async function POST(req: NextRequest) {
  return withSpan("POST /api/courses", async () => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    let data: z.infer<typeof createSchema>;
    try {
      data = createSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: err.errors }, { status: 400 });
      }
      throw err;
    }

    const course = await prisma.course.create({
      data: {
        userId,
        name: data.name,
        lakeLabel: data.lakeLabel ?? null,
        lakeLatLng: data.lakeLatLng ?? null,
        zoomLevel: data.zoomLevel ?? 14,
      },
      select: {
        id: true,
        name: true,
        lakeLabel: true,
        distanceKm: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    coursesCreatedCounter.add(1);
    return NextResponse.json(course, { status: 201 });
  });
}
