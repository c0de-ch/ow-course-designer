import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
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
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  lakeLabel: z.string().optional(),
  lakeLatLng: z.string().optional(),
  zoomLevel: z.number().int().min(1).max(22).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const course = await prisma.course.create({
      data: {
        userId,
        name: data.name,
        lakeLabel: data.lakeLabel ?? null,
        lakeLatLng: data.lakeLatLng ?? null,
        zoomLevel: data.zoomLevel ?? 14,
      },
      select: { id: true, name: true, lakeLabel: true, distanceKm: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
