import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FlyoverRender } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicAppUrl } from "@/lib/app-url";
import { FLYOVER_SPEEDS } from "@/lib/flyover/cameraPath";
import { kickFlyoverRenders } from "@/lib/flyover/render";

/** A render as the designer sees it; `url` once the video is ready */
function view(job: FlyoverRender, req: NextRequest) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    speed: job.speed,
    error: job.error,
    url: job.filename ? `${publicAppUrl(req)}/api/flyover/${job.filename}` : null,
    createdAt: job.createdAt,
  };
}

async function ownCourse(courseId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const course = await prisma.course.findFirst({ where: { id: courseId, userId }, select: { id: true } });
  if (!course) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { userId };
}

/** The course's latest render, or null */
export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const owner = await ownCourse(courseId);
  if (owner.error) return owner.error;

  const job = await prisma.flyoverRender.findFirst({ where: { courseId }, orderBy: { createdAt: "desc" } });
  if (job && (job.status === "queued" || job.status === "rendering")) kickFlyoverRenders();
  return NextResponse.json(job ? view(job, req) : null);
}

const postSchema = z.object({ speed: z.number().refine((s) => FLYOVER_SPEEDS.includes(s)).default(1) });

/** Queues a render of the course as it is saved now; answers with the course's running render if there is one */
export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const owner = await ownCourse(courseId);
  if (owner.error) return owner.error;

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unsupported speed" }, { status: 400 });

  const active = await prisma.flyoverRender.findFirst({
    where: { courseId, status: { in: ["queued", "rendering"] } },
    orderBy: { createdAt: "desc" },
  });
  const job =
    active ??
    (await prisma.flyoverRender.create({ data: { courseId, userId: owner.userId!, speed: parsed.data.speed } }));
  kickFlyoverRenders();
  return NextResponse.json(view(job, req), { status: active ? 200 : 202 });
}
