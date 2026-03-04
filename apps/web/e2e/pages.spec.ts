import { expect, test } from "@playwright/test";

test.describe("Public pages render", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/KyaraInnovate|キャライノベイト/i);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("form")).toBeVisible();
  });
});

test.describe("Auth guard redirects", () => {
  test("blend page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/blend");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("mypage redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/mypage");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
