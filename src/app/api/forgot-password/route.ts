import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetCode } from "@/lib/mail";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers);
  const rate = checkRateLimit(`forgot-password:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way — don't leak whether the account exists.
    const genericResponse = NextResponse.json({
      message: "If an account with that email exists, a reset code has been sent",
    });

    if (!user || !user.passwordHash) {
      // Also no-op for OAuth-only accounts with no password to reset.
      return genericResponse;
    }

    // Throttle: don't issue a new code if one was issued in the last 60s.
    const recent = await prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recent) {
      return genericResponse;
    }

    await prisma.passwordResetCode.deleteMany({ where: { userId: user.id } });

    const code = generateCode();
    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        code,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      await sendPasswordResetCode(email, code);
    } catch (mailErr) {
      console.error("Failed to send password reset email:", mailErr);
      // Still return the generic message — the user can retry.
    }

    return genericResponse;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Forgot-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
