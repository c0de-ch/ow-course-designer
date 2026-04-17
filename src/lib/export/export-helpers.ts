import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Course, CourseElement as DbCourseElement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodeCourseData } from "@/lib/course-encoder";
import { withBrowser, ExportQueueTimeoutError } from "@/lib/puppeteer";
import type { CourseData, ElementType } from "@/store/courseStore";

type CourseWithElements = Course & { elements: DbCourseElement[] };

export function courseRecordToData(course: CourseWithElements): CourseData {
  return {
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
      type: el.type as ElementType,
      lat: el.lat,
      lng: el.lng,
      order: el.order,
      label: el.label,
      metadata: el.metadata,
    })),
  };
}

export async function createSnapshotPrintUrl(
  courseId: string,
  courseData: CourseData
): Promise<string> {
  const snapshot = await prisma.courseSnapshot.create({
    data: {
      courseId,
      payload: encodeCourseData(courseData),
      shortCode: crypto.randomBytes(5).toString("base64url").slice(0, 7),
    },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/share/${snapshot.token}?print=1`;
}

export function shareTokenPrintUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/share/${token}?print=1`;
}

function safeFilename(name: string, ext: string): string {
  return `${name.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
}

async function renderPage<T>(
  printUrl: string,
  capture: (page: import("puppeteer").Page) => Promise<T>
): Promise<T> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector("#map-ready", { timeout: 20000 });
    return capture(page);
  });
}

export async function renderPdf(printUrl: string): Promise<Buffer> {
  const pdf = await renderPage(printUrl, (page) =>
    page.pdf({ format: "A4", landscape: true, printBackground: true })
  );
  return Buffer.from(pdf);
}

export async function renderPng(printUrl: string): Promise<Buffer> {
  const png = await renderPage(printUrl, (page) =>
    page.screenshot({ type: "png", fullPage: false })
  );
  return Buffer.from(png);
}

export function pdfResponse(buffer: Buffer, courseName: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(courseName, "pdf")}"`,
    },
  });
}

export function pngResponse(buffer: Buffer, courseName: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeFilename(courseName, "png")}"`,
    },
  });
}

export function queueBusyResponse(): NextResponse {
  return new NextResponse("Export server busy, please retry", { status: 503 });
}

export { ExportQueueTimeoutError };
