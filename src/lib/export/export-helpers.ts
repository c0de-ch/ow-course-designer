import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Course, CourseElement as DbCourseElement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodeCourseData } from "@/lib/course-encoder";
import { withBrowser, ExportQueueTimeoutError } from "@/lib/puppeteer";
import type { CourseData, ElementType } from "@/store/courseStore";
import { internalAppUrl, runtimeEnv } from "@/lib/app-url";

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
  const appUrl = internalAppUrl();
  return `${appUrl}/share/${snapshot.token}?print=1`;
}

export function shareTokenPrintUrl(token: string): string {
  const appUrl = internalAppUrl();
  return `${appUrl}/share/${token}?print=1`;
}

function safeFilename(name: string, ext: string): string {
  return `${name.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
}

/** The print page could not show the map (bad key, key not allowed for the host, ...). */
export class MapsUnavailableError extends Error {}

/**
 * Serve requests for the public origin from the local server. The print page
 * then runs under the public hostname, which is the one the Google Maps key
 * allows, while no request leaves the pod.
 */
async function servePublicOriginLocally(
  page: import("puppeteer").Page,
  publicOrigin: string,
  internalOrigin: string
) {
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (!url.startsWith(publicOrigin + "/")) {
      await req.continue();
      return;
    }
    try {
      const headers = { ...req.headers() };
      delete headers.host;
      const res = await fetch(internalOrigin + url.slice(publicOrigin.length), {
        method: req.method(),
        headers,
        body: req.postData(),
        redirect: "manual",
      });
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        // fetch already decoded the body
        if (key !== "content-encoding" && key !== "content-length") responseHeaders[key] = value;
      });
      await req.respond({
        status: res.status,
        headers: responseHeaders,
        body: Buffer.from(await res.arrayBuffer()),
      });
    } catch {
      await req.abort().catch(() => {});
    }
  });
}

/**
 * Opens an app URL (on the internal origin) in the page under the public
 * hostname when one is configured, so the Google Maps key accepts it; the
 * requests are still served by this server.
 */
export async function gotoAppPage(page: import("puppeteer").Page, url: string) {
  const internalOrigin = internalAppUrl();
  const publicOrigin = runtimeEnv("APP_URL")?.replace(/\/+$/, "");
  let target = url;
  if (publicOrigin && publicOrigin !== internalOrigin && url.startsWith(internalOrigin)) {
    await servePublicOriginLocally(page, publicOrigin, internalOrigin);
    target = publicOrigin + url.slice(internalOrigin.length);
  }
  await page.goto(target, { waitUntil: "networkidle0", timeout: 30000 });
  return { publicOrigin, internalOrigin };
}

async function renderPage<T>(
  printUrl: string,
  capture: (page: import("puppeteer").Page) => Promise<T>
): Promise<T> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const { publicOrigin, internalOrigin } = await gotoAppPage(page, printUrl);
    await page.waitForSelector("#map-ready, #map-error", { timeout: 20000 });
    // Google reports a rejected key shortly after the first tiles; give it a moment
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const failed = await page.evaluate(() => {
      const el = document.getElementById("map-error");
      return el ? el.getAttribute("data-message") || "unknown error" : null;
    });
    if (failed) {
      throw new MapsUnavailableError(
        `${failed}. Add ${publicOrigin ?? internalOrigin}/* to the key's website restrictions in Google Cloud.`
      );
    }
    return capture(page);
  });
}

export function mapsUnavailableResponse(err: MapsUnavailableError): NextResponse {
  return new NextResponse(`The map could not be rendered: ${err.message}`, { status: 502 });
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
