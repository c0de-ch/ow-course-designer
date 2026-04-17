import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers);
  // Same shape as verify-email: brute-force resistance against the 6-digit code.
  const rate = checkRateLimit(`reset-password:${ip}`, 10, 10 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { email, code, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid code or email" },
        { status: 400 }
      );
    }

    const record = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, code },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid code or email" },
        { status: 400 }
      );
    }

    if (record.expires < new Date()) {
      return NextResponse.json(
        { error: "Reset code expired. Request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Mark email as verified too — they've proven ownership via the code.
        data: {
          passwordHash,
          emailVerified: user.emailVerified ?? new Date(),
        },
      }),
      prisma.passwordResetCode.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ message: "Password reset", reset: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    logger.error({ err }, "Reset-password error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
