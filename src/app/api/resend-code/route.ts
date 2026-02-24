import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/mail";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      // Don't reveal whether user exists
      return NextResponse.json({ message: "If the email exists, a new code has been sent" });
    }

    // Rate limit: check if a code was sent in the last 60 seconds
    const recent = await prisma.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recent) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting a new code" },
        { status: 429 }
      );
    }

    await prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } });

    const code = generateCode();
    await prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        code,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      await sendVerificationCode(email, code);
    } catch (mailErr) {
      console.error("Failed to send verification email:", mailErr);
      return NextResponse.json(
        { error: "Failed to send email. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: "Verification code sent" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Resend code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
