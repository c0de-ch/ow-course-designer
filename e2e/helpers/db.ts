import { PrismaClient } from "@prisma/client";

// One client per test run. Cheaper than spinning one up per spec.
let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Returns the most recent verification code for an email so tests can
// advance past the register → verify gate without an SMTP dependency.
export async function latestVerificationCode(
  email: string
): Promise<string | null> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;
  const record = await db.emailVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return record?.code ?? null;
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await db.user.delete({ where: { id: user.id } });
  }
}
