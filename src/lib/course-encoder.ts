import { CourseData } from "@/store/courseStore";

export function encodeCourseData(data: CourseData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json, "utf-8").toString("base64url");
}

export function decodeCourseData(encoded: string): CourseData {
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  return JSON.parse(json) as CourseData;
}
