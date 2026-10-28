import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decodeCourseData } from "@/lib/course-encoder";
import { ShareView } from "@/components/designer/ShareView";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}

// Shared by link: name the course in link previews, but keep it out of search
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await prisma.courseSnapshot.findUnique({ where: { token } });
  const name = snapshot ? decodeCourseData(snapshot.payload).name : null;
  return {
    title: name ? `${name}: open water swim course` : "Open water swim course",
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { print } = await searchParams;

  const snapshot = await prisma.courseSnapshot.findUnique({
    where: { token },
  });

  if (!snapshot) notFound();

  const courseData = decodeCourseData(snapshot.payload);

  return (
    <ShareView
      courseData={courseData}
      isPrint={print === "1"}
      token={token}
      flyoverUrl={snapshot.flyoverUrl}
    />
  );
}
