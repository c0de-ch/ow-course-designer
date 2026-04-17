import { test, expect } from "@playwright/test";
import {
  latestVerificationCode,
  deleteUserByEmail,
  getDb,
} from "./helpers/db";

// Unique email per run so repeated local executions don't collide on the
// unique-email constraint.
const EMAIL = `e2e-${Date.now()}@example.test`;
const PASSWORD = "e2e-password-123";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await deleteUserByEmail(EMAIL);
});

test.afterAll(async () => {
  await deleteUserByEmail(EMAIL);
  await getDb().$disconnect();
});

test("register → verify → dashboard → settings", async ({ page }) => {
  // --- Register step --------------------------------------------------
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();

  // --- Verify step ----------------------------------------------------
  // SMTP isn't wired in CI, so pull the code directly from the DB. The
  // register route still writes the code even when sendVerificationCode
  // fails, and returns emailSent:false.
  const codeInput = page.getByLabel(/verification code/i);
  await expect(codeInput).toBeVisible();

  const code = await latestVerificationCode(EMAIL);
  expect(code, "verification code should be stored in DB").toBeTruthy();
  await codeInput.fill(code!);
  await page.getByRole("button", { name: /verify/i }).click();

  // --- Dashboard ------------------------------------------------------
  // Verify success auto-signs the user in and redirects to /dashboard.
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: /my courses/i })
  ).toBeVisible();

  // --- Settings -------------------------------------------------------
  await page.getByRole("link", { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page.getByRole("heading", { name: /account settings/i })
  ).toBeVisible();
});
