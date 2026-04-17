import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Password is optional so OAuth-only accounts can also delete themselves.
const schema = z.object({
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const ip = getRequestIp(req.headers);
  const rate = checkRateLimit(`delete-account:${ip}`, 3, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Credentials users must confirm with password. OAuth-only users can skip.
    if (user.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required to confirm deletion" },
          { status: 400 }
        );
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Password is incorrect" },
          { status: 400 }
        );
      }
    }

    // Schema has onDelete: Cascade on User's courses, accounts, sessions, and
    // verification/reset codes — a single delete wipes them all.
    await prisma.user.delete({ where: { id: userId } });

    logger.info({ userId }, "Account deleted");
    return NextResponse.json({ message: "Account deleted" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    logger.error({ err, userId }, "Delete-account error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
