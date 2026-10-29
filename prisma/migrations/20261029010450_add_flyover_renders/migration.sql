-- CreateTable
CREATE TABLE "FlyoverRender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" REAL NOT NULL DEFAULT 0,
    "speed" REAL NOT NULL DEFAULT 1,
    "error" TEXT,
    "filename" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FlyoverRender_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FlyoverRender_courseId_createdAt_idx" ON "FlyoverRender"("courseId", "createdAt");
