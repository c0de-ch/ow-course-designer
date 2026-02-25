import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import { launchBrowser } from "@/lib/puppeteer";

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const printUrl = `${appUrl}/share/${token}?print=1`;

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector("#map-ready", { timeout: 20000 });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });

    const filename = `${courseData.name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
