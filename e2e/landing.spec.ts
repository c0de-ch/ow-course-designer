import { test, expect } from "@playwright/test";

test("landing page renders and links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/OW Course Designer/i);
});

test("login page has email + password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/^password$/i)).toBeVisible();
});

test("protected dashboard redirects unauth user to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
