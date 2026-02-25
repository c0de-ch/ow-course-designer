import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize to prevent directory traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (sanitized !== filename) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filepath = join(process.cwd(), "data", "flyovers", sanitized);

  try {
    const buffer = await readFile(filepath);
    const ext = sanitized.split(".").pop();
    const contentType = ext === "webm" ? "video/webm" : "video/mp4";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitized}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
