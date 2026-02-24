import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/mail";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    let userId: string;

    if (existing && !existing.emailVerified) {
      // User registered but never verified — update password & name, resend code
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: name ?? existing.name },
      });
      userId = existing.id;
    } else {
      // New user
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, passwordHash, name: name ?? null },
      });
      userId = user.id;
    }

    // Delete any existing codes for this user
    await prisma.emailVerificationCode.deleteMany({ where: { userId } });

    // Generate and store verification code
    const code = generateCode();
    await prisma.emailVerificationCode.create({
      data: {
        userId,
        code,
        expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    // Send verification email (non-critical — user can resend)
    let emailSent = true;
    try {
      await sendVerificationCode(email, code);
    } catch (mailErr) {
      emailSent = false;
      console.error("Failed to send verification email:", mailErr);
    }

    return NextResponse.json(
      { message: "Verification code sent", email, emailSent },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
