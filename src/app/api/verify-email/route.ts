import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminNewUserNotification } from "@/lib/mail";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers);
  // 10 attempts per IP per 10 minutes — thwarts brute-forcing the 6-digit code.
  const rate = checkRateLimit(`verify-email:${ip}`, 10, 10 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { email, code } = verifySchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 }
      );
    }

    const record = await prisma.emailVerificationCode.findFirst({
      where: { userId: user.id, code },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    if (record.expires < new Date()) {
      return NextResponse.json(
        { error: "Verification code expired" },
        { status: 400 }
      );
    }

    // Activate the account
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } }),
    ]);

    // Send admin notification (non-blocking)
    sendAdminNewUserNotification(user.name, user.email).catch((err) =>
      logger.error({ err }, "Failed to send admin notification")
    );

    return NextResponse.json({ message: "Email verified", verified: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    logger.error({ err }, "Verification error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
