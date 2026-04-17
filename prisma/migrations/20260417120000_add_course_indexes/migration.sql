-- Speeds up the dashboard list query (WHERE userId ORDER BY updatedAt DESC)
CREATE INDEX IF NOT EXISTS "Course_userId_updatedAt_idx" ON "Course"("userId", "updatedAt" DESC);

-- Speeds up element fetches ordered by `order` for a course
CREATE INDEX IF NOT EXISTS "CourseElement_courseId_order_idx" ON "CourseElement"("courseId", "order");

-- Speeds up snapshot-by-course lookups
CREATE INDEX IF NOT EXISTS "CourseSnapshot_courseId_idx" ON "CourseSnapshot"("courseId");
