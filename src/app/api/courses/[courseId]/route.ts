import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function getCourseForUser(courseId: string, userId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, userId },
    include: {
      elements: { orderBy: { order: "asc" } },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { courseId } = await params;
  const course = await getCourseForUser(courseId, userId);

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

const elementSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  lat: z.number(),
  lng: z.number(),
  order: z.number().int(),
  label: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
});

const putSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  lakeLabel: z.string().nullable().optional(),
  lakeLatLng: z.string().nullable().optional(),
  zoomLevel: z.number().int().min(1).max(22).optional(),
  distanceKm: z.number().nullable().optional(),
  laps: z.number().int().min(1).max(100).optional(),
  raceLabel: z.string().nullable().optional(),
  raceLogo: z.string().max(700000).nullable().optional(),
  elements: z.array(elementSchema).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { courseId } = await params;
  const existing = await getCourseForUser(courseId, userId);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = putSchema.parse(body);

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.lakeLabel !== undefined && { lakeLabel: data.lakeLabel }),
          ...(data.lakeLatLng !== undefined && { lakeLatLng: data.lakeLatLng }),
          ...(data.zoomLevel !== undefined && { zoomLevel: data.zoomLevel }),
          ...(data.distanceKm !== undefined && { distanceKm: data.distanceKm }),
          ...(data.laps !== undefined && { laps: data.laps }),
          ...(data.raceLabel !== undefined && { raceLabel: data.raceLabel }),
          ...(data.raceLogo !== undefined && { raceLogo: data.raceLogo }),
        },
      });

      if (data.elements !== undefined) {
        await tx.courseElement.deleteMany({ where: { courseId } });
        if (data.elements.length > 0) {
          await tx.courseElement.createMany({
            data: data.elements.map((el) => ({
              courseId,
              type: el.type,
              lat: el.lat,
              lng: el.lng,
              order: el.order,
              label: el.label ?? null,
              metadata: el.metadata ?? null,
            })),
          });
        }
      }
    });

    const updated = await getCourseForUser(courseId, userId);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { courseId } = await params;
  const existing = await getCourseForUser(courseId, userId);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
