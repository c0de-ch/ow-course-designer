import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { tracer } from "@/lib/otel/tracer";
import { coursesCreatedCounter, httpRequestLatency } from "@/lib/otel/metrics";

export async function GET() {
  const start = Date.now();
  return await tracer.startActiveSpan("GET /api/courses", async (span) => {
    try {
      const session = await auth();
      if (!session?.user) {
        span.setStatus({ code: 2, message: "Unauthorized" });
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

      span.setStatus({ code: 0 });
      return NextResponse.json(courses);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      throw err;
    } finally {
      httpRequestLatency.record(Date.now() - start, { route: "GET /api/courses" });
      span.end();
    }
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  lakeLabel: z.string().optional(),
  lakeLatLng: z.string().optional(),
  zoomLevel: z.number().int().min(1).max(22).optional(),
});

export async function POST(req: NextRequest) {
  const start = Date.now();
  return await tracer.startActiveSpan("POST /api/courses", async (span) => {
    try {
      const session = await auth();
      if (!session?.user) {
        span.setStatus({ code: 2, message: "Unauthorized" });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = (session.user as { id: string }).id;
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

      coursesCreatedCounter.add(1);
      span.setStatus({ code: 0 });
      return NextResponse.json(course, { status: 201 });
    } catch (err) {
      if (err instanceof z.ZodError) {
        span.setStatus({ code: 2, message: "Validation error" });
        return NextResponse.json({ error: err.errors }, { status: 400 });
      }
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    } finally {
      httpRequestLatency.record(Date.now() - start, { route: "POST /api/courses" });
      span.end();
    }
  });
}
