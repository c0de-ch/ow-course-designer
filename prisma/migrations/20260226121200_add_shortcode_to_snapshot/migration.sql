-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourseSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "flyoverUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseSnapshot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseSnapshot" ("id", "courseId", "token", "shortCode", "payload", "flyoverUrl", "createdAt")
    SELECT "id", "courseId", "token", COALESCE("shortCode", hex(randomblob(4))), "payload", "flyoverUrl", "createdAt"
    FROM "CourseSnapshot";
DROP TABLE "CourseSnapshot";
ALTER TABLE "new_CourseSnapshot" RENAME TO "CourseSnapshot";
CREATE UNIQUE INDEX "CourseSnapshot_token_key" ON "CourseSnapshot"("token");
CREATE UNIQUE INDEX "CourseSnapshot_shortCode_key" ON "CourseSnapshot"("shortCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
