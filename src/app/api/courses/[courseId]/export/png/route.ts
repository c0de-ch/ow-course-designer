import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeCourseData } from "@/lib/course-encoder";
import { launchBrowser } from "@/lib/puppeteer";
import { CourseData } from "@/store/courseStore";
import { tracer } from "@/lib/otel/tracer";
import { exportDurationHistogram, exportsSuccessCounter, exportsFailureCounter } from "@/lib/otel/metrics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const start = Date.now();
  return await tracer.startActiveSpan("GET /api/courses/:id/export/png", async (span) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        span.setStatus({ code: 2, message: "Unauthorized" });
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const userId = (session.user as { id: string }).id;
      const { courseId } = await params;

      const course = await prisma.course.findFirst({
        where: { id: courseId, userId },
        include: { elements: { orderBy: { order: "asc" } } },
      });

      if (!course) {
        span.setStatus({ code: 2, message: "Not found" });
        return new NextResponse("Not found", { status: 404 });
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

      const snapshot = await prisma.courseSnapshot.create({
        data: { courseId, payload: encodeCourseData(courseData) },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const printUrl = `${appUrl}/share/${snapshot.token}?print=1`;

      const browser = await launchBrowser();

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
        await page.waitForSelector("#map-ready", { timeout: 20000 });

        const screenshot = await page.screenshot({ type: "png", fullPage: false });

        exportDurationHistogram.record(Date.now() - start, { format: "png" });
        exportsSuccessCounter.add(1, { format: "png" });
        span.setStatus({ code: 0 });

        const filename = `${course.name.replace(/[^a-z0-9]/gi, "_")}.png`;
        return new NextResponse(Buffer.from(screenshot), {
          headers: {
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      } finally {
        await browser.close();
      }
    } catch (err) {
      exportsFailureCounter.add(1, { format: "png" });
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
