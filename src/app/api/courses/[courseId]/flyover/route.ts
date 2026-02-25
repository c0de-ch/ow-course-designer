import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  const formData = await req.formData();
  const video = formData.get("video") as File | null;
  if (!video) {
    return NextResponse.json({ error: "No video provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await video.arrayBuffer());
  const ext = video.type === "video/webm" ? "webm" : "mp4";
  const filename = `${courseId}_${randomUUID()}.${ext}`;

  const dir = join(process.cwd(), "data", "flyovers");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({ url: `${appUrl}/api/flyover/${filename}` });
}
