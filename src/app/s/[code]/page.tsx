import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkPage({ params }: Props) {
  const { code } = await params;

  const snapshot = await prisma.courseSnapshot.findUnique({
    where: { shortCode: code },
    select: { token: true },
  });

  if (!snapshot) notFound();

  redirect(`/share/${snapshot.token}`);
}
