-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lakeLabel" TEXT,
    "lakeLatLng" TEXT,
    "zoomLevel" INTEGER NOT NULL DEFAULT 14,
    "distanceKm" REAL,
    "laps" INTEGER NOT NULL DEFAULT 1,
    "raceLabel" TEXT,
    "raceLogo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("createdAt", "distanceKm", "id", "lakeLabel", "lakeLatLng", "name", "updatedAt", "userId", "zoomLevel") SELECT "createdAt", "distanceKm", "id", "lakeLabel", "lakeLatLng", "name", "updatedAt", "userId", "zoomLevel" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
