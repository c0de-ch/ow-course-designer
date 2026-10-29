import { spawn } from "child_process";
import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { withBrowser, WEBGL_ARGS, ExportQueueTimeoutError } from "@/lib/puppeteer";
import { gotoAppPage } from "@/lib/export/export-helpers";
import { internalAppUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";
import { RENDER_FPS, RENDER_HEIGHT, RENDER_WIDTH } from "@/lib/flyover/render-config";

/**
 * Server-side flyover videos. A request queues a FlyoverRender row; one job at
 * a time opens /flyover-render/<id> in headless Chromium, steps the flyover
 * frame by frame (each frame waits for the map's tiles, so the video is smooth
 * however slow the server is), screenshots every frame and pipes them into
 * ffmpeg, which writes an MP4 to data/flyovers. The browser comes from the
 * export pool, so a render and PDF/PNG exports never exceed its limit.
 */

const FLYOVER_DIR = join(process.cwd(), "data", "flyovers");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
/** How long to wait before trying again when the export pool is busy */
const BUSY_RETRY_MS = 30_000;

let running = false;
let recovered = false;

/** Starts working through queued renders unless that is already happening */
export function kickFlyoverRenders(): void {
  if (running) return;
  running = true;
  void (async () => {
    try {
      if (!recovered) {
        // Nothing renders while this process is idle: a "rendering" row is left over from a restart
        await prisma.flyoverRender.updateMany({
          where: { status: "rendering" },
          data: { status: "failed", error: "Interrupted by a server restart. Please try again." },
        });
        recovered = true;
      }
      for (;;) {
        const job = await prisma.flyoverRender.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
        if (!job) break;
        try {
          await renderJob(job.id);
        } catch (err) {
          if (err instanceof ExportQueueTimeoutError) {
            await new Promise((r) => setTimeout(r, BUSY_RETRY_MS));
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      logger.error({ err }, "flyover render loop failed");
    } finally {
      running = false;
    }
  })();
}

async function renderJob(id: string): Promise<void> {
  await mkdir(FLYOVER_DIR, { recursive: true });
  const job = await prisma.flyoverRender.findUniqueOrThrow({ where: { id } });
  const filename = `${job.courseId}_${randomUUID()}.mp4`;
  const outPath = join(FLYOVER_DIR, filename);

  await withBrowser(async (browser) => {
    await prisma.flyoverRender.update({ where: { id }, data: { status: "rendering", progress: 0, error: null } });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: RENDER_WIDTH, height: RENDER_HEIGHT, deviceScaleFactor: 1 });
      await gotoAppPage(page, `${internalAppUrl()}/flyover-render/${id}`);
      await page.waitForFunction(() => window.__flyover?.ready || window.__flyover?.error, { timeout: 60_000 });
      const { error, frameCount } = await page.evaluate(() => ({
        error: window.__flyover!.error,
        frameCount: window.__flyover!.frameCount,
      }));
      if (error) throw new Error(error);

      await encodeFrames(outPath, frameCount, async (i) => {
        await page.evaluate((n) => window.__flyover!.show(n), i);
        const shot = await page.screenshot({ type: "jpeg", quality: 85 });
        if (i % 15 === 0) {
          await prisma.flyoverRender.update({ where: { id }, data: { progress: i / frameCount } });
        }
        return Buffer.from(shot);
      });

      await prisma.flyoverRender.update({ where: { id }, data: { status: "done", progress: 1, filename } });
      logger.info({ id, frameCount }, "flyover rendered");
      await removeOlderVideos(job.courseId, id);
    } catch (err) {
      await unlink(outPath).catch(() => {});
      const message = (err as Error).message || "Rendering failed";
      await prisma.flyoverRender.update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } });
      logger.warn({ id, err }, "flyover render failed");
    }
  }, WEBGL_ARGS);
}

/** Pipes `count` JPEG frames from `frame(i)` into ffmpeg, which writes an H.264 MP4 */
async function encodeFrames(outPath: string, count: number, frame: (i: number) => Promise<Buffer>): Promise<void> {
  const ffmpeg = spawn(
    FFMPEG,
    [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", String(RENDER_FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      outPath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] }
  );
  // A write after ffmpeg has died fails with EPIPE; the exit code reports it
  ffmpeg.stdin.on("error", () => {});
  let stderr = "";
  ffmpeg.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  const exited = new Promise<number>((resolve, reject) => {
    ffmpeg.on("error", (err) => reject(new Error(`ffmpeg could not start: ${err.message}`)));
    ffmpeg.on("close", (code) => resolve(code ?? 1));
  });

  try {
    for (let i = 0; i < count; i++) {
      if (ffmpeg.exitCode !== null) break;
      const buf = await frame(i);
      if (!ffmpeg.stdin.write(buf)) await Promise.race([new Promise((r) => ffmpeg.stdin.once("drain", r)), exited]);
    }
  } finally {
    ffmpeg.stdin.end();
  }
  const code = await exited;
  if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${stderr.trim() || "no output"}`);
}

/**
 * Deletes the course's earlier rendered videos once a new one is done, except
 * those a share link still plays (CourseSnapshot.flyoverUrl).
 */
async function removeOlderVideos(courseId: string, keepId: string): Promise<void> {
  const older = await prisma.flyoverRender.findMany({
    where: { courseId, id: { not: keepId }, filename: { not: null } },
  });
  for (const r of older) {
    const shared = await prisma.courseSnapshot.count({ where: { flyoverUrl: { endsWith: `/${r.filename}` } } });
    if (shared > 0) continue;
    await unlink(join(FLYOVER_DIR, r.filename!)).catch(() => {});
    await prisma.flyoverRender.update({ where: { id: r.id }, data: { filename: null } });
  }
}
